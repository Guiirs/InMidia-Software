// src/services/aluguelService.js
/**
 * Serviço de Aluguéis
 * Responsável por: CRUD Aluguéis
 */

import apiClient from './apiClient';

const normalizeAlugueisPayload = (payload) => {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
            ? payload.data
            : [];

    return list.map((aluguel) => ({
        ...aluguel,
        id: aluguel.id || aluguel._id,
        data_inicio: aluguel.data_inicio || aluguel.startDate,
        data_fim: aluguel.data_fim || aluguel.endDate,
    }));
};

/**
 * Cria novo aluguel
 * @param {Object} aluguelData - Dados do aluguel
 * @returns {Promise<Object>} Aluguel criado
 */
export const createAluguel = async (aluguelData) => {
    const response = await apiClient.post('/alugueis', aluguelData);
    return response.data;
};

/**
 * Deleta aluguel
 * @param {string} aluguelId - ID do aluguel
 * @returns {Promise<void>}
 */
export const deleteAluguel = async (aluguelId) => {
    await apiClient.delete(`/alugueis/${aluguelId}`);
};

/**
 * Busca aluguéis por placa
 * @param {string} placaId - ID da placa
 * @returns {Promise<Object>} Lista de aluguéis
 */
export const fetchAlugueisByPlaca = async (placaId) => {
    const response = await apiClient.get(`/alugueis/placa/${placaId}`);
    return normalizeAlugueisPayload(response.data);
};
