export const OPERATIONAL_STATE_PROVIDER_CONTRACT = {
  name: 'OperationalStateProvider',
  version: '2.0',
  provides: {
    globalState: 'OPERATIONAL_STATE enum value',
    stateMeta: '{ id, label, description, color, ... }',
    modules: 'Array<{ id, label, status, latencyMs, message }>',
    alerts: 'Array<Alert>',
    unreadCount: 'number',
    lastSyncLabel: 'string',
    markAlertRead: '(alertId: string) => void',
    markAllRead: '() => void',
    refreshReadiness: '() => Promise<void>',
  },
  dataSource: 'GET /api/v4/system/readiness + Sync Core alerts + V4 realtime state',
  fallback: 'none',
};

export const THEME_PROVIDER_CONTRACT = {
  name: 'V4ThemeProvider',
  version: '1.0',
  provides: {
    density: '"compact" | "default" | "relaxed"',
    setDensity: '(density: string) => void',
    sidebarCollapsed: 'boolean',
    toggleSidebar: '() => void',
    theme: '"dark" | "light"',
  },
  dataSource: 'localStorage + user preferences API',
  fallback: 'production defaults',
};

export const AUTH_PROVIDER_CONTRACT = {
  name: 'V4AuthProvider',
  version: '2.0',
  provides: {
    user: '{ id, name, role, tenantId, permissions }',
    isLoading: 'boolean',
    logout: '() => void',
    hasPermission: '(permission: string) => boolean',
  },
  dataSource: 'GET /api/v4/auth/session via Sync Core users.session',
  fallback: 'none',
};

export const DATA_PROVIDER_CONTRACT_TEMPLATE = {
  dashboard: {
    name: 'DashboardDataProvider',
    refreshInterval: 30000,
    provides: ['kpis', 'overview', 'activity', 'performance', 'alertsSummary'],
    endpoints: ['GET /api/v4/dashboard/kpis', 'GET /api/v4/dashboard/overview'],
  },
  inventory: {
    name: 'InventoryDataProvider',
    refreshInterval: 60000,
    provides: ['boards', 'summary', 'regions'],
    endpoints: ['GET /api/v4/inventory/boards', 'GET /api/v4/inventory/summary', 'GET /api/v4/inventory/regions'],
  },
  operations: {
    name: 'OperationsDataProvider',
    refreshInterval: 15000,
    provides: ['timeline', 'summary', 'tasks', 'pending', 'byDomain'],
    endpoints: ['GET /api/v4/operations/timeline', 'GET /api/v4/operations/summary'],
  },
};

export function validateProviderContract(provider, contract) {
  const missing = Object.keys(contract.provides).filter(key => !(key in provider));
  return {
    valid: missing.length === 0,
    missing,
    message: missing.length === 0
      ? `Provider "${contract.name}" esta em conformidade com o contrato.`
      : `Provider "${contract.name}" nao implementa: ${missing.join(', ')}`,
  };
}
