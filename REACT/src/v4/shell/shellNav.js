import { pageRegistryV4 } from '../pages/pageRegistry';

const NAV_GROUP_ORDER = ['operacao', 'administracao', 'diagnostico'];

const NAV_GROUP_META = {
  operacao: { groupId: 'operacao', groupLabel: 'Operação' },
  administracao: { groupId: 'administracao', groupLabel: 'Administração' },
  diagnostico: { groupId: 'diagnostico', groupLabel: 'Diagnóstico' }
};

const NAV_CONFIG_BY_PAGE = {
  dashboard: {
    groupId: 'operacao',
    label: 'Dashboard Operacional',
    context: 'Acompanhe indicadores de campo e eventos recentes.',
    integrationKey: 'dashboard.read'
  },
  boards: {
    groupId: 'operacao',
    label: 'Placas',
    context: 'Visual de cards para leitura operacional por status.',
    integrationKey: 'placas.read'
  },
  inventory: {
    groupId: 'operacao',
    label: 'Inventário de Placas',
    context: 'Monitore disponibilidade, ocupação e pendências do inventário.',
    integrationKey: 'placas.read'
  },
  map: {
    groupId: 'operacao',
    label: 'Mapa de Cobertura',
    context: 'Visualize clusters simulados e distribuição geográfica dos ativos.',
    integrationKey: 'placas.read'
  },
  reports: {
    groupId: 'operacao',
    label: 'Relatórios Executivos',
    context: 'Acompanhe performance operacional e indicadores consolidados.',
    integrationKey: 'analytics.read'
  },
  proposals: {
    groupId: 'operacao',
    label: 'Propostas',
    context: 'Gerencie pipeline comercial e aprovações de propostas.',
    integrationKey: 'proposals.read'
  },
  contracts: {
    groupId: 'operacao',
    label: 'Contratos',
    context: 'Monitore vencimentos, renovações e situação financeira.',
    integrationKey: 'contracts.read'
  },
  users: {
    groupId: 'administracao',
    label: 'Usuários',
    context: 'Prototipe governança de usuários, perfis e permissões.',
    integrationKey: 'admin.users'
  },
  settings: {
    groupId: 'administracao',
    label: 'Configurações',
    context: 'Organize dados da empresa, preferências, canais e marca.',
    integrationKey: 'empresa.settings'
  },
  integrations: {
    groupId: 'administracao',
    label: 'Integrações',
    context: 'Acompanhe chaves, webhooks e conectores operacionais.',
    integrationKey: 'empresa.api'
  },
  marketplace: {
    groupId: 'administracao',
    label: 'Marketplace',
    context: 'Explore módulos, integrações e capacidades disponíveis.',
    integrationKey: 'marketplace.read'
  },
  audit: {
    groupId: 'diagnostico',
    label: 'Auditoria',
    context: 'Rastreie eventos críticos e trilhas de governança.',
    integrationKey: 'audit.read'
  },
  health: {
    groupId: 'diagnostico',
    label: 'Saúde da Sincronização',
    context: 'Observe estabilidade do stream e fila de eventos.',
    integrationKey: 'sync.diagnostics'
  }
};

function buildShellNavFromRegistry() {
  const groupedItems = {
    operacao: [],
    administracao: [],
    diagnostico: []
  };

  for (const page of pageRegistryV4) {
    const navConfig = NAV_CONFIG_BY_PAGE[page.id];
    if (!navConfig) {
      continue;
    }

    groupedItems[navConfig.groupId].push({
      id: page.id,
      label: navConfig.label,
      context: navConfig.context,
      futureRoute: page.futureRoute,
      integrationKey: navConfig.integrationKey
    });
  }

  return NAV_GROUP_ORDER
    .map((groupId) => ({
      ...NAV_GROUP_META[groupId],
      items: groupedItems[groupId]
    }))
    .filter((group) => group.items.length > 0);
}

export const shellNavV4 = buildShellNavFromRegistry();
