// src/services/placaService.js
/**
 * Serviço de Placas
 * Responsável por: CRUD Placas, Locations, Disponibilidade
 * Normalização delegada ao placaAdapter — não duplicar lógica aqui.
 */

import apiClient from './apiClient';
import { normalizePlaca, normalizePlacasPayload, normalizePlacaLocationsPayload } from '../adapters/placaAdapter';

export const PLACA_COMMERCIAL_FIELDS = [
    'cliente',
    'clienteId',
    'cliente_id',
    'contrato',
    'contratoId',
    'contrato_id',
    'aluguel',
    'aluguelId',
    'aluguel_id',
    'valor',
    'valor_mensal',
    'valorMensal',
    'valorContratacao',
    'periodo',
    'period',
    'dataInicio',
    'data_inicio',
    'startDate',
    'dataFim',
    'data_fim',
    'endDate',
];

export const sanitizePlacaPayload = (payload) => {
    if (payload instanceof FormData) {
        const sanitized = new FormData();
        payload.forEach((value, key) => {
            if (!PLACA_COMMERCIAL_FIELDS.includes(key)) {
                sanitized.append(key, value);
            }
        });
        return sanitized;
    }

    if (payload && typeof payload === 'object') {
        return Object.fromEntries(
            Object.entries(payload).filter(([key]) => !PLACA_COMMERCIAL_FIELDS.includes(key))
        );
    }

    return payload;
};

/**
 * Busca placas com filtros
 * @param {URLSearchParams} params - Parâmetros de busca
 * @returns {Promise<Object>} Lista de placas paginada
 */
export const fetchPlacas = async (params) => {
    const response = await apiClient.get(`/placas?${params.toString()}`);
    return normalizePlacasPayload(response.data);
};

/**
 * Busca placa por ID
 * @param {string} id - ID da placa
 * @returns {Promise<Object>} Dados da placa
 */
export const fetchPlacaById = async (id) => {
    const response = await apiClient.get(`/placas/${id}`);
    return normalizePlaca(response.data?.data || response.data);
};

/**
 * Cria nova placa
 * @param {FormData} formData - Dados da placa
 * @returns {Promise<Object>} Placa criada
 */
export const addPlaca = async (formData) => {
    const response = await apiClient.post('/placas', sanitizePlacaPayload(formData));
    return response.data;
};

/**
 * Atualiza placa existente
 * @param {string} id - ID da placa
 * @param {FormData} formData - Dados atualizados
 * @returns {Promise<Object>} Placa atualizada
 */
export const updatePlaca = async (id, formData) => {
    const response = await apiClient.put(`/placas/${id}`, sanitizePlacaPayload(formData));
    return response.data;
};

/**
 * Deleta placa
 * @param {string} id - ID da placa
 * @returns {Promise<void>}
 */
export const deletePlaca = async (id) => {
    await apiClient.delete(`/placas/${id}`);
};

/**
 * Toggle disponibilidade da placa
 * @param {string} id - ID da placa
 * @returns {Promise<Object>} Placa atualizada
 */
export const togglePlacaDisponibilidade = async (id) => {
    const response = await apiClient.patch(`/placas/${id}/disponibilidade`);
    return normalizePlaca(response.data?.data || response.data);
};

/**
 * Busca localizações de todas as placas
 * @returns {Promise<Object>} Lista de localizações
 */
export const fetchPlacaLocations = async () => {
    const response = await apiClient.get('/placas/locations');
    return normalizePlacaLocationsPayload(response.data);
};

/**
 * Busca placas disponíveis em um período
 * @param {URLSearchParams} params - Parâmetros (dataInicio, dataFim, piId, search, regiao)
 * @returns {Promise<Object>} Lista de placas disponíveis
 */
export const fetchPlacasDisponiveis = async (params) => {
    const response = await apiClient.get(`/placas/disponiveis?${params.toString()}`);
    return normalizePlacasPayload(response.data);
};

/**
 * Reorganiza a numeração visual das placas
 * @param {{ items: Array<{ placaId: string, numeroOperacional: number }> }} payload
 * @returns {Promise<Object>} Resultado com lista organizada
 */
export const reorderPlacas = async (payload) => {
    const response = await apiClient.patch('/placas/reorder', payload);
    return {
        ...response.data,
        data: normalizePlacasPayload(response.data?.data ?? []).data,
    };
};

// ─── Aliases canônicos ────────────────────────────────────────────────────────

/** Alias semântico de addPlaca */
export const createPlaca = addPlaca;

/** Alias semântico de fetchPlacaById */
export const getPlacaById = fetchPlacaById;

// ─── Plate Core Registry V4.1 ─────────────────────────────────────────────────

/**
 * Faz upload de imagem adicional para a placa
 * @param {string} id - ID da placa
 * @param {File} file - Arquivo de imagem
 * @param {{ category?: string, setAsMain?: boolean }} options
 */
export const uploadPlacaImage = async (id, file, options = {}) => {
    const formData = new FormData();
    formData.append('imagem', file);
    if (options.category) formData.append('category', options.category);
    if (options.setAsMain != null) formData.append('setAsMain', String(options.setAsMain));
    const response = await apiClient.post(`/placas/${id}/images`, formData);
    return response.data;
};

/**
 * Retorna o health score da placa (score, status, issues)
 * @param {string} id - ID da placa
 * @returns {Promise<{ score: number, status: string, issues: string[] }>}
 */
export const getPlacaHealth = async (id) => {
    const response = await apiClient.get(`/placas/${id}/health`);
    return response.data?.data ?? response.data;
};

/**
 * Retorna a timeline temporal da placa (reservations, events)
 * @param {string} id - ID da placa
 */
export const getPlacaTimeline = async (id) => {
    const response = await apiClient.get(`/placas/${id}/timeline`);
    return response.data?.data ?? response.data;
};

/**
 * Verifica disponibilidade da placa em um período
 * @param {string} id - ID da placa
 * @param {{ startDate: string, endDate: string }} params
 */
export const getPlacaAvailability = async (id, params) => {
    const response = await apiClient.get(`/placas/${id}/availability`, { params });
    return response.data?.data ?? response.data;
};

/**
 * Arquiva (soft delete) uma placa
 * @param {string} id - ID da placa
 * @param {{ reason?: string }} data
 */
export const archivePlaca = async (id, data = {}) => {
    const response = await apiClient.post(`/placas/${id}/archive`, data);
    return normalizePlaca(response.data?.data ?? response.data);
};

/**
 * Restaura uma placa arquivada
 * @param {string} id - ID da placa
 */
export const restorePlaca = async (id) => {
    const response = await apiClient.post(`/placas/${id}/restore`);
    return normalizePlaca(response.data?.data ?? response.data);
};
