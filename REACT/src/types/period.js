/**
 * TIPOS E FUNÇÕES PARA SISTEMA DE PERÍODOS UNIFICADO - FRONTEND
 * 
 * Este arquivo define types, enums e helpers para trabalhar com períodos no frontend.
 * Sincronizado com o backend (BECKEND/utils/periodTypes.js)
 */

/**
 * Enum de tipos de período
 * @readonly
 * @enum {string}
 */
export const PeriodType = {
    BI_WEEK: 'bi-week',
    CUSTOM: 'custom'
};

/**
 * Labels amigáveis para tipos de período
 * @readonly
 */
export const PeriodTypeLabels = {
    [PeriodType.BI_WEEK]: 'Quinzenal (Bi-Semana)',
    [PeriodType.CUSTOM]: 'Personalizado'
};

/**
 * @typedef {Object} Period
 * @property {'bi-week'|'custom'} periodType - Tipo do período
 * @property {string} startDate - Data de início (ISO string)
 * @property {string} endDate - Data de fim (ISO string)
 * @property {string[]} [biWeekIds] - IDs de bi-semanas (apenas para bi-week)
 * @property {string[]} [biWeeks] - Referências de bi-semanas (apenas para bi-week)
 */

/**
 * Valida se um tipo de período é válido
 * @param {string} type - Tipo de período
 * @returns {boolean}
 */
export const isValidPeriodType = (type) => {
    return Object.values(PeriodType).includes(type);
};

/**
 * Valida dados de período
 * @param {Period} periodData - Dados do período
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validatePeriod = (periodData) => {
    const errors = [];

    if (!periodData) {
        errors.push('Dados de período não fornecidos');
        return { valid: false, errors };
    }

    // Validar tipo
    if (!isValidPeriodType(periodData.periodType)) {
        errors.push(`Tipo de período inválido: ${periodData.periodType}`);
    }

    // Validar datas
    if (!periodData.startDate) {
        errors.push('Data de início é obrigatória');
    }
    if (!periodData.endDate) {
        errors.push('Data de fim é obrigatória');
    }

    if (periodData.startDate && periodData.endDate) {
        const start = new Date(periodData.startDate);
        const end = new Date(periodData.endDate);

        if (isNaN(start.getTime())) {
            errors.push('Data de início inválida');
        }
        if (isNaN(end.getTime())) {
            errors.push('Data de fim inválida');
        }

        if (start >= end) {
            errors.push('Data de início deve ser anterior à data de fim');
        }
    }

    // Validar bi-week específico
    if (periodData.periodType === PeriodType.BI_WEEK) {
        if (!periodData.biWeekIds || periodData.biWeekIds.length === 0) {
            errors.push('Selecione pelo menos uma bi-semana');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Formata período para exibição
 * @param {Period} period - Objeto com dados de período
 * @returns {string} - String formatada
 */
export const formatPeriodDisplay = (period) => {
    if (!period) return 'Período não definido';

    const formatDate = (date) => {
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

/**
 * Converte formato antigo para novo
 * @param {Object} oldFormat - Formato antigo com data_inicio/data_fim ou bi_week_ids
 * @returns {Period} - Formato novo padronizado
 */
export const convertOldFormatToNew = (oldFormat) => {
    if (!oldFormat) return null;

    const hasBiWeeks = (oldFormat.bi_week_ids && oldFormat.bi_week_ids.length > 0) ||
                       (oldFormat.bi_weeks && oldFormat.bi_weeks.length > 0);

    return {
        periodType: hasBiWeeks ? PeriodType.BI_WEEK : PeriodType.CUSTOM,
        startDate: oldFormat.data_inicio || oldFormat.startDate || '',
        endDate: oldFormat.data_fim || oldFormat.endDate || '',
        biWeekIds: oldFormat.bi_week_ids || oldFormat.biWeekIds || [],
        biWeeks: oldFormat.bi_weeks || oldFormat.biWeeks || []
    };
};

/**
 * Converte formato novo para formato antigo (para compatibilidade com API antiga)
 * @param {Period} newFormat - Formato novo
 * @returns {Object} - Formato antigo com data_inicio/data_fim
 */
export const convertNewFormatToOld = (newFormat) => {
    if (!newFormat) return null;

    const old = {
        data_inicio: newFormat.startDate,
        data_fim: newFormat.endDate
    };

    if (newFormat.periodType === PeriodType.BI_WEEK && newFormat.biWeekIds) {
        old.bi_week_ids = newFormat.biWeekIds;
        old.bi_weeks = newFormat.biWeeks || [];
    }

    return old;
};

/**
 * Calcula duração em dias de um período
 * @param {string} startDate - Data de início (ISO string)
 * @param {string} endDate - Data de fim (ISO string)
 * @returns {number} - Número de dias
 */
export const calculateDurationInDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o último dia
};

/**
 * Cria um período vazio/padrão
 * @param {'bi-week'|'custom'} [type='custom'] - Tipo do período
 * @returns {Period}
 */
export const createEmptyPeriod = (type = PeriodType.CUSTOM) => {
    const today = new Date().toISOString().split('T')[0];
    return {
        periodType: type,
        startDate: today,
        endDate: today,
        biWeekIds: [],
        biWeeks: []
    };
};

/**
 * Verifica se dois períodos se sobrepõem
 * @param {Period} period1 
 * @param {Period} period2 
 * @returns {boolean}
 */
export const periodsOverlap = (period1, period2) => {
    const start1 = new Date(period1.startDate);
    const end1 = new Date(period1.endDate);
    const start2 = new Date(period2.startDate);
    const end2 = new Date(period2.endDate);

    return start1 < end2 && start2 < end1;
};
