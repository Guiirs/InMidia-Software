/**
 * Period Service - Types & Validators
 * Tipos, enums e validações de período
 */

export enum PeriodType {
  BI_WEEK = 'bi-week',
  CUSTOM = 'custom',
  MONTHLY = 'monthly'
}

export interface PeriodInput {
  periodType?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  biWeekIds?: string[];
  biWeeks?: any[];
  // Formato antigo (compatibilidade)
  data_inicio?: Date | string;
  data_fim?: Date | string;
  bi_week_ids?: string[];
  bi_weeks?: any[];
}

export interface NormalizedPeriod {
  periodType: PeriodType;
  startDate?: Date | string;
  endDate?: Date | string;
  biWeekIds: string[];
  biWeeks: any[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida dados de período
 */
export function validatePeriod(period: NormalizedPeriod): ValidationResult {
  const errors: string[] = [];

  if (!period.periodType) {
    errors.push('periodType é obrigatório');
  }

  if (period.periodType === PeriodType.BI_WEEK) {
    if (!period.biWeekIds || period.biWeekIds.length === 0) {
      errors.push('biWeekIds é obrigatório para períodos do tipo bi-week');
    }
  }

  if (period.periodType === PeriodType.CUSTOM) {
    if (!period.startDate) {
      errors.push('startDate é obrigatório para períodos customizados');
    }
    if (!period.endDate) {
      errors.push('endDate é obrigatório para períodos customizados');
    }
    
    if (period.startDate && period.endDate) {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      if (start > end) {
        errors.push('startDate deve ser anterior a endDate');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normaliza entrada de período (converte formato antigo para novo)
 */
export function normalizePeriodInput(input: PeriodInput): NormalizedPeriod {
  const hasBiWeeks = (input.bi_week_ids && input.bi_week_ids.length > 0) ||
                     (input.biWeekIds && input.biWeekIds.length > 0) ||
                     (input.bi_weeks && input.bi_weeks.length > 0) ||
                     (input.biWeeks && input.biWeeks.length > 0);

  return {
    periodType: input.periodType as PeriodType || (hasBiWeeks ? PeriodType.BI_WEEK : PeriodType.CUSTOM),
    startDate: input.startDate || input.data_inicio,
    endDate: input.endDate || input.data_fim,
    biWeekIds: input.biWeekIds || input.bi_week_ids || [],
    biWeeks: input.biWeeks || input.bi_weeks || []
  };
}
