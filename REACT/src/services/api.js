// src/services/api.js
// Compatibilidade para imports antigos. A camada real de HTTP vive em apiClient.js
// e os serviços específicos ficam nos arquivos deste diretório.

export { default } from './apiClient';
export { default as apiClient } from './apiClient';
export * from './authService';
export * from './regiaoService';
export * from './placaService';
export * from './clienteService';
export * from './aluguelService';
export * from './adminService';
export * from './userService';
export * from './empresaService';
export * from './relatorioService';
export * from './piService';
export * from './contratoService';
export * from './queueService';
export * from './biWeekService';
export * from './whatsappService';
export * from './auditService';
