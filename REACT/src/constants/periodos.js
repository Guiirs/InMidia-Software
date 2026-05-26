// src/constants/periodos.js
/**
 * Constantes para tipos de período
 * Centraliza as strings mágicas usadas no sistema
 */

export const PERIOD_TYPES = {
    QUINZENAL: 'quinzenal',
    MENSAL: 'mensal',
    BIMESTRAL: 'bimestral',
    SEMESTRAL: 'semestral',
    ANUAL: 'anual',
    OUTRO: 'outro',
    // Aliases para compatibilidade
    BI_WEEK: 'bi-week',
    CUSTOM: 'custom',
    CUSTOMIZADO: 'customizado'
};

export const PERIOD_LABELS = {
    [PERIOD_TYPES.QUINZENAL]: 'Quinzenal (15 dias)',
    [PERIOD_TYPES.MENSAL]: 'Mensal (30 dias)',
    [PERIOD_TYPES.BIMESTRAL]: 'Bimestral (60 dias)',
    [PERIOD_TYPES.SEMESTRAL]: 'Semestral (6 meses)',
    [PERIOD_TYPES.ANUAL]: 'Anual (12 meses)',
    [PERIOD_TYPES.OUTRO]: 'Outro (Manual)',
};

/**
 * Calcula número de dias para cada tipo de período
 */
export const PERIOD_DURATIONS = {
    [PERIOD_TYPES.QUINZENAL]: 15,
    [PERIOD_TYPES.MENSAL]: 30,
    [PERIOD_TYPES.BIMESTRAL]: 60,
    [PERIOD_TYPES.SEMESTRAL]: 180,
    [PERIOD_TYPES.ANUAL]: 365,
};

/**
 * Helper para verificar se é um período válido
 * @param {string} tipo - Tipo de período
 * @returns {boolean}
 */
export const isValidPeriodType = (tipo) => {
    return Object.values(PERIOD_TYPES).includes(tipo);
};
