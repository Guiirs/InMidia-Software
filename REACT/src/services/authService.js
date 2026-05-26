// src/services/authService.js
/**
 * Serviço de Autenticação
 * Suporta arquitetura híbrida: HttpOnly cookies (nova) + Bearer localStorage (legado transitório).
 */

import apiClient from './apiClient';

/**
 * Registra uma nova empresa
 */
export const registerEmpresa = async (empresaData) => {
    const response = await apiClient.post('/empresas/register', empresaData, { isPublic: true });
    return response.data;
};

/**
 * Faz login do usuário.
 * O backend agora seta HttpOnly cookies (inmidia_access + inmidia_refresh).
 * Também retorna token no body para compatibilidade transitória com Bearer legado.
 */
export const loginUser = async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password }, { isPublic: true });
    const payload = response.data;
    return payload?.data || payload;
};

/**
 * Renova o access token via refresh token.
 * O cookie inmidia_refresh é enviado automaticamente (HttpOnly, withCredentials).
 * Retorna o novo token para atualizar o Bearer legado transitoriamente.
 */
export const refreshAccessToken = async () => {
    const response = await apiClient.post('/auth/refresh', {}, { isPublic: true, _skipAuthRefresh: true });
    const payload = response.data;
    return payload?.data?.token || null;
};

/**
 * Faz logout do usuário.
 * Revoga a sessão no servidor e limpa os cookies HttpOnly.
 */
export const logoutUser = async () => {
    try {
        await apiClient.post('/auth/logout', {}, { isPublic: true });
    } catch {
        // Ignora erros — garante logout local mesmo se API falhar
    }
};

/**
 * Solicita reset de senha
 */
export const requestPasswordReset = async (email) => {
    const response = await apiClient.post('/auth/forgot-password', { email }, { isPublic: true });
    return response.data;
};

/**
 * Reseta a senha com token
 */
export const resetPassword = async (token, newPassword) => {
    const response = await apiClient.post(
        `/auth/reset-password/${encodeURIComponent(token)}`,
        { password: newPassword },
        { isPublic: true }
    );
    return response.data;
};

/**
 * Lista sessões ativas do usuário autenticado
 */
export const getActiveSessions = async () => {
    const response = await apiClient.get('/auth/sessions');
    return response.data;
};

/**
 * Encerra todas as sessões do usuário (logout global)
 */
export const logoutAllSessions = async () => {
    const response = await apiClient.post('/auth/logout-all');
    return response.data;
};
