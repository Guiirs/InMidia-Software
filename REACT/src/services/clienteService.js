// src/services/clienteService.js
/**
 * Serviço de Clientes
 * Responsável por: CRUD Clientes
 */

import apiClient from './apiClient';

/**
 * Busca clientes com filtros
 * @param {URLSearchParams} params - Parâmetros de busca
 * @returns {Promise<Object>} Lista de clientes
 */
export const fetchClientes = async (params) => {
    const response = await apiClient.get(`/clientes?${params.toString()}`);
    return response.data;
};

/**
 * Cria novo cliente
 * @param {Object} clienteData - Dados do cliente
 * @returns {Promise<Object>} Cliente criado
 */
export const createCliente = async (clienteData) => {
    const response = await apiClient.post('/clientes', clienteData);
    return response.data;
};

/**
 * Atualiza cliente existente
 * @param {string} id - ID do cliente
 * @param {Object} clienteData - Dados atualizados
 * @returns {Promise<Object>} Cliente atualizado
 */
export const updateCliente = async (id, clienteData) => {
    const response = await apiClient.put(`/clientes/${id}`, clienteData);
    return response.data;
};

/**
 * Deleta cliente
 * @param {string} id - ID do cliente
 * @returns {Promise<void>}
 */
export const deleteCliente = async (id) => {
    await apiClient.delete(`/clientes/${id}`);
};

