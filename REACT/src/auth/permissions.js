export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN_EMPRESA: 'admin_empresa',
  GESTOR: 'gestor',
  VENDEDOR: 'vendedor',
  FINANCEIRO: 'financeiro',
  VISUALIZADOR: 'visualizador',
};

export const PERMISSIONS = {
  // ── Legado ───────────────────────────────────────────────────────────────
  PLACAS_VIEW:      'placas.read',
  PLACAS_CREATE:    'placas.create',
  PLACAS_EDIT:      'placas.update',
  PLACAS_DELETE:    'placas.delete',
  DASHBOARD_VIEW:   'dashboard.read',
  RELATORIOS_VIEW:  'relatorios.read',
  PROPOSTAS_VIEW:   'propostas.read',
  PROPOSTAS_CREATE: 'propostas.create',
  PROPOSTAS_EDIT:   'propostas.update',
  CONTRATOS_VIEW:   'contratos.read',
  CONTRATOS_CREATE: 'contratos.create',
  CONTRATOS_APPROVE:'contratos.approve',
  ADMIN_ACCESS:     'admin.access',
  USERS_MANAGE:     'usuarios.manage',
  EMPRESAS_MANAGE:  'empresas.manage',
  SYNC_OPS_VIEW:    'sync.diagnostics',
  AUDIT_READ:       'audit.read',
  AUDIT_EXPORT:     'audit.export',
  // ── V4 — Inventory ───────────────────────────────────────────────────────
  INVENTORY_READ:   'inventory.read',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_DELETE: 'inventory.delete',
  // ── V4 — Contracts ───────────────────────────────────────────────────────
  CONTRACTS_READ:   'contracts.read',
  CONTRACTS_CREATE: 'contracts.create',
  CONTRACTS_UPDATE: 'contracts.update',
  CONTRACTS_CANCEL: 'contracts.cancel',
  CONTRACTS_RENEW:  'contracts.renew',
  CONTRACTS_DELETE: 'contracts.delete',
  // ── V4 — Commercial ──────────────────────────────────────────────────────
  COMMERCIAL_READ:    'commercial.read',
  COMMERCIAL_CREATE:  'commercial.create',
  COMMERCIAL_UPDATE:  'commercial.update',
  COMMERCIAL_DELETE:  'commercial.delete',
  COMMERCIAL_CONVERT: 'commercial.convert',
  // ── V4 — Alerts ──────────────────────────────────────────────────────────
  ALERTS_READ:    'alerts.read',
  ALERTS_UPDATE:  'alerts.update',
  ALERTS_RESOLVE: 'alerts.resolve',
  ALERTS_DISMISS: 'alerts.dismiss',
  ALERTS_CREATE:  'alerts.create',
  // ── V4 — Operations ──────────────────────────────────────────────────────
  OPERATIONS_READ:     'operations.read',
  OPERATIONS_CREATE:   'operations.create',
  OPERATIONS_UPDATE:   'operations.update',
  OPERATIONS_ASSIGN:   'operations.assign',
  OPERATIONS_COMPLETE: 'operations.complete',
  // ── V4 — Reports ─────────────────────────────────────────────────────────
  REPORTS_READ:     'reports.read',
  REPORTS_EXPORT:   'reports.export',
  REPORTS_SCHEDULE: 'reports.schedule',
  // ── V4 — Activity ────────────────────────────────────────────────────────
  ACTIVITY_READ:  'activity.read',
  ACTIVITY_WRITE: 'activity.write',
  // ── V4 — Campaigns ───────────────────────────────────────────────────────
  CAMPAIGNS_READ:   'campaigns.read',
  CAMPAIGNS_CREATE: 'campaigns.create',
  CAMPAIGNS_UPDATE: 'campaigns.update',
  CAMPAIGNS_DELETE: 'campaigns.delete',
  // ── V4 — Users & Settings ────────────────────────────────────────────────
  USERS_MANAGE_V4:   'users.manage',
  SETTINGS_MANAGE:   'settings.manage',
  // ── V4 — Regions ─────────────────────────────────────────────────────────
  REGIONS_READ:    'regions.read',
  REGIONS_CREATE:  'regions.create',
  REGIONS_UPDATE:  'regions.update',
  REGIONS_ARCHIVE: 'regions.archive',
  REGIONS_MANAGE:  'regions.manage',
  // ── V4 — System ──────────────────────────────────────────────────────────
  SYSTEM_READINESS: 'system.readiness',
  // ── V4 — Auth & Realtime ─────────────────────────────────────────────────
  AUTH_SESSION_READ: 'auth.session.read',
  REALTIME_READ:     'realtime.read',
  // ── V4.1 — Clients ───────────────────────────────────────────────────────
  CLIENTS_READ:    'clients.read',
  CLIENTS_CREATE:  'clients.create',
  CLIENTS_UPDATE:  'clients.update',
  CLIENTS_ARCHIVE: 'clients.archive',
};

export const LEGACY_ROLE_MAP = {
  superadmin:   ROLES.SUPERADMIN,
  admin_empresa:ROLES.ADMIN_EMPRESA,
  admin:        ROLES.ADMIN_EMPRESA,
  gestor:       ROLES.GESTOR,
  manager:      ROLES.GESTOR,
  vendedor:     ROLES.VENDEDOR,
  user:         ROLES.VENDEDOR,
  financeiro:   ROLES.FINANCEIRO,
  visualizador: ROLES.VISUALIZADOR,
  viewer:       ROLES.VISUALIZADOR,
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: ALL_PERMISSIONS,
  [ROLES.ADMIN_EMPRESA]: [
    PERMISSIONS.PLACAS_VIEW,
    PERMISSIONS.PLACAS_CREATE,
    PERMISSIONS.PLACAS_EDIT,
    PERMISSIONS.PLACAS_DELETE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.PROPOSTAS_VIEW,
    PERMISSIONS.PROPOSTAS_CREATE,
    PERMISSIONS.PROPOSTAS_EDIT,
    PERMISSIONS.CONTRATOS_VIEW,
    PERMISSIONS.CONTRATOS_CREATE,
    PERMISSIONS.CONTRATOS_APPROVE,
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SYNC_OPS_VIEW,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.AUDIT_EXPORT,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.CONTRACTS_CREATE,
    PERMISSIONS.CONTRACTS_UPDATE,
    PERMISSIONS.CONTRACTS_CANCEL,
    PERMISSIONS.CONTRACTS_RENEW,
    PERMISSIONS.CONTRACTS_DELETE,
    PERMISSIONS.COMMERCIAL_READ,
    PERMISSIONS.COMMERCIAL_CREATE,
    PERMISSIONS.COMMERCIAL_UPDATE,
    PERMISSIONS.COMMERCIAL_DELETE,
    PERMISSIONS.COMMERCIAL_CONVERT,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.ALERTS_UPDATE,
    PERMISSIONS.ALERTS_RESOLVE,
    PERMISSIONS.ALERTS_DISMISS,
    PERMISSIONS.ALERTS_CREATE,
    PERMISSIONS.OPERATIONS_READ,
    PERMISSIONS.OPERATIONS_CREATE,
    PERMISSIONS.OPERATIONS_UPDATE,
    PERMISSIONS.OPERATIONS_ASSIGN,
    PERMISSIONS.OPERATIONS_COMPLETE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_SCHEDULE,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.ACTIVITY_WRITE,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_UPDATE,
    PERMISSIONS.CAMPAIGNS_DELETE,
    PERMISSIONS.USERS_MANAGE_V4,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.REGIONS_READ,
    PERMISSIONS.REGIONS_CREATE,
    PERMISSIONS.REGIONS_UPDATE,
    PERMISSIONS.REGIONS_ARCHIVE,
    PERMISSIONS.REGIONS_MANAGE,
    PERMISSIONS.AUTH_SESSION_READ,
    PERMISSIONS.REALTIME_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_UPDATE,
    PERMISSIONS.CLIENTS_ARCHIVE,
  ],
  [ROLES.GESTOR]: [
    PERMISSIONS.PLACAS_VIEW,
    PERMISSIONS.PLACAS_CREATE,
    PERMISSIONS.PLACAS_EDIT,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.PROPOSTAS_VIEW,
    PERMISSIONS.PROPOSTAS_CREATE,
    PERMISSIONS.PROPOSTAS_EDIT,
    PERMISSIONS.CONTRATOS_VIEW,
    PERMISSIONS.CONTRATOS_CREATE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.CONTRACTS_CREATE,
    PERMISSIONS.CONTRACTS_UPDATE,
    PERMISSIONS.CONTRACTS_CANCEL,
    PERMISSIONS.CONTRACTS_RENEW,
    PERMISSIONS.COMMERCIAL_READ,
    PERMISSIONS.COMMERCIAL_CREATE,
    PERMISSIONS.COMMERCIAL_UPDATE,
    PERMISSIONS.COMMERCIAL_CONVERT,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.ALERTS_UPDATE,
    PERMISSIONS.ALERTS_RESOLVE,
    PERMISSIONS.ALERTS_DISMISS,
    PERMISSIONS.ALERTS_CREATE,
    PERMISSIONS.OPERATIONS_READ,
    PERMISSIONS.OPERATIONS_CREATE,
    PERMISSIONS.OPERATIONS_UPDATE,
    PERMISSIONS.OPERATIONS_ASSIGN,
    PERMISSIONS.OPERATIONS_COMPLETE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.ACTIVITY_WRITE,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_UPDATE,
    PERMISSIONS.REGIONS_READ,
    PERMISSIONS.REGIONS_CREATE,
    PERMISSIONS.REGIONS_UPDATE,
    PERMISSIONS.REGIONS_ARCHIVE,
    PERMISSIONS.AUTH_SESSION_READ,
    PERMISSIONS.REALTIME_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_UPDATE,
    PERMISSIONS.CLIENTS_ARCHIVE,
  ],
  [ROLES.VENDEDOR]: [
    PERMISSIONS.PLACAS_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PROPOSTAS_VIEW,
    PERMISSIONS.PROPOSTAS_CREATE,
    PERMISSIONS.PROPOSTAS_EDIT,
    PERMISSIONS.CONTRATOS_VIEW,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.COMMERCIAL_READ,
    PERMISSIONS.COMMERCIAL_CREATE,
    PERMISSIONS.COMMERCIAL_UPDATE,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.ALERTS_UPDATE,
    PERMISSIONS.ALERTS_DISMISS,
    PERMISSIONS.OPERATIONS_READ,
    PERMISSIONS.OPERATIONS_COMPLETE,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.REGIONS_READ,
    PERMISSIONS.AUTH_SESSION_READ,
    PERMISSIONS.REALTIME_READ,
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_UPDATE,
  ],
  [ROLES.FINANCEIRO]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.CONTRATOS_VIEW,
    PERMISSIONS.CONTRATOS_CREATE,
    PERMISSIONS.CONTRATOS_APPROVE,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.CONTRACTS_CREATE,
    PERMISSIONS.CONTRACTS_UPDATE,
    PERMISSIONS.CONTRACTS_CANCEL,
    PERMISSIONS.CONTRACTS_RENEW,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.ALERTS_UPDATE,
    PERMISSIONS.ALERTS_DISMISS,
    PERMISSIONS.OPERATIONS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_SCHEDULE,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.REGIONS_READ,
    PERMISSIONS.AUTH_SESSION_READ,
    PERMISSIONS.REALTIME_READ,
    PERMISSIONS.CLIENTS_READ,
  ],
  [ROLES.VISUALIZADOR]: [
    PERMISSIONS.PLACAS_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.PROPOSTAS_VIEW,
    PERMISSIONS.CONTRATOS_VIEW,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.CONTRACTS_READ,
    PERMISSIONS.COMMERCIAL_READ,
    PERMISSIONS.ALERTS_READ,
    PERMISSIONS.OPERATIONS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.REGIONS_READ,
    PERMISSIONS.AUTH_SESSION_READ,
    PERMISSIONS.REALTIME_READ,
    PERMISSIONS.CLIENTS_READ,
  ],
};

// Rotas V4 canônicas + rotas de admin/configurações
export const ROUTE_PERMISSIONS = {
  // ── V4 canônicas ─────────────────────────────────────────────────────────
  dashboard:       PERMISSIONS.DASHBOARD_VIEW,
  operacoes:       PERMISSIONS.OPERATIONS_READ,
  inventario:      PERMISSIONS.INVENTORY_READ,
  mapa:            PERMISSIONS.INVENTORY_READ,
  comercial:       PERMISSIONS.COMMERCIAL_READ,
  contratos:       PERMISSIONS.CONTRACTS_READ,
  campanhas:       PERMISSIONS.CAMPAIGNS_READ,
  relatorios:      PERMISSIONS.REPORTS_READ,
  alertas:         PERMISSIONS.ALERTS_READ,
  atividade:       PERMISSIONS.ACTIVITY_READ,
  // ── Admin / config ────────────────────────────────────────────────────────
  empresa:         PERMISSIONS.DASHBOARD_VIEW,
  empresaDetalhes: PERMISSIONS.DASHBOARD_VIEW,
  clientes:        PERMISSIONS.CLIENTS_READ,
  whatsapp:        PERMISSIONS.EMPRESAS_MANAGE,
  propostas:       PERMISSIONS.PROPOSTAS_VIEW,
  empresaApi:      PERMISSIONS.ADMIN_ACCESS,
  adminUsers:      PERMISSIONS.USERS_MANAGE,
  syncOps:         PERMISSIONS.SYNC_OPS_VIEW,
  audit:           PERMISSIONS.AUDIT_READ,
  biWeeks:         PERMISSIONS.ADMIN_ACCESS,
  docs:            PERMISSIONS.ADMIN_ACCESS,
  enterpriseBi:    PERMISSIONS.ADMIN_ACCESS,
  marketplace:     PERMISSIONS.ADMIN_ACCESS,
  // ── Legado (rotas /legacy/*) ─────────────────────────────────────────────
  placas:          PERMISSIONS.PLACAS_VIEW,
  placaCreate:     PERMISSIONS.PLACAS_CREATE,
  placaEdit:       PERMISSIONS.PLACAS_EDIT,
  placaDetails:    PERMISSIONS.PLACAS_VIEW,
  regioes:         PERMISSIONS.PLACAS_CREATE,
  map:             PERMISSIONS.PLACAS_VIEW,
  profile:         null,
};

export function normalizeRole(role) {
  if (!role) return ROLES.VISUALIZADOR;
  return LEGACY_ROLE_MAP[role] || ROLES.VISUALIZADOR;
}

export function permissionsForRole(role, explicitPermissions = []) {
  const canonicalRole = normalizeRole(role);
  return Array.from(new Set([
    ...(ROLE_PERMISSIONS[canonicalRole] || []),
    ...(Array.isArray(explicitPermissions) ? explicitPermissions : []),
  ]));
}

export function normalizeAuthUser(user) {
  if (!user) return null;

  const role = normalizeRole(user.role);
  const permissions = permissionsForRole(role, user.permissions);

  return {
    ...user,
    rawRole: user.rawRole || user.role,
    role,
    permissions,
    empresaId: user.empresaId || user.empresa_id || user.empresa?._id || user.empresa?.id || null,
    userId: user.userId || user.id || user._id || null,
  };
}

export function hasPermissionInList(permissions, permission) {
  if (!permission) return true;
  return Array.isArray(permissions) && permissions.includes(permission);
}

export function hasAnyPermissionInList(permissions, requiredPermissions = []) {
  if (!requiredPermissions.length) return true;
  return requiredPermissions.some((permission) => hasPermissionInList(permissions, permission));
}

export function hasAllPermissionsInList(permissions, requiredPermissions = []) {
  if (!requiredPermissions.length) return true;
  return requiredPermissions.every((permission) => hasPermissionInList(permissions, permission));
}

export function canAccessRouteWithPermissions(permissions, routeKey) {
  return hasPermissionInList(permissions, ROUTE_PERMISSIONS[routeKey]);
}
