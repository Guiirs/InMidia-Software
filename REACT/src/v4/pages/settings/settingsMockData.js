export const settingsStateOptionsV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Sem dados' },
  { value: 'error', label: 'Com falha' }
];

export const settingsScopeOptionsV4 = [
  { value: 'todos', label: 'Todos os blocos' },
  { value: 'empresa', label: 'Dados da empresa' },
  { value: 'operacao', label: 'Operação' },
  { value: 'integracoes', label: 'Canais e integrações' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'marca', label: 'Identidade visual' }
];

export const settingsHeaderV4 = {
  title: 'Configurações da Empresa v4',
  subtitle: 'Preferências administrativas e operacionais',
  description: 'Painel isolado para validar organização de dados, marca, canais e segurança sem salvar configurações reais.'
};

export const settingsKpisV4 = [
  { id: 'empresa', label: 'Perfil da empresa', value: '94%', change: 'cadastro revisado', trend: 'up' },
  { id: 'operacao', label: 'Preferências ativas', value: '12', change: '3 críticas', trend: 'neutral' },
  { id: 'integracoes', label: 'Canais configurados', value: '7', change: '2 em atenção', trend: 'down' },
  { id: 'seguranca', label: 'Políticas aplicadas', value: '9/10', change: 'MFA exigido', trend: 'up' },
  { id: 'marca', label: 'Kit visual', value: 'Completo', change: 'atualizado hoje', trend: 'up' },
  { id: 'auditoria', label: 'Eventos recentes', value: '38', change: 'últimos 7 dias', trend: 'neutral' }
];

export const settingsCompanyCardsV4 = [
  { id: 'legal-name', scope: 'empresa', label: 'Razão social', value: 'InMidia Comunicação Visual Ltda.', status: 'success', detail: 'Cadastro principal validado para simulação.' },
  { id: 'document', scope: 'empresa', label: 'Documento fiscal', value: '00.000.000/0001-00', status: 'default', detail: 'Valor fictício usado apenas no protótipo.' },
  { id: 'timezone', scope: 'operacao', label: 'Fuso operacional', value: 'America/Sao_Paulo', status: 'info', detail: 'Padrão visual para agendas e trilhas.' },
  { id: 'billing', scope: 'empresa', label: 'Centro financeiro', value: 'Matriz comercial', status: 'warning', detail: 'Revisão pendente de contato de cobrança.' }
];

export const settingsOperationalPreferencesV4 = [
  { id: 'calendar', scope: 'operacao', label: 'Calendário comercial', value: 'Segunda a sexta, 08:00-18:00', status: 'success' },
  { id: 'approval', scope: 'operacao', label: 'Aprovação de propostas', value: 'Duas etapas internas', status: 'info' },
  { id: 'inventory', scope: 'operacao', label: 'Reserva de placas', value: 'Bloqueio visual por 48h', status: 'warning' },
  { id: 'reports', scope: 'operacao', label: 'Relatórios executivos', value: 'Envio semanal simulado', status: 'default' }
];

export const settingsIntegrationsV4 = [
  { id: 'whatsapp', scope: 'integracoes', channel: 'WhatsApp comercial', owner: 'Atendimento', health: 'monitorado', status: 'success' },
  { id: 'email', scope: 'integracoes', channel: 'Email transacional', owner: 'Operações', health: 'ativo', status: 'success' },
  { id: 'maps', scope: 'integracoes', channel: 'Mapa e geocodificação', owner: 'Inventário', health: 'somente visual', status: 'info' },
  { id: 'webhooks', scope: 'integracoes', channel: 'Webhooks internos', owner: 'TI', health: 'pendente', status: 'warning' }
];

export const settingsSecurityAccessV4 = [
  { id: 'mfa', scope: 'seguranca', label: 'MFA obrigatório', value: 'Administradores e gestores', status: 'success' },
  { id: 'session', scope: 'seguranca', label: 'Sessão administrativa', value: 'Expira em 8 horas', status: 'info' },
  { id: 'audit', scope: 'seguranca', label: 'Auditoria de alterações', value: 'Retenção visual de 180 dias', status: 'success' },
  { id: 'rbac', scope: 'seguranca', label: 'Modelo de acesso', value: 'Perfis e permissões simulados', status: 'warning' }
];

export const settingsBrandIdentityV4 = [
  { id: 'primary', scope: 'marca', label: 'Cor primária', value: '#2563eb', swatch: '#2563eb' },
  { id: 'accent', scope: 'marca', label: 'Cor de destaque', value: '#14b8a6', swatch: '#14b8a6' },
  { id: 'logo', scope: 'marca', label: 'Logo operacional', value: 'Versão horizontal validada', swatch: '#f8fafc' },
  { id: 'voice', scope: 'marca', label: 'Tom de comunicação', value: 'Corporativo, direto e comercial', swatch: '#64748b' }
];

export const settingsActivityRowsV4 = [
  {
    id: 'cfg-001',
    area: 'Segurança',
    action: 'Politica MFA revisada',
    actor: 'Admin visual',
    status: 'success',
    occurredAt: '2026-05-19 09:35'
  },
  {
    id: 'cfg-002',
    area: 'Integrações',
    action: 'Canal WhatsApp marcado para revisão',
    actor: 'Operação mock',
    status: 'warning',
    occurredAt: '2026-05-19 08:48'
  },
  {
    id: 'cfg-003',
    area: 'Empresa',
    action: 'Dados fiscais conferidos no protótipo',
    actor: 'Backoffice',
    status: 'info',
    occurredAt: '2026-05-18 17:20'
  },
  {
    id: 'cfg-004',
    area: 'Marca',
    action: 'Paleta institucional sincronizada visualmente',
    actor: 'Design ops',
    status: 'success',
    occurredAt: '2026-05-18 15:05'
  }
];
