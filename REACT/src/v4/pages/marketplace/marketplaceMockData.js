export const marketplaceStateOptionsV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Sem dados' },
  { value: 'error', label: 'Com falha' }
];

export const marketplaceCategoryOptionsV4 = [
  { value: 'todas', label: 'Todas as categorias' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'operations', label: 'Operação' },
  { value: 'security', label: 'Segurança' },
  { value: 'integrations', label: 'Integrações' }
];

export const marketplaceStatusOptionsV4 = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'installed', label: 'Instalado' },
  { value: 'available', label: 'Disponível' },
  { value: 'beta', label: 'Beta' },
  { value: 'locked', label: 'Bloqueado' }
];

export const marketplaceHeaderV4 = {
  title: 'Marketplace v4',
  subtitle: 'Catálogo de módulos, integrações e capacidades',
  description: 'Ambiente visual isolado para avaliar capacidades do produto sem instalar, remover ou ativar módulos reais.'
};

export const marketplaceKpisV4 = [
  { id: 'modules', label: 'Módulos catalogados', value: '24', change: '+3 sugeridos', trend: 'up' },
  { id: 'installed', label: 'Instalados', value: '9', change: '37% do catálogo', trend: 'neutral' },
  { id: 'capabilities', label: 'Capacidades ativas', value: '41', change: '+6 no trimestre', trend: 'up' },
  { id: 'pending', label: 'Pendentes', value: '5', change: '2 dependências', trend: 'down' },
  { id: 'beta', label: 'Em beta', value: '4', change: 'avaliação visual', trend: 'neutral' },
  { id: 'risk', label: 'Risco médio', value: 'Baixo', change: 'sem mutação real', trend: 'up' }
];

export const marketplaceModulesV4 = [
  {
    id: 'mod-bi',
    category: 'analytics',
    name: 'BI Executivo',
    description: 'Painel consolidado para acompanhamento de receita, ocupação e performance operacional.',
    status: 'installed',
    statusTone: 'success',
    owner: 'Analytics',
    capabilities: ['dashboards', 'rankings', 'exportação']
  },
  {
    id: 'mod-approvals',
    category: 'commercial',
    name: 'Aprovações Comerciais',
    description: 'Fluxos visuais de aprovação para propostas, descontos e contratos.',
    status: 'available',
    statusTone: 'info',
    owner: 'Comercial',
    capabilities: ['workflow', 'regras', 'auditoria']
  },
  {
    id: 'mod-field',
    category: 'operations',
    name: 'Operação de Campo',
    description: 'Checklist, ocorrências e status de manutenção para ativos de mídia.',
    status: 'beta',
    statusTone: 'warning',
    owner: 'Operações',
    capabilities: ['checklists', 'incidentes', 'SLA']
  },
  {
    id: 'mod-sso',
    category: 'security',
    name: 'SSO Corporativo',
    description: 'Federação de identidade e políticas avançadas de acesso administrativo.',
    status: 'locked',
    statusTone: 'error',
    owner: 'TI',
    capabilities: ['SAML', 'SCIM', 'MFA']
  },
  {
    id: 'mod-webhooks',
    category: 'integrations',
    name: 'Webhooks Avançados',
    description: 'Entregas observaveis, retentativas e assinatura visual de eventos.',
    status: 'installed',
    statusTone: 'success',
    owner: 'Integrações',
    capabilities: ['eventos', 'retry', 'seguranca']
  },
  {
    id: 'mod-forecast',
    category: 'analytics',
    name: 'Forecast de Inventário',
    description: 'Projeção visual de ocupação e disponibilidade por carteira comercial.',
    status: 'available',
    statusTone: 'info',
    owner: 'Planejamento',
    capabilities: ['forecast', 'ocupação', 'cenários']
  }
];

export const marketplaceDependenciesV4 = [
  { id: 'dep-rbac', module: 'SSO Corporativo', dependency: 'Modelo RBAC v4', state: 'pendente', status: 'warning' },
  { id: 'dep-api', module: 'Webhooks Avançados', dependency: 'Integrações e API', state: 'instalado', status: 'success' },
  { id: 'dep-bi', module: 'Forecast de Inventário', dependency: 'BI Executivo', state: 'instalado', status: 'success' },
  { id: 'dep-audit', module: 'Aprovações Comerciais', dependency: 'Auditoria Operacional', state: 'necessário', status: 'info' }
];

export const marketplaceRecommendationsV4 = [
  { id: 'rec-forecast', title: 'Ativar Forecast de Inventário', detail: 'Boa aderência com relatórios e mapa v4.', impact: 'alto', status: 'info' },
  { id: 'rec-approvals', title: 'Avaliar Aprovações Comerciais', detail: 'Reduz fricção visual no fluxo de propostas.', impact: 'medio', status: 'success' },
  { id: 'rec-sso', title: 'Preparar SSO Corporativo', detail: 'Depende de revisão RBAC antes de qualquer rollout real.', impact: 'alto', status: 'warning' }
];

export const marketplaceActivityRowsV4 = [
  { id: 'act-001', time: '2026-05-19 10:05', module: 'Webhooks Avançados', action: 'Status revisado no protótipo', actor: 'Integrações', status: 'success' },
  { id: 'act-002', time: '2026-05-19 09:47', module: 'SSO Corporativo', action: 'Dependência RBAC sinalizada', actor: 'TI', status: 'warning' },
  { id: 'act-003', time: '2026-05-18 17:25', module: 'Forecast de Inventário', action: 'Recomendação adicionada', actor: 'Planejamento', status: 'info' },
  { id: 'act-004', time: '2026-05-18 15:12', module: 'BI Executivo', action: 'Capacidade marcada como instalada', actor: 'Analytics', status: 'success' }
];
