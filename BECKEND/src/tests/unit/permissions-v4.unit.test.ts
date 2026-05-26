import {
  getV4Permissions,
  getMissingV4Permissions,
  normalizeRole,
  ROLE_PERMISSION_MAP,
  ALL_PERMISSIONS,
  type Permission,
} from '../../shared/infra/http/permissions/permissions.types';

// ── Helpers ────────────────────────────────────────────────────────────────

function perms(...list: Permission[]) {
  return list;
}

// ── getV4Permissions ───────────────────────────────────────────────────────

describe('getV4Permissions', () => {
  it('mapeia placas.read para inventory.read', () => {
    const result = getV4Permissions(['placas.read']);
    expect(result).toContain('inventory.read');
    expect(result).not.toContain('placas.read');
  });

  it('mapeia placas.create e placas.update para inventory.update', () => {
    expect(getV4Permissions(['placas.create'])).toContain('inventory.update');
    expect(getV4Permissions(['placas.update'])).toContain('inventory.update');
  });

  it('mapeia contratos.read para contracts.read', () => {
    const result = getV4Permissions(['contratos.read']);
    expect(result).toContain('contracts.read');
    expect(result).not.toContain('contratos.read');
  });

  it('mapeia contratos.create para contracts.create', () => {
    const result = getV4Permissions(['contratos.create']);
    expect(result).toContain('contracts.create');
  });

  it('mapeia contratos.approve para contracts.update, cancel e renew', () => {
    const result = getV4Permissions(['contratos.approve']);
    expect(result).toContain('contracts.update');
    expect(result).toContain('contracts.cancel');
    expect(result).toContain('contracts.renew');
  });

  it('mapeia propostas.* para commercial.*', () => {
    const result = getV4Permissions(['propostas.read', 'propostas.create', 'propostas.update']);
    expect(result).toContain('commercial.read');
    expect(result).toContain('commercial.create');
    expect(result).toContain('commercial.update');
  });

  it('mapeia relatorios.read para reports.read', () => {
    const result = getV4Permissions(['relatorios.read']);
    expect(result).toContain('reports.read');
    expect(result).not.toContain('relatorios.read');
  });

  it('mapeia audit.export para reports.export', () => {
    const result = getV4Permissions(['audit.export']);
    expect(result).toContain('reports.export');
  });

  it('passa permissoes V4 diretas sem modificacao', () => {
    const input = perms(
      'inventory.read', 'inventory.update',
      'contracts.read', 'contracts.create', 'contracts.update', 'contracts.cancel', 'contracts.renew',
      'commercial.read', 'commercial.create', 'commercial.update', 'commercial.delete', 'commercial.convert',
      'alerts.read', 'alerts.update', 'alerts.resolve', 'alerts.dismiss', 'alerts.create',
      'operations.read', 'operations.create', 'operations.update', 'operations.assign', 'operations.complete',
      'reports.read', 'reports.export', 'reports.schedule',
      'dashboard.read',
    );
    const result = getV4Permissions(input);
    for (const p of input) {
      expect(result).toContain(p);
    }
  });

  it('sempre inclui auth.session.read e realtime.read', () => {
    const result = getV4Permissions([]);
    expect(result).toContain('auth.session.read');
    expect(result).toContain('realtime.read');
  });

  it('nunca retorna permissoes legadas na saida', () => {
    const result = getV4Permissions([
      'placas.read', 'placas.create', 'placas.update', 'placas.delete',
      'contratos.read', 'contratos.create', 'contratos.approve',
      'propostas.read', 'relatorios.read', 'audit.export',
    ]);
    const legacy = ['placas.read', 'placas.create', 'placas.update', 'placas.delete',
      'contratos.read', 'contratos.create', 'contratos.approve',
      'propostas.read', 'relatorios.read', 'audit.export'];
    for (const l of legacy) {
      expect(result).not.toContain(l);
    }
  });

  it('retorna lista ordenada', () => {
    const result = getV4Permissions(['contracts.read', 'inventory.read']);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it('nao duplica permissoes quando legacy e v4 coexistem', () => {
    const result = getV4Permissions(['placas.read', 'inventory.read']);
    const count = result.filter((p) => p === 'inventory.read').length;
    expect(count).toBe(1);
  });
});

// ── Role RBAC V4 coverage ──────────────────────────────────────────────────

describe('RBAC V4 — cobertura de permissoes por papel', () => {
  const V4_READ_PERMISSIONS = [
    'inventory.read',
    'dashboard.read',
    'contracts.read',
    'commercial.read',
    'alerts.read',
    'operations.read',
    'reports.read',
    'auth.session.read',
    'realtime.read',
  ] as const;

  const V4_WRITE_PERMISSIONS = [
    'inventory.update',
    'contracts.create', 'contracts.update', 'contracts.cancel', 'contracts.renew',
    'commercial.create', 'commercial.update', 'commercial.convert',
    'alerts.update', 'alerts.resolve', 'alerts.dismiss', 'alerts.create',
    'operations.create', 'operations.update', 'operations.assign', 'operations.complete',
    'reports.export', 'reports.schedule',
  ] as const;

  it('superadmin tem todas as permissoes V4', () => {
    const v4 = getV4Permissions(ROLE_PERMISSION_MAP.superadmin as Permission[]);
    for (const p of [...V4_READ_PERMISSIONS, ...V4_WRITE_PERMISSIONS]) {
      expect(v4).toContain(p);
    }
  });

  it('admin_empresa tem todas as permissoes V4', () => {
    const v4 = getV4Permissions(ROLE_PERMISSION_MAP.admin_empresa as Permission[]);
    for (const p of [...V4_READ_PERMISSIONS, ...V4_WRITE_PERMISSIONS]) {
      expect(v4).toContain(p);
    }
  });

  it('gestor tem leitura completa V4', () => {
    const v4 = getV4Permissions(ROLE_PERMISSION_MAP.gestor as Permission[]);
    for (const p of V4_READ_PERMISSIONS) {
      expect(v4).toContain(p);
    }
  });

  it('gestor tem operacoes de escrita exceto commercial.delete e reports.schedule', () => {
    const v4 = getV4Permissions(ROLE_PERMISSION_MAP.gestor as Permission[]);
    expect(v4).toContain('contracts.renew');
    expect(v4).toContain('commercial.convert');
    expect(v4).toContain('alerts.resolve');
    expect(v4).toContain('operations.assign');
    expect(v4).not.toContain('commercial.delete');
    expect(v4).not.toContain('reports.schedule');
  });

  it('vendedor tem apenas leitura e operacoes basicas', () => {
    const v4 = getV4Permissions(ROLE_PERMISSION_MAP.vendedor as Permission[]);
    expect(v4).toContain('inventory.read');
    expect(v4).toContain('contracts.read');
    expect(v4).toContain('commercial.read');
    expect(v4).toContain('alerts.read');
    expect(v4).toContain('operations.read');
    // Vendedor nao pode cancelar contratos
    expect(v4).not.toContain('contracts.cancel');
    // Vendedor nao pode resolver alertas
    expect(v4).not.toContain('alerts.resolve');
    // Vendedor nao tem acesso a reports
    expect(v4).not.toContain('reports.read');
  });

  it('financeiro tem contratos e relatorios mas nao inventory.update nem operations.create', () => {
    const v4 = getV4Permissions(ROLE_PERMISSION_MAP.financeiro as Permission[]);
    expect(v4).toContain('contracts.read');
    expect(v4).toContain('contracts.create');
    expect(v4).toContain('contracts.renew');
    expect(v4).toContain('reports.read');
    expect(v4).toContain('reports.export');
    expect(v4).toContain('reports.schedule');
    expect(v4).not.toContain('inventory.update');
    expect(v4).not.toContain('operations.create');
    expect(v4).not.toContain('commercial.read');
  });

  it('visualizador tem somente leitura', () => {
    const v4 = getV4Permissions(ROLE_PERMISSION_MAP.visualizador as Permission[]);
    // Deve ter todas as leituras
    expect(v4).toContain('inventory.read');
    expect(v4).toContain('contracts.read');
    expect(v4).toContain('commercial.read');
    expect(v4).toContain('alerts.read');
    expect(v4).toContain('operations.read');
    expect(v4).toContain('reports.read');
    // Nao deve ter nenhuma escrita
    for (const p of V4_WRITE_PERMISSIONS) {
      expect(v4).not.toContain(p);
    }
  });
});

// ── normalizeRole ──────────────────────────────────────────────────────────

describe('normalizeRole', () => {
  it.each([
    ['admin', 'admin_empresa'],
    ['manager', 'gestor'],
    ['user', 'vendedor'],
    ['viewer', 'visualizador'],
    ['superadmin', 'superadmin'],
    ['financeiro', 'financeiro'],
    ['unknown', 'visualizador'],
    [undefined, 'visualizador'],
  ])('normaliza %s para %s', (input, expected) => {
    expect(normalizeRole(input as any)).toBe(expected);
  });
});

// ── getMissingV4Permissions ────────────────────────────────────────────────

describe('getMissingV4Permissions', () => {
  it('retorna lista vazia quando todas as permissoes estao presentes', () => {
    const result = getMissingV4Permissions(
      ROLE_PERMISSION_MAP.gestor as Permission[],
      ['inventory.read', 'contracts.read', 'commercial.read'],
    );
    expect(result).toHaveLength(0);
  });

  it('retorna permissoes faltantes para visualizador tentando escrever', () => {
    const missing = getMissingV4Permissions(
      ROLE_PERMISSION_MAP.visualizador as Permission[],
      ['contracts.create', 'contracts.cancel', 'inventory.update'],
    );
    expect(missing).toContain('contracts.create');
    expect(missing).toContain('contracts.cancel');
    expect(missing).toContain('inventory.update');
  });
});

// ── ALL_PERMISSIONS completeness ───────────────────────────────────────────

describe('ALL_PERMISSIONS', () => {
  const EXPECTED_V4_PERMISSIONS = [
    'inventory.read', 'inventory.update',
    'dashboard.read',
    'contracts.read', 'contracts.create', 'contracts.update', 'contracts.cancel', 'contracts.renew',
    'commercial.read', 'commercial.create', 'commercial.update', 'commercial.delete', 'commercial.convert',
    'alerts.read', 'alerts.update', 'alerts.resolve', 'alerts.dismiss', 'alerts.create',
    'operations.read', 'operations.create', 'operations.update', 'operations.assign', 'operations.complete',
    'reports.read', 'reports.export', 'reports.schedule',
    'auth.session.read', 'realtime.read',
  ];

  it('contem todas as permissoes V4 esperadas', () => {
    for (const p of EXPECTED_V4_PERMISSIONS) {
      expect(ALL_PERMISSIONS).toContain(p as Permission);
    }
  });

  it('nao tem entradas duplicadas', () => {
    const unique = new Set(ALL_PERMISSIONS);
    expect(unique.size).toBe(ALL_PERMISSIONS.length);
  });
});
