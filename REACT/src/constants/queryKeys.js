// src/constants/queryKeys.js
/**
 * Constantes de Query Keys para React Query
 * Padronização centralizada para evitar inconsistências e facilitar invalidação de cache
 */

export const QUERY_KEYS = {
  // Empresa
  empresa: {
    all: ['empresa'], // Prefixo base
    details: ['empresa', 'details'], // Detalhes da empresa (nome, CNPJ, endereço, etc.)
    apiKey: ['empresa', 'apiKey'], // API Key e prefixo
  },

  // User
  user: {
    all: ['user'],
    profile: ['user', 'profile'], // Perfil do usuário logado
  },

  // Placas
  placas: {
    all: ['placas'],
    list: (filters) => ['placas', 'list', filters], // Lista com filtros
    detail: (id) => ['placas', 'detail', id], // Detalhes de uma placa
    locations: ['placas', 'locations'], // Localizações para o mapa
    disponibilidade: (filters) => ['placas', 'disponibilidade', filters], // Placas disponíveis
  },

  // Clientes
  clientes: {
    all: ['clientes'],
    list: (filters) => ['clientes', 'list', filters],
    detail: (id) => ['clientes', 'detail', id],
  },

  // Regiões
  regioes: {
    all: ['regioes'],
    list: ['regioes', 'list'],
    detail: (id) => ['regioes', 'detail', id],
  },

  // PIs (Propostas Internas)
  pis: {
    all: ['pis'],
    list: (filters) => ['pis', 'list', filters],
    detail: (id) => ['pis', 'detail', id],
  },

  // Contratos
  contratos: {
    all: ['contratos'],
    list: (filters) => ['contratos', 'list', filters],
    detail: (id) => ['contratos', 'detail', id],
  },

  // Bi-Weeks
  biWeeks: {
    all: ['biWeeks'],
    calendar: (year) => ['biWeeks', 'calendar', year],
    current: ['biWeeks', 'current'],
  },

  // Admin
  admin: {
    users: ['admin', 'users'],
    user: (id) => ['admin', 'user', id],
  },

  // Alugueis
  alugueis: {
    all: ['alugueis'],
    byPlaca: (placaId) => ['alugueis', 'placa', placaId],
  },

  // Relatórios
  relatorios: {
    dashboard: ['relatorios', 'dashboard'],
  },
};

/**
 * Helper para invalidar todas as queries relacionadas a uma entidade
 * Exemplo: invalidateAllQueries(queryClient, QUERY_KEYS.empresa.all)
 */
export const invalidateAllQueries = (queryClient, baseKey) => {
  return queryClient.invalidateQueries({ queryKey: baseKey });
};

/**
 * Helper para remover queries específicas do cache
 */
export const removeQuery = (queryClient, queryKey) => {
  return queryClient.removeQueries({ queryKey });
};
