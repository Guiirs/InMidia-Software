export interface PrivateApiMount {
  path: string;
  module: string;
  description: string;
}

export const PRIVATE_API_FORBIDDEN_PREFIXES = [
  '/public',
  '/api/public',
  '/api/v1/public',
  '/public/v1',
] as const;

export const PRIVATE_API_SENSITIVE_RESPONSE_KEYS = [
  'password',
  'senha',
  'hash',
  'token',
  'refreshToken',
  'accessToken',
  'apiKey',
  'secret',
  'r2Key',
] as const;

export const PRIVATE_API_MOUNTS: readonly PrivateApiMount[] = [
  { path: '/user', module: 'users', description: 'Usuario autenticado e perfil' },
  { path: '/users', module: 'users', description: 'Gestao de usuarios internos' },
  { path: '/empresas', module: 'empresas', description: 'Gestao multi-tenant de empresas' },
  { path: '/empresa', module: 'empresas', description: 'Alias legado singular de empresas' },
  { path: '/admin', module: 'admin', description: 'Administracao interna' },
  { path: '/audit', module: 'audit', description: 'Auditoria interna por tenant' },
  { path: '/placas', module: 'placas', description: 'Inventario legado de placas' },
  { path: '/regioes', module: 'regioes', description: 'Regioes legadas' },
  { path: '/clientes', module: 'clientes', description: 'Clientes legados' },
  { path: '/alugueis', module: 'alugueis', description: 'Alugueis legados' },
  { path: '/pis', module: 'propostas-internas', description: 'Propostas internas' },
  { path: '/contratos', module: 'contratos', description: 'Contratos formais legados' },
  { path: '/bi-weeks', module: 'biweeks', description: 'Periodos e quinzenas' },
  { path: '/webhooks', module: 'webhooks', description: 'Webhooks internos autenticados' },
  { path: '/whatsapp', module: 'whatsapp', description: 'Integracao WhatsApp interna' },
  { path: '/relatorios', module: 'relatorios', description: 'Relatorios legados' },
  { path: '/dashboard', module: 'dashboard', description: 'Dashboard legado' },
  { path: '/inventory', module: 'inventory-v4', description: 'Inventario operacional V4' },
  { path: '/contracts', module: 'contracts-v4', description: 'Contratos operacionais V4' },
  { path: '/boards', module: 'board-contracts-v4', description: 'Contratos por placa V4' },
  { path: '/session', module: 'auth-v4', description: 'Sessao autenticada V4' },
  { path: '/temporal', module: 'temporal-v4', description: 'Engine temporal' },
  { path: '/regions', module: 'regions-v4', description: 'Regioes V4' },
  { path: '/clients', module: 'clients-v4', description: 'Clientes V4' },
  { path: '/media', module: 'media-v4', description: 'Media Core privado' },
  { path: '/features', module: 'features-v4', description: 'Feature flags internas' },
  { path: '/alerts', module: 'alerts-v4', description: 'Alertas internos' },
  { path: '/operations', module: 'operations-v4', description: 'Operacoes internas' },
  { path: '/commercial', module: 'commercial-v4', description: 'Pipeline comercial interno' },
  { path: '/reports', module: 'reports-v4', description: 'Relatorios V4' },
  { path: '/activity', module: 'activity-v4', description: 'Atividade interna' },
  { path: '/campaigns', module: 'campaigns-v4', description: 'Campanhas internas' },
  { path: '/realtime', module: 'realtime-v4', description: 'Realtime interno' },
  { path: '/system', module: 'system-v4', description: 'Sistema e observabilidade internas' },
  { path: '/checking', module: 'checking', description: 'Health checks internos' },
  { path: '/diagnostics', module: 'diagnostics', description: 'Diagnosticos internos' },
  { path: '/commercial-projection', module: 'commercial-projection-v4', description: 'Projecao comercial canonica' },
  { path: '/queue', module: 'queue', description: 'Fila de jobs interna' },
  { path: '/sse', module: 'sse', description: 'SSE interno legado' },
  { path: '/sync', module: 'sync', description: 'Sync operacional interno' },
  { path: '/enterprise-bi', module: 'enterprise-bi', description: 'BI interno' },
  { path: '/exports', module: 'export', description: 'Exportacoes internas' },
  { path: '/marketplace', module: 'marketplace', description: 'Marketplace interno' },
  { path: '/rbac', module: 'rbac', description: 'RBAC interno' },
] as const;

export function isPublicPathForbiddenInPrivateApi(path: string): boolean {
  return PRIVATE_API_FORBIDDEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
