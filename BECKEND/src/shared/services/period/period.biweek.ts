/**
 * Period Service - BiWeek Handlers
 * Lógica específica de bi-semanas
 */

import BiWeek from '../../../modules/biweeks/BiWeek';
import logger from '../../container/logger';
import AppError from '../../container/AppError';
import { IBiWeek } from '../../../types/models.d';

/**
 * Resultado de cálculo de datas de bi-semanas
 */
export interface BiWeekDateResult {
  startDate: Date;
  endDate: Date;
  biWeeks: string[];
  biWeekIds: string[];
}

/**
 * Resultado de verificação de alinhamento
 */
export interface BiWeekAlignmentResult {
  aligned: boolean;
  message?: string;
  suggestion?: {
    startDate: Date;
    endDate: Date;
    biWeeks: string[];
    biWeekIds: string[];
    message: string;
  };
  biWeeks?: string[];
  biWeekIds?: string[];
}

/**
 * Calcula startDate e endDate a partir de IDs de bi-semanas
 */
export async function calculateDatesFromBiWeeks(biWeekIds: string[]): Promise<BiWeekDateResult> {
  if (!biWeekIds || biWeekIds.length === 0) {
    throw new AppError('biWeekIds é obrigatório para calcular datas de bi-semanas', 400);
  }

  logger.debug('[PeriodService] Calculando datas de bi-semanas', { biWeekIds });

  // Buscar bi-semanas no banco
  const biWeeks = await BiWeek.find({ bi_week_id: { $in: biWeekIds } })
    .sort({ dataInicio: 1 })
    .exec();

  if (biWeeks.length === 0) {
    throw new AppError(`Nenhuma bi-semana encontrada para os IDs: ${biWeekIds.join(', ')}`, 404);
  }

  if (biWeeks.length !== biWeekIds.length) {
    const foundIds = biWeeks.map(bw => bw.bi_week_id);
    const missingIds = biWeekIds.filter(id => !foundIds.includes(id));
    throw new AppError(`Bi-semanas não encontradas: ${missingIds.join(', ')}`, 404);
  }

  // Verificar continuidade
  validateBiWeekContinuity(biWeeks);

  const firstBiWeek = biWeeks[0];
  const lastBiWeek = biWeeks[biWeeks.length - 1];
  
  if (!firstBiWeek || !lastBiWeek) {
    throw new AppError('Erro ao processar bi-semanas', 500);
  }

  const startDate = firstBiWeek.dataInicio;
  const endDate = lastBiWeek.dataFim;

  logger.info('[PeriodService] Datas calculadas de bi-semanas', {
    biWeekIds,
    startDate,
    endDate,
    biWeeksCount: biWeeks.length
  });

  return {
    startDate,
    endDate,
    biWeeks: biWeeks.map(bw => bw._id.toString()),
    biWeekIds: biWeeks.map(bw => bw.bi_week_id)
  };
}

/**
 * Valida continuidade de bi-semanas (não pode ter gaps)
 */
export function validateBiWeekContinuity(biWeeks: IBiWeek[]): void {
  if (biWeeks.length <= 1) return;

  for (let i = 0; i < biWeeks.length - 1; i++) {
    const current = biWeeks[i];
    const next = biWeeks[i + 1];

    if (!current || !next) continue;

    const expectedNextStart = new Date(current.dataFim);
    expectedNextStart.setUTCDate(expectedNextStart.getUTCDate() + 1);

    const actualNextStart = new Date(next.dataInicio);

    if (expectedNextStart.getTime() !== actualNextStart.getTime()) {
      throw new AppError(
        `Bi-semanas não são contínuas: ${current.bi_week_id} termina em ${formatDate(current.dataFim)}, ` +
        `mas ${next.bi_week_id} começa em ${formatDate(next.dataInicio)}. ` +
        `Esperado início em ${formatDate(expectedNextStart)}`,
        400
      );
    }
  }
}

/**
 * Verifica se um período de datas customizado alinha com bi-semanas
 */
export async function checkBiWeekAlignment(startDate: Date | string, endDate: Date | string): Promise<BiWeekAlignmentResult> {
  logger.debug('[PeriodService] Verificando alinhamento com bi-semanas', { startDate, endDate });

  // Normalizar datas para UTC 00:00:00
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  // Buscar bi-semanas que intersectam o período
  const biWeeks = await BiWeek.find({
    $or: [
      { dataInicio: { $gte: start, $lte: end } },
      { dataFim: { $gte: start, $lte: end } },
      { dataInicio: { $lte: start }, dataFim: { $gte: end } }
    ]
  }).sort({ dataInicio: 1 }).exec();

  if (biWeeks.length === 0) {
    return {
      aligned: false,
      message: 'Nenhuma bi-semana encontrada para este período'
    };
  }

  const firstBiWeek = biWeeks[0];
  const lastBiWeek = biWeeks[biWeeks.length - 1];

  if (!firstBiWeek || !lastBiWeek) {
    return {
      aligned: false,
      message: 'Erro ao processar bi-semanas'
    };
  }

  // Verificar se as datas coincidem exatamente
  const startAligned = start.getTime() === firstBiWeek.dataInicio.getTime();
  const endAligned = end.getTime() === lastBiWeek.dataFim.getTime();

  if (startAligned && endAligned) {
    logger.info('[PeriodService] Período alinhado perfeitamente com bi-semanas', {
      biWeeks: biWeeks.map(bw => bw.bi_week_id)
    });
    return {
      aligned: true,
      biWeeks: biWeeks.map(bw => bw._id.toString()),
      biWeekIds: biWeeks.map(bw => bw.bi_week_id)
    };
  }

  // Se não alinha, sugerir ajuste
  logger.warn('[PeriodService] Período não alinha com bi-semanas', {
    startAligned,
    endAligned
  });

  return {
    aligned: false,
    suggestion: {
      startDate: firstBiWeek.dataInicio,
      endDate: lastBiWeek.dataFim,
      biWeeks: biWeeks.map(bw => bw._id.toString()),
      biWeekIds: biWeeks.map(bw => bw.bi_week_id),
      message: `Sugestão: ${formatDate(firstBiWeek.dataInicio)} até ${formatDate(lastBiWeek.dataFim)}`
    }
  };
}

/**
 * Busca bi-semana que contém uma data específica
 */
export async function findBiWeekByDate(date: Date | string): Promise<IBiWeek | null> {
  const searchDate = new Date(date);
  searchDate.setUTCHours(0, 0, 0, 0);

  const biWeek = await BiWeek.findOne({
    dataInicio: { $lte: searchDate },
    dataFim: { $gte: searchDate }
  }).exec();

  return biWeek;
}

/**
 * Formata data para DD/MM/YYYY
 */
function formatDate(date: Date | string): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
