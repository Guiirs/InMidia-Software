export const NAV_GROUP = {
  PRINCIPAL: 'principal',
  COMERCIAL: 'comercial',
  GESTAO: 'gestao',
};

export const NAV_ITEM_ID = {
  DASHBOARD:    'dashboard',
  OPERACOES:    'operacoes',
  INVENTARIO:   'inventario',
  REGIOES_MGMT: 'regioes-mgmt',
  REGIOES:      'regioes',
  COMERCIAL:    'comercial',
  CONTRATOS:    'contratos',
  RELATORIOS:   'relatorios',
  CAMPANHAS:    'campanhas',
  ALERTAS:      'alertas',
  ATIVIDADE:    'atividade',
  EMPRESA:      'empresa',
};

/* Camadas de complexidade da navegação.
   operational: rotina diária (todos os usuários)
   managerial:  visão gerencial (admin_empresa, superadmin)
   diagnostic:  auditoria e saúde técnica (superadmin)
*/
export const NAV_LAYER = {
  OPERATIONAL: 'operational',
  MANAGERIAL:  'managerial',
  DIAGNOSTIC:  'diagnostic',
};

/* Hierarquia de papéis para comparação de acesso mínimo.
   Alinhado com ROLES em src/auth/permissions.js. */
export const ROLE_RANK = {
  visualizador:  1,
  vendedor:      1,
  financeiro:    1,
  operador:      1,
  gestor:        2,
  admin_empresa: 2,
  superadmin:    3,
};

export const NAVIGATION_GROUPS = [
  {
    id: NAV_GROUP.PRINCIPAL,
    label: 'Operação',
    items: [
      {
        id: NAV_ITEM_ID.DASHBOARD,
        label: 'Dashboard',
        icon: 'grid_view',
        description: 'Visao geral operacional do sistema',
        group: NAV_GROUP.PRINCIPAL,
        layer: NAV_LAYER.OPERATIONAL,
        minRole: 'operador',
        badge: null,
        available: true,
        permission: 'dashboard.read',
      },
      {
        id: NAV_ITEM_ID.OPERACOES,
        label: 'Operações',
        icon: 'display_settings',
        description: 'Monitoramento de pontos e atividades em campo',
        group: NAV_GROUP.PRINCIPAL,
        layer: NAV_LAYER.OPERATIONAL,
        minRole: 'operador',
        badge: null,
        available: true,
        permission: 'operations.read',
      },
      {
        id: NAV_ITEM_ID.INVENTARIO,
        label: 'Inventário',
        icon: 'inventory_2',
        description: 'Gestão de placas, pontos e disponibilidade',
        group: NAV_GROUP.PRINCIPAL,
        layer: NAV_LAYER.OPERATIONAL,
        minRole: 'operador',
        badge: null,
        available: true,
        permission: 'inventory.read',
      },
      {
        id: NAV_ITEM_ID.REGIOES_MGMT,
        label: 'Regiões',
        icon: 'hub',
        description: 'Gestão territorial de regiões, placas e operação regional',
        group: NAV_GROUP.PRINCIPAL,
        layer: NAV_LAYER.OPERATIONAL,
        minRole: 'operador',
        badge: null,
        available: true,
        permission: 'regions.read',
      },
      {
        id: NAV_ITEM_ID.REGIOES,
        label: 'Mapa',
        icon: 'map',
        description: 'Visualização territorial e distribuição geográfica do inventário',
        group: NAV_GROUP.PRINCIPAL,
        layer: NAV_LAYER.OPERATIONAL,
        minRole: 'operador',
        badge: null,
        available: true,
        permission: 'inventory.read',
      },
    ],
  },
  {
    id: NAV_GROUP.COMERCIAL,
    label: 'Comercial',
    items: [
      {
        id: NAV_ITEM_ID.COMERCIAL,
        label: 'Comercial',
        icon: 'trending_up',
        description: 'Receita, ocupacao e desempenho comercial',
        group: NAV_GROUP.COMERCIAL,
        layer: NAV_LAYER.MANAGERIAL,
        minRole: 'admin_empresa',
        badge: null,
        available: true,
        permission: 'commercial.read',
      },
      {
        id: NAV_ITEM_ID.CONTRATOS,
        label: 'Contratos',
        icon: 'description',
        description: 'Contratos ativos, vencimentos e renovacoes',
        group: NAV_GROUP.COMERCIAL,
        layer: NAV_LAYER.MANAGERIAL,
        minRole: 'admin_empresa',
        badge: null,
        available: true,
        permission: 'contracts.read',
      },
      {
        id: NAV_ITEM_ID.CAMPANHAS,
        label: 'Campanhas',
        icon: 'campaign',
        description: 'Campanhas em veiculacao e agendamentos',
        group: NAV_GROUP.COMERCIAL,
        layer: NAV_LAYER.OPERATIONAL,
        minRole: 'operador',
        badge: null,
        available: true,
        permission: 'campaigns.read',
      },
    ],
  },
  {
    id: NAV_GROUP.GESTAO,
    label: 'Gestão',
    items: [
      {
        id: NAV_ITEM_ID.RELATORIOS,
        label: 'Relatórios',
        icon: 'bar_chart',
        description: 'Relatórios gerenciais e análises de desempenho',
        group: NAV_GROUP.GESTAO,
        layer: NAV_LAYER.MANAGERIAL,
        minRole: 'admin_empresa',
        badge: null,
        available: true,
        permission: 'reports.read',
      },
      {
        id: NAV_ITEM_ID.ALERTAS,
        label: 'Alertas',
        icon: 'notifications_active',
        description: 'Central de alertas e notificações operacionais',
        group: NAV_GROUP.GESTAO,
        layer: NAV_LAYER.OPERATIONAL,
        minRole: 'operador',
        badge: null,
        available: true,
        permission: 'alerts.read',
      },
      {
        id: NAV_ITEM_ID.ATIVIDADE,
        label: 'Atividade',
        icon: 'timeline',
        description: 'Histórico de atividade e auditoria do sistema',
        group: NAV_GROUP.GESTAO,
        layer: NAV_LAYER.DIAGNOSTIC,
        minRole: 'superadmin',
        badge: null,
        available: true,
        permission: 'activity.read',
      },
    ],
  },
];

export function findNavItem(id) {
  for (const group of NAVIGATION_GROUPS) {
    const found = group.items.find(item => item.id === id);
    if (found) return found;
  }
  return null;
}

export function getNavContext(id) {
  return findNavItem(id)?.description ?? 'Painel operacional V4';
}

/* Retorna true se o papel do usuário atende ao mínimo exigido pelo item. */
export function meetsMinRole(userRole, minRole) {
  if (!minRole) return true;
  const userRank = ROLE_RANK[userRole] ?? 1;
  const minRank  = ROLE_RANK[minRole]  ?? 1;
  return userRank >= minRank;
}
