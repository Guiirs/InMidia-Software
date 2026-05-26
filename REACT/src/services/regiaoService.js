// src/services/regiaoService.js
/**
 * Serviço de Regiões
 * Responsável por: CRUD Regiões
 * Normalização delegada ao regiaoAdapter.
 */

import apiClient from './apiClient';
import { normalizeRegioes } from '../adapters/regiaoAdapter';

/**
 * Busca todas as regiões
 * @returns {Promise<import('../contracts').RegiaoCanonica[]>}
 */
export const fetchRegioes = async () => {
    const response = await apiClient.get('/regioes');
    return normalizeRegioes(response.data);
};

/**
 * Cria nova região
 * @param {Object} data - Dados da região
 * @returns {Promise<Object>} Região criada
 */
export const createRegiao = async (data) => {
    const response = await apiClient.post('/regioes', data);
    return response.data;
};

/**
 * Atualiza região existente
 * @param {string} id - ID da região
 * @param {Object} data - Dados atualizados
 * @returns {Promise<Object>} Região atualizada
 */
export const updateRegiao = async (id, data) => {
    const response = await apiClient.put(`/regioes/${id}`, data);
    return response.data;
};

/**
 * Deleta região
 * @param {string} id - ID da região
 * @returns {Promise<void>}
 */
export const deleteRegiao = async (id) => {
    await apiClient.delete(`/regioes/${id}`);
};
