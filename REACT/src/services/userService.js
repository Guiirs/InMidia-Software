// src/services/userService.js
/**
 * Serviço de Usuário
 * Responsável por: Perfil do usuário, Empresa
 */

import apiClient from './apiClient';

/**
 * Busca dados do usuário atual
 * @returns {Promise<Object>} Dados do usuário
 */
export const fetchUserData = async () => {
    const response = await apiClient.get('/user/me');
    return response.data;
};

/**
 * Atualiza dados do usuário
 * @param {Object} data - Dados atualizados
 * @returns {Promise<Object>} Usuário atualizado
 */
export const updateUserData = async (data) => {
    const response = await apiClient.put('/user/me', data);
    return response.data;
};

/**
 * Busca dados da empresa do usuário
 * @returns {Promise<Object>} Dados da empresa
 */
export const fetchEmpresaData = async () => {
    const response = await apiClient.get('/user/me/empresa');
    return response.data;
};

/**
 * Regenera API Key da empresa
 * @param {string} password - Senha do usuário para confirmação
 * @returns {Promise<Object>} Nova API Key
 */
export const regenerateApiKey = async (password) => {
    const response = await apiClient.post('/user/me/empresa/regenerate-api-key', { password });
    return response.data;
};
