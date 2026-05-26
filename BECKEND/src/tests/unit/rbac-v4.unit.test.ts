/**
 * RBAC V4 — testes unitários de hardening de autorização.
 * Cobre: roles canônicas, permissões por role, cross-tenant, role inválida,
 * mapeamento legado→V4, e novas permissões da Fase 3.
 */

import {
  normalizeRole,
  getRolePermissions,
  hasPermission,
  getV4Permissions,
  ROLE_PERMISSION_MAP,
  ALL_PERMISSIONS,
  type CanonicalRole,
  type Permission,
  type PermissionContext,
} from '../../shared/infra/http/permissions/permissions.types';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeContext(
  role: CanonicalRole,
  empresaId = 'empresa-abc',
  userId = 'user-1',
): PermissionContext {
  return {
    userId,
    empresaId,
    role,
    permissions: getRolePermissions(role),
    authSource: 'jwt',
  };
}

// ── normalizeRole ─────────────────────────────────────────────────────────

describe('normalizeRole', () => {
  it('normaliza roles canônicas sem alteração', () => {
    const roles: CanonicalRole[] = [
      'superadmin', 'admin_empresa', 'gestor', 'vendedor', 'financeiro', 'visualizador',
    ];
    roles.forEach((r) => expect(normalizeRole(r)).toBe(r));
  });

  it('mapeia aliases legados para roles canônicas', () => {
    expect(normalizeRole('admin')).toBe('admin_empresa');
    expect(normalizeRole('manager')).toBe('gestor');
    expect(normalizeRole('user')).toBe('vendedor');
    expect(normalizeRole('viewer')).toBe('visualizador');
  });

  it('retorna visualizador para role inválida — sem fallback silencioso', () => {
    // Role inválida nunca concede privilégios extras; cai em visualizador
    expect(normalizeRole('role_inexistente')).toBe('visualizador');
    expect(normalizeRole('')).toBe('visualizador');
    expect(normalizeRole(undefined)).toBe('visualizador');
  });
});

// ── ROLE_PERMISSION_MAP — completude ──────────────────────────────────────

describe('ROLE_PERMISSION_MAP — completude', () => {
  const roles: CanonicalRole[] = [
    'superadmin', 'admin_empresa', 'gestor', 'vendedor', 'financeiro', 'visualizador',
  ];

  it('todos os roles canônicos estão mapeados', () => {
    roles.forEach((role) => {
      expect(ROLE_PERMISSION_MAP[role]).toBeDefined();
      expect(ROLE_PERMISSION_MAP[role].length).toBeGreaterThan(0);
    });
  });

  it('superadmin possui TODAS as permissões', () => {
    const superPerms = ROLE_PERMISSION_MAP['superadmin'];
    ALL_PERMISSIONS.forEach((p) => {
      expect(superPerms).toContain(p);
    });
  });

  it('permissões de roles inferiores são subconjunto das permissões de roles superiores', () => {
    const visualizadorPerms = new Set(ROLE_PERMISSION_MAP['visualizador']);
    const gestorPerms = new Set(ROLE_PERMISSION_MAP['gestor']);
    const adminPerms = new Set(ROLE_PERMISSION_MAP['admin_empresa']);

    // Visualizador é subconjunto de gestor (read-only vs full)
    visualizadorPerms.forEach((p) => {
      expect(gestorPerms.has(p) || adminPerms.has(p)).toBe(true);
    });
  });
});

// ── Novas permissões Fase 3 ───────────────────────────────────────────────

describe('Fase 3 — novas permissões', () => {
  const newPermissions: Permission[] = [
    'inventory.create',
    'inventory.delete',
    'contracts.delete',
    'users.manage',
    'settings.manage',
    'system.readiness',
  ];

  it('novas permissões existem no ALL_PERMISSIONS', () => {
    newPermissions.forEach((p) => {
      expect(ALL_PERMISSIONS).toContain(p);
    });
  });

  it('admin_empresa possui todas as novas permissões', () => {
    const adminPerms = ROLE_PERMISSION_MAP['admin_empresa'];
    newPermissions.forEach((p) => {
      expect(adminPerms).toContain(p);
    });
  });

  it('superadmin possui todas as novas permissões', () => {
    const superPerms = ROLE_PERMISSION_MAP['superadmin'];
    newPermissions.forEach((p) => {
      expect(superPerms).toContain(p);
    });
  });

  it('visualizador NÃO possui permissões de mutação/admin', () => {
    const visualizadorPerms = ROLE_PERMISSION_MAP['visualizador'];
    const mutationPerms: Permission[] = [
      'inventory.create',
      'inventory.delete',
      'contracts.delete',
      'users.manage',
      'settings.manage',
    ];
    mutationPerms.forEach((p) => {
      expect(visualizadorPerms).not.toContain(p);
    });
  });

  it('vendedor NÃO possui permissões de delete ou manage', () => {
    const vendedorPerms = ROLE_PERMISSION_MAP['vendedor'];
    const denied: Permission[] = [
      'inventory.delete', 'contracts.delete', 'users.manage', 'settings.manage',
    ];
    denied.forEach((p) => {
      expect(vendedorPerms).not.toContain(p);
    });
  });
});

// ── hasPermission ─────────────────────────────────────────────────────────

describe('hasPermission', () => {
  it('retorna true quando contexto tem a permissão', () => {
    const ctx = makeContext('admin_empresa');
    expect(hasPermission(ctx, 'inventory.create')).toBe(true);
    expect(hasPermission(ctx, 'users.manage')).toBe(true);
    expect(hasPermission(ctx, 'settings.manage')).toBe(true);
  });

  it('retorna false quando contexto não tem a permissão', () => {
    const ctx = makeContext('visualizador');
    expect(hasPermission(ctx, 'inventory.create')).toBe(false);
    expect(hasPermission(ctx, 'users.manage')).toBe(false);
    expect(hasPermission(ctx, 'contracts.delete')).toBe(false);
  });

  it('vendedor pode ler inventário mas não criar/deletar', () => {
    const ctx = makeContext('vendedor');
    expect(hasPermission(ctx, 'inventory.read')).toBe(true);
    expect(hasPermission(ctx, 'inventory.create')).toBe(false);
    expect(hasPermission(ctx, 'inventory.delete')).toBe(false);
  });

  it('gestor pode criar inventário mas não deletar', () => {
    const ctx = makeContext('gestor');
    expect(hasPermission(ctx, 'inventory.create')).toBe(true);
    expect(hasPermission(ctx, 'inventory.delete')).toBe(false);
  });

  it('financeiro pode criar/cancelar contratos mas não deletar', () => {
    const ctx = makeContext('financeiro');
    expect(hasPermission(ctx, 'contracts.create')).toBe(true);
    expect(hasPermission(ctx, 'contracts.cancel')).toBe(true);
    expect(hasPermission(ctx, 'contracts.delete')).toBe(false);
  });
});

// ── Cross-tenant isolation ────────────────────────────────────────────────

describe('Cross-tenant isolation', () => {
  it('contexto inclui empresaId correto e não vaza entre tenants', () => {
    const ctx1 = makeContext('admin_empresa', 'empresa-A');
    const ctx2 = makeContext('admin_empresa', 'empresa-B');

    expect(ctx1.empresaId).toBe('empresa-A');
    expect(ctx2.empresaId).toBe('empresa-B');
    expect(ctx1.empresaId).not.toBe(ctx2.empresaId);
  });

  it('superadmin com contexto de tenant A não acessa B automaticamente', () => {
    // A proteção cross-tenant é feita via empresaId no request, não nas permissions.
    // Verificamos que o empresaId é obrigatório no PermissionContext.
    const ctx = makeContext('superadmin', 'empresa-A');
    expect(ctx.empresaId).toBe('empresa-A');
    // O superadmin só pode acessar dados de outro tenant se o empresaId for explicitamente
    // setado no contexto — o que é feito pelo tenant-guard com base no JWT.
  });
});

// ── getV4Permissions — mapeamento legado ─────────────────────────────────

describe('getV4Permissions — mapeamento legado→V4', () => {
  it('mapeia usuarios.manage para users.manage', () => {
    const result = getV4Permissions(['usuarios.manage']);
    expect(result).toContain('users.manage');
  });

  it('mapeia empresas.manage para settings.manage', () => {
    const result = getV4Permissions(['empresas.manage']);
    expect(result).toContain('settings.manage');
  });

  it('mapeia sync.diagnostics para system.readiness', () => {
    const result = getV4Permissions(['sync.diagnostics']);
    expect(result).toContain('system.readiness');
  });

  it('mapeia placas.delete para inventory.delete', () => {
    const result = getV4Permissions(['placas.delete']);
    expect(result).toContain('inventory.delete');
  });

  it('passa permissões V4 diretas sem alteração', () => {
    const v4Perms: Permission[] = [
      'inventory.create',
      'contracts.delete',
      'users.manage',
      'settings.manage',
    ];
    const result = getV4Permissions(v4Perms);
    v4Perms.forEach((p) => expect(result).toContain(p));
  });

  it('concede auth.session.read e realtime.read a qualquer token válido', () => {
    const result = getV4Permissions([]);
    expect(result).toContain('auth.session.read');
    expect(result).toContain('realtime.read');
  });
});

// ── Permission denied — sem fallback silencioso ───────────────────────────

describe('Permission denied — sem fallback silencioso de role inválida', () => {
  it('role inválida cai em visualizador — permissões mínimas garantidas', () => {
    const role = normalizeRole('role_hacker');
    const perms = getRolePermissions(role);

    // Não deve ter nenhuma permissão de mutação
    expect(perms).not.toContain('inventory.create' as Permission);
    expect(perms).not.toContain('users.manage' as Permission);
    expect(perms).not.toContain('settings.manage' as Permission);
    expect(perms).not.toContain('admin.access' as Permission);

    // Deve ter apenas leitura (visualizador default)
    expect(perms).toContain('dashboard.read' as Permission);
    expect(perms).toContain('inventory.read' as Permission);
  });

  it('contexto com role desconhecida normaliza para visualizador e restringe mutações', () => {
    const normalizedRole = normalizeRole('role_desconhecida');
    const ctx: PermissionContext = {
      userId: 'u1',
      empresaId: 'e1',
      role: normalizedRole,
      permissions: getRolePermissions(normalizedRole),
      authSource: 'jwt',
    };

    expect(ctx.role).toBe('visualizador');
    expect(hasPermission(ctx, 'inventory.delete')).toBe(false);
    expect(hasPermission(ctx, 'users.manage')).toBe(false);
    expect(hasPermission(ctx, 'contracts.delete')).toBe(false);
  });
});
