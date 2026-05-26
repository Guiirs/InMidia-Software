// src/services/adminService.js
/**
 * Serviço de Administração
 * Responsável por: Gestão de usuários (admin only)
 */

import apiClient from './apiClient';

/**
 * Busca todos os usuários (admin)
 * @returns {Promise<Object>} Lista de usuários
 */
export const fetchAllUsers = async () => {
    const response = await apiClient.get('/admin/users');
    return response.data;
};

/**
 * Atualiza role de um usuário (admin)
 * @param {string} id - ID do usuário
 * @param {string} role - Nova role
 * @returns {Promise<Object>} Usuário atualizado
 */
export const updateUserRole = async (id, role) => {
    const response = await apiClient.put(`/admin/users/${id}/role`, { role });
    return response.data;
};

/**
 * Deleta um usuário (admin)
 * @param {string} id - ID do usuário
 * @returns {Promise<void>}
 */
export const deleteUser = async (id) => {
    await apiClient.delete(`/admin/users/${id}`);
};

/**
 * Cria novo usuário (admin)
 * @param {Object} userData - Dados do usuário
 * @returns {Promise<Object>} Usuário criado
 */
export const createUser = async (userData) => {
    const response = await apiClient.post('/admin/users', userData);
    return response.data;
};
