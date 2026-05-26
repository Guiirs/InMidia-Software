// services/biWeekService.js
import apiClient from './apiClient'; // ✅ CORREÇÃO: Usar apiClient ao invés de api

/**
 * Service para gerenciar Bi-Semanas (períodos de 14 dias)
 * Numeradas de 2 em 2: 02, 04, 06... 52 (26 bi-semanas por ano)
 */

/**
 * Busca todo o calendário de Bi-Semanas
 * @param {Object} filters - { ano, ativo }
 * @returns {Promise<Array>}
 */
export const fetchBiWeeksCalendar = async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.ano) {
        params.append('ano', filters.ano);
    }
    
    if (filters.ativo !== undefined) {
        params.append('ativo', filters.ativo);
    }
    
    const { data } = await apiClient.get(`/bi-weeks/calendar?${params.toString()}`);
    return data.data; // Array de Bi-Semanas
};

/**
 * Busca os anos disponíveis no calendário
 * @returns {Promise<Array<number>>}
 */
export const fetchAvailableYears = async () => {
    const { data } = await apiClient.get('/bi-weeks/years');
    return data.data;
};

/**
 * Busca uma Bi-Semana por ID
 * @param {string} id - ObjectId ou bi_week_id
 * @returns {Promise<Object>}
 */
export const fetchBiWeekById = async (id) => {
    const { data } = await apiClient.get(`/bi-weeks/${id}`);
    return data.data;
};

/**
 * Cria uma nova Bi-Semana
 * @param {Object} biWeekData - { bi_week_id, ano, numero, start_date, end_date, descricao }
 * @returns {Promise<Object>}
 */
export const createBiWeek = async (biWeekData) => {
    const { data } = await apiClient.post('/bi-weeks', biWeekData);
    return data.data;
};

/**
 * Atualiza uma Bi-Semana existente
 * @param {string} id - ObjectId ou bi_week_id
 * @param {Object} updateData - Campos a atualizar
 * @returns {Promise<Object>}
 */
export const updateBiWeek = async (id, updateData) => {
    const { data } = await apiClient.put(`/bi-weeks/${id}`, updateData);
    return data.data;
};

/**
 * Deleta uma Bi-Semana
 * @param {string} id - ObjectId ou bi_week_id
 * @returns {Promise<void>}
 */
export const deleteBiWeek = async (id) => {
    await apiClient.delete(`/bi-weeks/${id}`);
};

/**
 * Gera automaticamente o calendário para um ano
 * @param {Object} params - { ano, overwrite, start_date }
 * @returns {Promise<Object>} - { created, skipped, total, message }
 */
export const generateCalendar = async ({ ano, overwrite = false, start_date = null }) => {
    const payload = { ano, overwrite };
    
    if (start_date) {
        payload.start_date = start_date;
    }
    
    const { data } = await apiClient.post('/bi-weeks/generate', payload);
    return data;
};

/**
 * Valida se um período está alinhado com Bi-Semanas
 * @param {string} startDate - Data de início (YYYY-MM-DD)
 * @param {string} endDate - Data de fim (YYYY-MM-DD)
 * @returns {Promise<Object>} - { valid, message, biWeeks, suggestion }
 */
export const validatePeriod = async (startDate, endDate) => {
    const { data } = await apiClient.post('/bi-weeks/validate', {
        start_date: startDate,
        end_date: endDate
    });
    return data;
};

/**
 * Busca a Bi-Semana que contém uma data específica
 * @param {string} date - Data a buscar (YYYY-MM-DD)
 * @returns {Promise<Object|null>}
 */
export const findBiWeekByDate = async (date) => {
    try {
        const { data } = await apiClient.get(`/bi-weeks/find-by-date?date=${date}`);
        return data.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
};
