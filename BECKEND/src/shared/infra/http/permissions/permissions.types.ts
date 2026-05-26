export type Role =
  | 'superadmin'
  | 'admin_empresa'
  | 'gestor'
  | 'vendedor'
  | 'financeiro'
  | 'visualizador'
  | 'admin'
  | 'user'
  | 'manager'
  | 'viewer';

export type CanonicalRole =
  | 'superadmin'
  | 'admin_empresa'
  | 'gestor'
  | 'vendedor'
  | 'financeiro'
  | 'visualizador';

export type Permission =
  // ── Legado v1/v2/v3 (mantidos para compatibilidade com rotas existentes) ──
  | 'placas.read'
  | 'placas.create'
  | 'placas.update'
  | 'placas.delete'
  | 'dashboard.read'
  | 'relatorios.read'
  | 'propostas.read'
  | 'propostas.create'
  | 'propostas.update'
  | 'contratos.read'
  | 'contratos.create'
  | 'contratos.approve'
  | 'admin.access'
  | 'usuarios.manage'
  | 'empresas.manage'
  | 'sync.diagnostics'
  | 'audit.read'
  | 'audit.export'
  // ── V4 — Inventory ──────────────────────────────────────────────────────
  | 'inventory.read'
  | 'inventory.update'
  | 'regions.read'
  | 'regions.create'
  | 'regions.update'
  | 'regions.archive'
  | 'regions.manage'
  // ── V4 — Dashboard ──────────────────────────────────────────────────────
  // (dashboard.read já está definido acima como legado e é reutilizado)
  // ── V4 — Contracts ──────────────────────────────────────────────────────
  | 'contracts.read'
  | 'contracts.create'
  | 'contracts.update'
  | 'contracts.cancel'
  | 'contracts.renew'
  // ── V4 — Commercial ─────────────────────────────────────────────────────
  | 'commercial.read'
  | 'commercial.create'
  | 'commercial.update'
  | 'commercial.delete'
  | 'commercial.convert'
  // ── V4 — Alerts ─────────────────────────────────────────────────────────
  | 'alerts.read'
  | 'alerts.update'
  | 'alerts.resolve'
  | 'alerts.dismiss'
  | 'alerts.create'
  // ── V4 — Operations ─────────────────────────────────────────────────────
  | 'operations.read'
  | 'operations.create'
  | 'operations.update'
  | 'operations.assign'
  | 'operations.complete'
  // ── V4 — Reports ────────────────────────────────────────────────────────
  | 'reports.read'
  | 'reports.export'
  | 'reports.schedule'
  // ── V4 — Activity ───────────────────────────────────────────────────────
  | 'activity.read'
  | 'activity.write'
  // ── V4 — Campaigns ──────────────────────────────────────────────────────
  | 'campaigns.read'
  | 'campaigns.create'
  | 'campaigns.update'
  | 'campaigns.delete'
  // ── V4 — Inventory (mutação) ────────────────────────────────────────────
  | 'inventory.create'
  | 'inventory.delete'
  // ── V4 — Contracts (deleção física) ─────────────────────────────────────
  | 'contracts.delete'
  // ── V4 — Users & Settings ───────────────────────────────────────────────
  | 'users.manage'
  | 'settings.manage'
  // ── V4 — System ──────────────────────────────────────────────────────────
  | 'system.readiness'
  // ── V4 — Auth & Realtime ────────────────────────────────────────────────
  | 'auth.session.read'
  | 'realtime.read'
  // ── V4.1 — Clients ──────────────────────────────────────────────────────
  | 'clients.read'
  | 'clients.create'
  | 'clients.update'
  | 'clients.archive';

export type RolePermissionMap = Record<CanonicalRole, readonly Permission[]>;

export const ALL_PERMISSIONS: readonly Permission[] = [
  // Legado
  'placas.read',
  'placas.create',
  'placas.update',
  'placas.delete',
  'dashboard.read',
  'relatorios.read',
  'propostas.read',
  'propostas.create',
  'propostas.update',
  'contratos.read',
  'contratos.create',
  'contratos.approve',
  'admin.access',
  'usuarios.manage',
  'empresas.manage',
  'sync.diagnostics',
  'audit.read',
  'audit.export',
  // V4 — Inventory
  'inventory.read',
  'inventory.update',
  'regions.read',
  'regions.create',
  'regions.update',
  'regions.archive',
  'regions.manage',
  // V4 — Contracts
  'contracts.read',
  'contracts.create',
  'contracts.update',
  'contracts.cancel',
  'contracts.renew',
  // V4 — Commercial
  'commercial.read',
  'commercial.create',
  'commercial.update',
  'commercial.delete',
  'commercial.convert',
  // V4 — Alerts
  'alerts.read',
  'alerts.update',
  'alerts.resolve',
  'alerts.dismiss',
  'alerts.create',
  // V4 — Operations
  'operations.read',
  'operations.create',
  'operations.update',
  'operations.assign',
  'operations.complete',
  // V4 — Reports
  'reports.read',
  'reports.export',
  'reports.schedule',
  // V4 — Activity
  'activity.read',
  'activity.write',
  // V4 — Campaigns
  'campaigns.read',
  'campaigns.create',
  'campaigns.update',
  'campaigns.delete',
  // V4 — Inventory (mutação)
  'inventory.create',
  'inventory.delete',
  // V4 — Contracts (deleção física)
  'contracts.delete',
  // V4 — Users & Settings
  'users.manage',
  'settings.manage',
  // V4 — System
  'system.readiness',
  // V4 — Auth & Realtime
  'auth.session.read',
  'realtime.read',
  // V4.1 — Clients
  'clients.read',
  'clients.create',
  'clients.update',
  'clients.archive',
] as const;

export const ROLE_PERMISSION_MAP: RolePermissionMap = {
  superadmin: ALL_PERMISSIONS,

  admin_empresa: [
    // Legado
    'placas.read',
    'placas.create',
    'placas.update',
    'placas.delete',
    'dashboard.read',
    'relatorios.read',
    'propostas.read',
    'propostas.create',
    'propostas.update',
    'contratos.read',
    'contratos.create',
    'contratos.approve',
    'admin.access',
    'usuarios.manage',
    'sync.diagnostics',
    'audit.read',
    'audit.export',
    // V4 — Inventory
    'inventory.read',
    'regions.read',
    'inventory.update',
    'regions.read',
    'regions.create',
    'regions.update',
    'regions.archive',
    'regions.manage',
    // V4 — Contracts
    'contracts.read',
    'contracts.create',
    'contracts.update',
    'contracts.cancel',
    'contracts.renew',
    // V4 — Commercial
    'commercial.read',
    'commercial.create',
    'commercial.update',
    'commercial.delete',
    'commercial.convert',
    // V4 — Alerts
    'alerts.read',
    'alerts.update',
    'alerts.resolve',
    'alerts.dismiss',
    'alerts.create',
    // V4 — Operations
    'operations.read',
    'operations.create',
    'operations.update',
    'operations.assign',
    'operations.complete',
    // V4 — Reports
    'reports.read',
    'reports.export',
    'reports.schedule',
    // V4 — Activity
    'activity.read',
    'activity.write',
    // V4 — Campaigns
    'campaigns.read',
    'campaigns.create',
    'campaigns.update',
    'campaigns.delete',
    // V4 — Inventory (mutação)
    'inventory.create',
    'inventory.delete',
    // V4 — Contracts (deleção física)
    'contracts.delete',
    // V4 — Users & Settings
    'users.manage',
    'settings.manage',
    // V4 — System
    'system.readiness',
    // V4 — Auth & Realtime
    'auth.session.read',
    'realtime.read',
    // V4.1 — Clients
    'clients.read',
    'clients.create',
    'clients.update',
    'clients.archive',
  ],

  gestor: [
    // Legado
    'placas.read',
    'placas.create',
    'placas.update',
    'dashboard.read',
    'relatorios.read',
    'propostas.read',
    'propostas.create',
    'propostas.update',
    'contratos.read',
    'contratos.create',
    'audit.read',
    // V4 — Inventory
    'inventory.read',
    'regions.read',
    'inventory.update',
    'regions.read',
    'regions.create',
    'regions.update',
    'regions.manage',
    // V4 — Contracts
    'contracts.read',
    'contracts.create',
    'contracts.update',
    'contracts.cancel',
    'contracts.renew',
    // V4 — Commercial (gestor não pode deletar)
    'commercial.read',
    'commercial.create',
    'commercial.update',
    'commercial.convert',
    // V4 — Alerts
    'alerts.read',
    'alerts.update',
    'alerts.resolve',
    'alerts.dismiss',
    'alerts.create',
    // V4 — Operations
    'operations.read',
    'operations.create',
    'operations.update',
    'operations.assign',
    'operations.complete',
    // V4 — Reports
    'reports.read',
    'reports.export',
    // V4 — Activity
    'activity.read',
    'activity.write',
    // V4 — Campaigns (gestor não pode deletar)
    'campaigns.read',
    'campaigns.create',
    'campaigns.update',
    // V4 — Inventory (gestor pode criar mas não deletar)
    'inventory.create',
    // V4 — Auth & Realtime
    'auth.session.read',
    'realtime.read',
    // V4.1 — Clients
    'clients.read',
    'clients.create',
    'clients.update',
    'clients.archive',
  ],

  vendedor: [
    // Legado
    'placas.read',
    'dashboard.read',
    'propostas.read',
    'propostas.create',
    'propostas.update',
    'contratos.read',
    // V4 — Inventory
    'inventory.read',
    // V4 — Contracts
    'contracts.read',
    // V4 — Commercial
    'commercial.read',
    'commercial.create',
    'commercial.update',
    // V4 — Alerts
    'alerts.read',
    'alerts.update',
    'alerts.dismiss',
    // V4 — Operations
    'operations.read',
    'operations.complete',
    // V4 — Activity
    'activity.read',
    // V4 — Campaigns
    'campaigns.read',
    // V4 — Auth & Realtime
    'auth.session.read',
    'realtime.read',
    // V4.1 — Clients (vendedor can read and create, not archive)
    'clients.read',
    'clients.create',
    'clients.update',
  ],

  financeiro: [
    // Legado
    'dashboard.read',
    'relatorios.read',
    'contratos.read',
    'contratos.create',
    'contratos.approve',
    // V4 — Contracts
    'contracts.read',
    'contracts.create',
    'contracts.update',
    'contracts.cancel',
    'contracts.renew',
    // V4 — Alerts
    'alerts.read',
    'alerts.update',
    'alerts.dismiss',
    // V4 — Operations
    'operations.read',
    // V4 — Reports
    'reports.read',
    'reports.export',
    'reports.schedule',
    // V4 — Activity
    'activity.read',
    // V4 — Campaigns
    'campaigns.read',
    // V4 — Auth & Realtime
    'auth.session.read',
    'realtime.read',
    // V4.1 — Clients
    'clients.read',
  ],

  visualizador: [
    // Legado
    'placas.read',
    'dashboard.read',
    'relatorios.read',
    'propostas.read',
    'contratos.read',
    // V4 — Inventory
    'inventory.read',
    // V4 — Contracts
    'contracts.read',
    // V4 — Commercial
    'commercial.read',
    // V4 — Alerts
    'alerts.read',
    // V4 — Operations
    'operations.read',
    // V4 — Reports
    'reports.read',
    // V4 — Activity
    'activity.read',
    // V4 — Campaigns
    'campaigns.read',
    // V4 — Auth & Realtime
    'auth.session.read',
    'realtime.read',
    // V4.1 — Clients
    'clients.read',
  ],
};

const ROLE_NORMALIZATION_MAP: Record<string, CanonicalRole> = {
  superadmin:   'superadmin',
  admin_empresa:'admin_empresa',
  admin:        'admin_empresa',
  gestor:       'gestor',
  manager:      'gestor',
  vendedor:     'vendedor',
  user:         'vendedor',
  financeiro:   'financeiro',
  visualizador: 'visualizador',
  viewer:       'visualizador',
};

export const normalizeRole = (role?: string): CanonicalRole => {
  if (!role) return 'visualizador';
  return ROLE_NORMALIZATION_MAP[role] ?? 'visualizador';
};

export interface PermissionContext {
  userId:       string;
  empresaId:    string;
  role:         CanonicalRole;
  originalRole?: string;
  permissions:  readonly Permission[];
  authSource:   'jwt' | 'api-key';
}

export const getRolePermissions = (role: string): readonly Permission[] => {
  const canonicalRole = normalizeRole(role);
  return ROLE_PERMISSION_MAP[canonicalRole];
};

export const hasPermission = (
  permissionContext: PermissionContext,
  permission: Permission,
): boolean => {
  return permissionContext.permissions.includes(permission);
};

/**
 * Converte o conjunto de permissões de um usuário para o formato V4 canônico.
 * Usado exclusivamente pelo endpoint /api/v4/auth/session.
 * Nunca retorna permissões legadas (placas.*, contratos.*, etc.).
 */
export const getV4Permissions = (permissions: readonly Permission[]): string[] => {
  const v4Set = new Set<string>();

  for (const p of permissions) {
    // ── Permissões V4 diretas ─────────────────────────────────────────────
    if (
      p.startsWith('inventory.')  ||
      p.startsWith('regions.')    ||
      p.startsWith('contracts.')  ||
      p.startsWith('commercial.') ||
      p.startsWith('alerts.')     ||
      p.startsWith('operations.') ||
      p.startsWith('reports.')    ||
      p.startsWith('activity.')   ||
      p.startsWith('campaigns.')  ||
      p.startsWith('users.')      ||
      p.startsWith('settings.')   ||
      p.startsWith('system.')     ||
      p.startsWith('auth.')       ||
      p.startsWith('realtime.')   ||
      p.startsWith('clients.')    ||
      p === 'dashboard.read'
    ) {
      v4Set.add(p);
      continue;
    }

    // ── Mapeamento de permissões legadas → V4 ────────────────────────────
    if (p === 'placas.read')                        v4Set.add('inventory.read');
    if (p === 'placas.create' || p === 'placas.update') v4Set.add('inventory.update');
    if (p === 'contratos.read')                     v4Set.add('contracts.read');
    if (p === 'contratos.create')                   v4Set.add('contracts.create');
    if (p === 'contratos.approve') {
      v4Set.add('contracts.update');
      v4Set.add('contracts.cancel');
      v4Set.add('contracts.renew');
    }
    if (p === 'propostas.read')   v4Set.add('commercial.read');
    if (p === 'propostas.create') v4Set.add('commercial.create');
    if (p === 'propostas.update') v4Set.add('commercial.update');
    if (p === 'relatorios.read')  v4Set.add('reports.read');
    if (p === 'audit.export')     v4Set.add('reports.export');
    if (p === 'audit.read')       v4Set.add('activity.read');
    if (p === 'usuarios.manage')  v4Set.add('users.manage');
    if (p === 'empresas.manage')  v4Set.add('settings.manage');
    if (p === 'sync.diagnostics') v4Set.add('system.readiness');
    if (p === 'placas.delete')    v4Set.add('inventory.delete');
  }

  // auth.session.read e realtime.read são concedidos a qualquer token JWT válido
  // que chegue neste ponto (o caller já passou authenticateToken)
  v4Set.add('auth.session.read');
  v4Set.add('realtime.read');

  return Array.from(v4Set).sort();
};

/**
 * Lista as permissões V4 ausentes para um dado conjunto de permissões.
 * Útil para diagnóstico e testes.
 */
export const getMissingV4Permissions = (
  permissions: readonly Permission[],
  required: readonly string[],
): string[] => {
  const v4 = new Set(getV4Permissions(permissions));
  return required.filter((r) => !v4.has(r));
};
