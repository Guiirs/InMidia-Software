/**
 * Period Service - Main Entry Point
 * Serviço centralizado para gestão de períodos (bi-weeks e custom)
 */

import logger from '../../container/logger';
import AppError from '../../container/AppError';
import { PeriodType, validatePeriod, normalizePeriodInput, PeriodInput, NormalizedPeriod } from './period.types';
import { calculateDatesFromBiWeeks, checkBiWeekAlignment, findBiWeekByDate } from './period.biweek';
import { periodsOverlap, calculateDurationInDays, formatDate, convertOldFormatToNew } from './period.utils';

class PeriodService {
  /**
   * Processa dados de período de entrada e retorna formato padronizado
   * Suporta ambos os formatos: antigo (bi_week_ids/data_inicio) e novo (periodType/startDate)
   */
  static async processPeriodInput(input: PeriodInput): Promise<NormalizedPeriod> {
    logger.debug('[PeriodService] Processando input de período');
    logger.debug('[PeriodService] Input recebido:', JSON.stringify(input));

    // Normalizar entrada (converte formato antigo para novo)
    const normalized = normalizePeriodInput(input);

    // Se for bi-week e não tem datas, calcular das bi-weeks
    if (normalized.periodType === PeriodType.BI_WEEK && normalized.biWeekIds && normalized.biWeekIds.length > 0) {
      logger.debug('[PeriodService] Antes de calcular bi-weeks:', {
        startDate: normalized.startDate,
        endDate: normalized.endDate
      });
      
      const biWeekData = await calculateDatesFromBiWeeks(normalized.biWeekIds);
      
      logger.debug('[PeriodService] BiWeekData recebido:', {
        startDate: biWeekData.startDate,
        endDate: biWeekData.endDate
      });
      
      // IMPORTANTE: Só sobrescrever se as datas não existirem
      if (!normalized.startDate) {
        normalized.startDate = biWeekData.startDate;
      }
      if (!normalized.endDate) {
        normalized.endDate = biWeekData.endDate;
      }
      normalized.biWeeks = biWeekData.biWeeks;
      
      logger.debug('[PeriodService] Depois de mesclar:', {
        startDate: normalized.startDate,
        endDate: normalized.endDate
      });
    }

    // Se for custom e tem datas, validar se alinha com bi-weeks (opcional - avisar usuário)
    if (normalized.periodType === PeriodType.CUSTOM && normalized.startDate && normalized.endDate) {
      const alignment = await checkBiWeekAlignment(normalized.startDate, normalized.endDate);
      if (!alignment.aligned) {
        logger.warn('[PeriodService] Período customizado não alinha com bi-semanas', {
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          suggestion: alignment.suggestion
        });
      }
    }

    // Validar período final
    const validation = validatePeriod(normalized);
    if (!validation.valid) {
      throw new AppError(`Período inválido: ${validation.errors.join(', ')}`, 400);
    }

    logger.info('[PeriodService] Período processado com sucesso', {
      periodType: normalized.periodType,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      biWeekIds: normalized.biWeekIds
    });

    return normalized;
  }

  // Re-exportar funções de submódulos
  static calculateDatesFromBiWeeks = calculateDatesFromBiWeeks;
  static checkBiWeekAlignment = checkBiWeekAlignment;
  static findBiWeekByDate = findBiWeekByDate;
  static periodsOverlap = periodsOverlap;
  static calculateDurationInDays = calculateDurationInDays;
  static formatDate = formatDate;
  static convertOldFormatToNew = convertOldFormatToNew;
}

export default PeriodService;
