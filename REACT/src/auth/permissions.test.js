import { describe, expect, it } from 'vitest';
import {
  canAccessRouteWithPermissions,
  normalizeAuthUser,
  PERMISSIONS,
} from './permissions';

describe('CORE-3 permissions matrix', () => {
  it('vendedor ve placas, mas nao pode deletar', () => {
    const user = normalizeAuthUser({ role: 'vendedor' });

    expect(canAccessRouteWithPermissions(user.permissions, 'placas')).toBe(true);
    expect(user.permissions).toContain(PERMISSIONS.PLACAS_VIEW);
    expect(user.permissions).not.toContain(PERMISSIONS.PLACAS_DELETE);
  });

  it('visualizador nao pode criar nem editar placas', () => {
    const user = normalizeAuthUser({ role: 'visualizador' });

    expect(user.permissions).toContain(PERMISSIONS.PLACAS_VIEW);
    expect(user.permissions).not.toContain(PERMISSIONS.PLACAS_CREATE);
    expect(user.permissions).not.toContain(PERMISSIONS.PLACAS_EDIT);
  });

  it('financeiro ve contratos, mas nao usuarios', () => {
    const user = normalizeAuthUser({ role: 'financeiro' });

    expect(canAccessRouteWithPermissions(user.permissions, 'contratos')).toBe(true);
    expect(canAccessRouteWithPermissions(user.permissions, 'adminUsers')).toBe(false);
  });

  it('gestor ve dashboard e relatorios', () => {
    const user = normalizeAuthUser({ role: 'gestor' });

    expect(canAccessRouteWithPermissions(user.permissions, 'dashboard')).toBe(true);
    expect(canAccessRouteWithPermissions(user.permissions, 'relatorios')).toBe(true);
    expect(canAccessRouteWithPermissions(user.permissions, 'audit')).toBe(true);
  });

  it('admin legado vira admin_empresa e ve administracao', () => {
    const user = normalizeAuthUser({ role: 'admin', id: 'u-1', empresaId: 'e-1' });

    expect(user.role).toBe('admin_empresa');
    expect(user.userId).toBe('u-1');
    expect(user.empresaId).toBe('e-1');
    expect(canAccessRouteWithPermissions(user.permissions, 'adminUsers')).toBe(true);
  });

  it('nao-admin nao ve Sync Ops', () => {
    const user = normalizeAuthUser({ role: 'user' });

    expect(user.role).toBe('vendedor');
    expect(canAccessRouteWithPermissions(user.permissions, 'syncOps')).toBe(false);
    expect(canAccessRouteWithPermissions(user.permissions, 'audit')).toBe(false);
  });
});
