// src/services/index.js
/**
 * Exportação centralizada de todos os serviços
 * Permite imports simplificados: import { loginUser, fetchPlacas } from '@/services'
 */

// Auth
export * from './authService';

// User & Empresa
export * from './userService';
export * from './empresaService';

// Entidades principais
export * from './placaService';
export * from './clienteService';
export * from './regiaoService';
export * from './piService';
export * from './contratoService';
export * from './aluguelService';

// Relatórios
export * from './relatorioService';
export * from './dashboardService';

// Admin
export * from './adminService';
export * from './auditService';

// Queue
export * from './queueService';

// Cliente HTTP base
export { default as apiClient } from './apiClient';
