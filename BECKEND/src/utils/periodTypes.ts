/**
 * SISTEMA DE PERÍODOS UNIFICADO
 * 
 * Define tipos e constantes para o sistema de períodos padronizado.
 */

/**
 * Enum de tipos de período
 */
export enum PeriodType {
  BI_WEEK = 'bi-week',
  CUSTOM = 'custom',
}

/**
 * Interface para dados de período
 */
export interface IPeriodData {
  periodType: PeriodType;
  startDate: Date;
  endDate: Date;
  biWeekIds?: string[];
  biWeeks?: string[];
}

/**
 * Interface para resultado de validação
 */
export interface IPeriodValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Schema definition para embed em models
 */
export const PeriodSchemaDefinition = {
  periodType: {
    type: String,
    enum: Object.values(PeriodType),
    required: true as any,
    index: true,
  },
  startDate: {
    type: Date,
    required: true as any,
    index: true,
  },
  endDate: {
    type: Date,
    required: true as any,
    index: true,
  },
  biWeekIds: [{
    type: String,
    sparse: true,
  }],
  biWeeks: [{
    type: require('mongoose').Schema.Types.ObjectId,
    ref: 'BiWeek',
    sparse: true,
  }],
};

/**
 * Factory para criar schema de período
 */
export const createPeriodSchema = () => {
  return { ...PeriodSchemaDefinition };
};

/**
 * Valida se um tipo de período é válido
 */
export const isValidPeriodType = (type: string): type is PeriodType => {
  return Object.values(PeriodType).includes(type as PeriodType);
};

/**
 * Validador de período
 */
export const validatePeriod = (periodData: Partial<IPeriodData>): IPeriodValidation => {
  const errors: string[] = [];

  if (!periodData) {
    errors.push('Dados de período não fornecidos');
    return { valid: false, errors };
  }

  if (!isValidPeriodType(periodData.periodType || '')) {
    errors.push(
      `Tipo de período inválido. Use '${PeriodType.BI_WEEK}' ou '${PeriodType.CUSTOM}'`
    );
  }

  if (!periodData.startDate) {
    errors.push('startDate é obrigatório');
  }
  if (!periodData.endDate) {
    errors.push('endDate é obrigatório');
  }

  if (periodData.startDate && periodData.endDate) {
    const start = new Date(periodData.startDate);
    const end = new Date(periodData.endDate);

    if (isNaN(start.getTime())) {
      errors.push('startDate inválido');
    }
    if (isNaN(end.getTime())) {
      errors.push('endDate inválido');
    }

    if (start >= end) {
      errors.push('startDate deve ser anterior a endDate');
    }
  }

  if (periodData.periodType === PeriodType.BI_WEEK) {
    if (!periodData.biWeekIds || periodData.biWeekIds.length === 0) {
      errors.push('biWeekIds é obrigatório para períodos do tipo bi-week');
    } else {
      const biWeekIdRegex = /^\d{4}-\d{2}$/;
      periodData.biWeekIds.forEach((id) => {
        if (!biWeekIdRegex.test(id)) {
          errors.push(`biWeekId inválido: ${id}. Use formato YYYY-NN (ex: 2025-02)`);
        }
      });
    }
  }

  if (periodData.periodType === PeriodType.CUSTOM) {
    if (periodData.biWeekIds && periodData.biWeekIds.length > 0) {
      errors.push('biWeekIds não deve ser fornecido para períodos customizados');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const normalizePeriodInput = (input: any): Partial<IPeriodData> => {
  const normalized: Partial<IPeriodData> = {
    periodType: undefined,
    startDate: undefined,
    endDate: undefined,
    biWeekIds: undefined,
    biWeeks: undefined,
  };

  if (!input) {
    return normalized;
  }

  // Detectar periodType primeiro
  if (input.periodType) {
    normalized.periodType = input.periodType;
  } else if (input.tipoPeriodo === 'quinzenal' || input.bi_week_ids?.length > 0 || input.biWeekIds?.length > 0) {
    normalized.periodType = PeriodType.BI_WEEK;
  } else if (input.data_inicio || input.startDate) {
    normalized.periodType = PeriodType.CUSTOM;
  }

  // Detectar biWeekIds
  if (input.biWeekIds && input.biWeekIds.length > 0) {
    normalized.biWeekIds = input.biWeekIds;
  } else if (input.bi_week_ids && input.bi_week_ids.length > 0) {
    normalized.biWeekIds = input.bi_week_ids;
  }

  // Detectar biWeeks (ObjectIds)
  if (input.biWeeks && input.biWeeks.length > 0) {
    normalized.biWeeks = input.biWeeks;
  } else if (input.bi_weeks && input.bi_weeks.length > 0) {
    normalized.biWeeks = input.bi_weeks;
  }

  // Detectar startDate
  if (input.startDate) {
    normalized.startDate = new Date(input.startDate);
  } else if (input.data_inicio) {
    normalized.startDate = new Date(input.data_inicio);
  } else if (input.dataInicio) {
    normalized.startDate = new Date(input.dataInicio);
  }

  // Detectar endDate
  if (input.endDate) {
    normalized.endDate = new Date(input.endDate);
  } else if (input.data_fim) {
    normalized.endDate = new Date(input.data_fim);
  } else if (input.dataFim) {
    normalized.endDate = new Date(input.dataFim);
  }

  return normalized;
};

/**
 * Formata período para exibição
 */
export const formatPeriodDisplay = (period: Partial<IPeriodData>): string => {
  if (!period) return 'Período não definido';

  const formatDate = (date?: Date): string => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (period.periodType === PeriodType.BI_WEEK) {
    const biWeeks = period.biWeekIds ? period.biWeekIds.join(', ') : 'N/A';
    return `Quinzenal: ${biWeeks}`;
  } else if (period.periodType === PeriodType.CUSTOM) {
    return `Personalizado: ${formatDate(period.startDate)} - ${formatDate(period.endDate)}`;
  }

  return 'Tipo de período desconhecido';
};
