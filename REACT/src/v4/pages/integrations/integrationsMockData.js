export const integrationsStateOptionsV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Sem dados' },
  { value: 'error', label: 'Com falha' }
];

export const integrationsScopeOptionsV4 = [
  { value: 'todos', label: 'Todos os segmentos' },
  { value: 'api', label: 'Chaves e API' },
  { value: 'webhooks', label: 'Webhooks' },
  { value: 'connectors', label: 'Conectores' },
  { value: 'security', label: 'Segurança' },
  { value: 'limits', label: 'Limites e uso' }
];

export const integrationsStatusOptionsV4 = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'success', label: 'Saudável' },
  { value: 'info', label: 'Monitorado' },
  { value: 'warning', label: 'Atenção' },
  { value: 'error', label: 'Falha' }
];

export const integrationsHeaderV4 = {
  title: 'Integrações e API v4',
  subtitle: 'Chaves, webhooks e conectores operacionais',
  description: 'Painel técnico isolado para validar governança de integrações sem revelar tokens, rotacionar chaves ou chamar APIs reais.'
};

export const integrationsKpisV4 = [
  { id: 'uptime', label: 'Disponibilidade mock', value: '99,92%', change: '+0,04 p.p.', trend: 'up' },
  { id: 'requests', label: 'Requisições 24h', value: '84,2k', change: 'limite visual', trend: 'neutral' },
  { id: 'keys', label: 'Chaves ativas', value: '4', change: '1 expira em 14 dias', trend: 'down' },
  { id: 'webhooks', label: 'Webhooks ativos', value: '8', change: '2 com retry', trend: 'neutral' },
  { id: 'connectors', label: 'Conectores', value: '6/7', change: '1 em atenção', trend: 'down' },
  { id: 'rotation', label: 'Rotação média', value: '58 dias', change: 'política cumprida', trend: 'up' }
];

export const integrationsApiKeysV4 = [
  {
    id: 'key-prod',
    scope: 'api',
    name: 'Producao operacional',
    owner: 'Backoffice',
    maskedKey: 'im_live_**** **** **** 91f2',
    lastUsed: '2026-05-19 09:51',
    expiresIn: '14 dias',
    status: 'warning'
  },
  {
    id: 'key-bi',
    scope: 'api',
    name: 'BI executivo',
    owner: 'Analytics',
    maskedKey: 'im_live_**** **** **** b8a4',
    lastUsed: '2026-05-19 08:30',
    expiresIn: '62 dias',
    status: 'success'
  },
  {
    id: 'key-sandbox',
    scope: 'api',
    name: 'Sandbox homologação',
    owner: 'TI',
    maskedKey: 'im_test_**** **** **** 44c1',
    lastUsed: '2026-05-18 16:12',
    expiresIn: 'sem vencimento',
    status: 'info'
  }
];

export const integrationsWebhooksV4 = [
  { id: 'wh-contracts', scope: 'webhooks', endpoint: '/webhooks/contracts', event: 'contract.updated', retries: '0,4%', latency: '182ms', status: 'success' },
  { id: 'wh-boards', scope: 'webhooks', endpoint: '/webhooks/boards', event: 'board.availability', retries: '1,8%', latency: '246ms', status: 'info' },
  { id: 'wh-proposals', scope: 'webhooks', endpoint: '/webhooks/proposals', event: 'proposal.stage_changed', retries: '4,1%', latency: '391ms', status: 'warning' },
  { id: 'wh-sync', scope: 'webhooks', endpoint: '/webhooks/sync', event: 'sync.degraded', retries: '0,9%', latency: '218ms', status: 'success' }
];

export const integrationsConnectorsV4 = [
  { id: 'conn-whatsapp', scope: 'connectors', name: 'WhatsApp comercial', owner: 'Atendimento', health: 'Conectado', status: 'success' },
  { id: 'conn-email', scope: 'connectors', name: 'Email transacional', owner: 'Operações', health: 'Fila estavel', status: 'success' },
  { id: 'conn-map', scope: 'connectors', name: 'Mapa e geocodificação', owner: 'Inventario', health: 'Somente visual', status: 'info' },
  { id: 'conn-marketplace', scope: 'connectors', name: 'Marketplace', owner: 'Comercial', health: 'Credencial a revisar', status: 'warning' },
  { id: 'conn-erp', scope: 'connectors', name: 'ERP financeiro', owner: 'Financeiro', health: 'Falha simulada', status: 'error' }
];

export const integrationsSecurityRotationV4 = [
  { id: 'policy-rotation', scope: 'security', label: 'Rotação obrigatória', value: '90 dias para chaves live', status: 'success' },
  { id: 'policy-scope', scope: 'security', label: 'Escopos mínimos', value: 'Leitura por módulo e escrita bloqueada no protótipo', status: 'info' },
  { id: 'policy-secret', scope: 'security', label: 'Segredos mascarados', value: 'Nenhum token real exibido', status: 'success' },
  { id: 'policy-alert', scope: 'security', label: 'Alertas de uso anômalo', value: 'Monitoramento visual em atenção', status: 'warning' }
];

export const integrationsUsageLimitsV4 = [
  { id: 'requests-min', scope: 'limits', label: 'Requisições por minuto', used: 68, value: '6.800 / 10.000', status: 'info' },
  { id: 'webhook-delivery', scope: 'limits', label: 'Entregas de webhook', used: 42, value: '42k / 100k', status: 'success' },
  { id: 'storage-events', scope: 'limits', label: 'Retenção de eventos', used: 76, value: '137 / 180 dias', status: 'warning' },
  { id: 'connectors-quota', scope: 'limits', label: 'Cota de conectores', used: 86, value: '6 / 7 conectores', status: 'warning' }
];

export const integrationsEventRowsV4 = [
  {
    id: 'evt-001',
    time: '2026-05-19 09:56',
    source: 'API',
    event: 'api.key.used',
    detail: 'Chave BI executivo usada em consulta agregada.',
    status: 'success'
  },
  {
    id: 'evt-002',
    time: '2026-05-19 09:41',
    source: 'Webhook',
    event: 'proposal.stage_changed',
    detail: 'Entrega com retry visual apos latencia elevada.',
    status: 'warning'
  },
  {
    id: 'evt-003',
    time: '2026-05-19 09:18',
    source: 'Connector',
    event: 'erp.connection_failed',
    detail: 'Falha simulada em conector financeiro.',
    status: 'error'
  },
  {
    id: 'evt-004',
    time: '2026-05-19 08:52',
    source: 'Security',
    event: 'secret.rotation.previewed',
    detail: 'Rotação visual conferida sem persistência real.',
    status: 'info'
  },
  {
    id: 'evt-005',
    time: '2026-05-18 18:36',
    source: 'Webhook',
    event: 'contract.updated',
    detail: 'Entrega mock processada dentro do SLA.',
    status: 'success'
  }
];
