export { NAVIGATION_GROUPS, NAV_ITEM_ID, NAV_GROUP, findNavItem } from '../foundation/navigation.js';

export const ROUTE_MAP = {
  dashboard: '/app/v4/dashboard',
  operacoes: '/app/v4/operacoes',
  inventario: '/app/v4/inventario',
  comercial: '/app/v4/comercial',
  contratos: '/app/v4/contratos',
  relatorios: '/app/v4/relatorios',
  regioes: '/app/v4/regioes',
  campanhas: '/app/v4/campanhas',
  alertas: '/app/v4/alertas',
  atividade: '/app/v4/atividade',
};

export const LEGACY_TO_V4_ROUTE_MAP = {
  '/dashboard': '/app/v4/dashboard',
  '/placas': '/app/v4/inventario',
  '/contratos': '/app/v4/contratos',
  '/relatorios': '/app/v4/relatorios',
  '/alertas': '/app/v4/alertas',
  '/mapa': '/app/v4/regioes',
};

export const NAV_TOPBAR_CONTEXT = {
  dashboard: 'Centro operacional com atualizacao automatica',
  operacoes: 'Monitoramento de pontos e atividades em campo',
  inventario: 'Gestao de pontos, placas e disponibilidade de inventario',
  comercial: 'Pipeline, receita e inteligencia comercial',
  contratos: 'Contratos ativos, vencimentos e renovacoes',
  relatorios: 'Analytics executivos e relatorios de desempenho',
  regioes: 'Cobertura geografica e distribuicao de inventario',
  campanhas: 'Campanhas em veiculacao e agendamentos',
  alertas: 'Central de alertas e notificacoes operacionais',
  atividade: 'Historico de atividade e auditoria do sistema',
};

export function getRoute(navId) {
  return ROUTE_MAP[navId] ?? '/app/v4/dashboard';
}

export function getLegacyRedirect(legacyPath) {
  return LEGACY_TO_V4_ROUTE_MAP[legacyPath] ?? null;
}
