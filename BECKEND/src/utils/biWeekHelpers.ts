import BiWeek from '@modules/biweeks/BiWeek';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';
import { IBiWeek } from '../types/models.d';

interface BiWeekValidation {
  valid: boolean;
  biWeeks: IBiWeek[];
  message: string;
  suggestion?: {
    start_date: Date;
    end_date: Date;
    message: string;
  } | null;
}

interface PeriodCalculation {
  start_date: Date;
  end_date: Date;
  biWeeks: IBiWeek[];
  count: number;
}

interface SequenceValidation {
  valid: boolean;
  message: string;
  gaps: Array<{
    after: string;
    before: string;
    gap_days: number;
  }>;
}

/**
 * Utilities for working with BiWeeks (14-day periods)
 */
class BiWeekHelpers {
  /**
   * Finds all bi-weeks that a period spans
   */
  static async findBiWeeksInRange(startDate: Date, endDate: Date): Promise<IBiWeek[]> {
    logger.debug(`[BiWeekHelpers] Buscando bi-semanas entre ${startDate} e ${endDate}`);

    try {
      const biWeeks = await BiWeek.find({
        $or: [
          { dataInicio: { $gte: startDate, $lte: endDate } },
          { dataFim: { $gte: startDate, $lte: endDate } },
          { dataInicio: { $lte: startDate }, dataFim: { $gte: endDate } },
        ],
        ativo: true,
      })
        .sort({ dataInicio: 1 })
        .exec();

      logger.debug(`[BiWeekHelpers] Encontradas ${biWeeks.length} bi-semanas`);
      return biWeeks;
    } catch (error) {
      logger.error(`[BiWeekHelpers] Erro ao buscar bi-semanas: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Validates if a period is perfectly aligned with bi-weeks
   */
  static async validatePeriodAlignment(
    startDate: Date,
    endDate: Date
  ): Promise<BiWeekValidation> {
    logger.debug(`[BiWeekHelpers] Validando alinhamento do período`);

    const biWeeks = await this.findBiWeeksInRange(startDate, endDate);

    if (biWeeks.length === 0) {
      return {
        valid: false,
        biWeeks: [],
        message: 'Nenhuma bi-semana encontrada para este período.',
        suggestion: null,
      };
    }

    const firstBiWeek = biWeeks[0]!;
    const lastBiWeek = biWeeks[biWeeks.length - 1]!;

    const startAligned = startDate.getTime() === firstBiWeek.dataInicio.getTime();
    const endAligned = endDate.getTime() === lastBiWeek.dataFim.getTime();

    if (startAligned && endAligned) {
      return {
        valid: true,
        biWeeks,
        message: `Período perfeitamente alinhado com ${biWeeks.length} bi-semana(s).`,
        suggestion: null,
      };
    }

    return {
      valid: false,
      biWeeks,
      message: 'O período não está alinhado com os limites das bi-semanas.',
      suggestion: {
        start_date: firstBiWeek.dataInicio,
        end_date: lastBiWeek.dataFim,
        message: `Sugestão: ${this.formatDate(firstBiWeek.dataInicio)} até ${this.formatDate(lastBiWeek.dataFim)}`,
      },
    };
  }

  /**
   * Automatically adjusts a period to align with bi-weeks
   */
  static async alignPeriodToBiWeeks(startDate: Date, endDate: Date): Promise<any> {
    logger.debug(`[BiWeekHelpers] Alinhando período às bi-semanas`);

    const biWeeks = await this.findBiWeeksInRange(startDate, endDate);

    if (biWeeks.length === 0) {
      throw new AppError('Não foi possível encontrar bi-semanas para este período.', 404);
    }

    const firstBiWeek = biWeeks[0]!;
    const lastBiWeek = biWeeks[biWeeks.length - 1]!;

    return {
      start_date: firstBiWeek.dataInicio,
      end_date: lastBiWeek.dataFim,
      biWeeks,
      adjusted: true,
      message: `Período ajustado para ${biWeeks.length} bi-semana(s) completa(s).`,
    };
  }

  /**
   * Finds the bi-week containing a specific date
   */
  static async findBiWeekByDate(date: Date): Promise<IBiWeek | null> {
    logger.debug(`[BiWeekHelpers] Buscando bi-semana para data: ${date}`);

    try {
      const biWeek = await BiWeek.findOne({
        dataInicio: { $lte: date },
        dataFim: { $gte: date },
        ativo: true,
      }).exec();

      return biWeek;
    } catch (error) {
      logger.error(`[BiWeekHelpers] Erro ao buscar bi-semana: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Finds bi-weeks by IDs
   */
  static async findBiWeeksByIds(biWeekIds: string[]): Promise<IBiWeek[]> {
    logger.debug(`[BiWeekHelpers] Buscando ${biWeekIds.length} bi-semanas por ID`);

    try {
      const biWeeks = await BiWeek.find({
        bi_week_id: { $in: biWeekIds },
        ativo: true,
      })
        .sort({ dataInicio: 1 })
        .exec();

      return biWeeks;
    } catch (error) {
      logger.error(`[BiWeekHelpers] Erro ao buscar bi-semanas: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Calculates period from bi-week IDs
   */
  static async calculatePeriodFromBiWeekIds(
    biWeekIds: string[]
  ): Promise<PeriodCalculation> {
    logger.debug(`[BiWeekHelpers] Calculando período para bi-semanas: ${biWeekIds.join(', ')}`);

    if (!biWeekIds || biWeekIds.length === 0) {
      throw new AppError('Nenhuma bi-semana fornecida.', 400);
    }

    const biWeeks = await this.findBiWeeksByIds(biWeekIds);

    if (biWeeks.length === 0) {
      throw new AppError('Nenhuma bi-semana encontrada com os IDs fornecidos.', 404);
    }

    if (biWeeks.length !== biWeekIds.length) {
      logger.warn(
        `[BiWeekHelpers] Algumas bi-semanas não foram encontradas. Solicitadas: ${biWeekIds.length}, Encontradas: ${biWeeks.length}`
      );
    }

    biWeeks.sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime());

    const start_date = biWeeks[0]!.dataInicio;
    const end_date = biWeeks[biWeeks.length - 1]!.dataFim;

    return {
      start_date,
      end_date,
      biWeeks,
      count: biWeeks.length,
    };
  }

  /**
   * Validates if bi-week IDs form a sequential set (no gaps)
   */
  static async validateBiWeekSequence(biWeekIds: string[]): Promise<SequenceValidation> {
    logger.debug(`[BiWeekHelpers] Validando sequência de bi-semanas`);

    if (!biWeekIds || biWeekIds.length === 0) {
      return { valid: false, message: 'Nenhuma bi-semana fornecida.', gaps: [] };
    }

    if (biWeekIds.length === 1) {
      return { valid: true, message: 'Apenas uma bi-semana.', gaps: [] };
    }

    const biWeeks = await this.findBiWeeksByIds(biWeekIds);

    if (biWeeks.length !== biWeekIds.length) {
      return {
        valid: false,
        message: 'Algumas bi-semanas não foram encontradas.',
        gaps: [],
      };
    }

    biWeeks.sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime());

    const gaps: Array<{ after: string; before: string; gap_days: number }> = [];

    for (let i = 0; i < biWeeks.length - 1; i++) {
      const current = biWeeks[i]!;
      const next = biWeeks[i + 1]!;

      const expectedNextStart = new Date(current.dataFim);
      expectedNextStart.setDate(expectedNextStart.getDate() + 1);
      expectedNextStart.setHours(0, 0, 0, 0);

      const actualNextStart = new Date(next.dataInicio);
      actualNextStart.setHours(0, 0, 0, 0);

      if (expectedNextStart.getTime() !== actualNextStart.getTime()) {
        gaps.push({
          after: current.bi_week_id,
          before: next.bi_week_id,
          gap_days: Math.floor(
            (actualNextStart.getTime() - expectedNextStart.getTime()) / (1000 * 60 * 60 * 24)
          ),
        });
      }
    }

    if (gaps.length > 0) {
      return {
        valid: false,
        message: `Encontrados ${gaps.length} gap(s) na sequência de bi-semanas.`,
        gaps,
      };
    }

    return {
      valid: true,
      message: 'Bi-semanas formam uma sequência contínua.',
      gaps: [],
    };
  }

  /**
   * Formats date in Brazilian format
   */
  static formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Formats date with time in Brazilian format
   */
  static formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Generates readable period description
   */
  static generatePeriodDescription(biWeeks: IBiWeek[]): string {
    if (!biWeeks || biWeeks.length === 0) {
      return 'Período não definido';
    }

    if (biWeeks.length === 1) {
      const bw = biWeeks[0]!;
      return `Bi-semana ${bw.numero}/${bw.ano} (${this.formatDate(bw.dataInicio)} - ${this.formatDate(bw.dataFim)})`;
    }

    const first = biWeeks[0]!;
    const last = biWeeks[biWeeks.length - 1]!;

    if (first.ano === last.ano) {
      return `${biWeeks.length} bi-semanas (${first.numero} a ${last.numero}/${first.ano})`;
    }

    return `${biWeeks.length} bi-semanas (${first.bi_week_id} a ${last.bi_week_id})`;
  }
}

export default BiWeekHelpers;
