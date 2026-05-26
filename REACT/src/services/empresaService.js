// src/services/empresaService.js
/**
 * Serviço de Empresa
 * Responsável por: Detalhes da empresa (além das funções em userService)
 */

import apiClient from './apiClient';

/**
 * Busca detalhes da empresa (rota /empresa/details)
 * @returns {Promise<Object>} Dados da empresa
 */
export const getEmpresaDetails = async () => {
    const response = await apiClient.get('/empresa/details');
    return response.data;
};

/**
 * Atualiza detalhes da empresa
 * @param {Object} data - Dados atualizados
 * @returns {Promise<Object>} Empresa atualizada
 */
export const updateEmpresaDetails = async (data) => {
    const response = await apiClient.put('/empresa/details', data);
    return response.data;
};
