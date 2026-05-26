import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export const V4_ROLE_PERMISSIONS = {
  operador: [
    'dashboard.read',
    'inventory.read',
    'alerts.read',
    'operations.read',
    'campaigns.read',
  ],
  admin_empresa: [
    'dashboard.read',
    'inventory.read',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'alerts.read',
    'operations.read',
    'campaigns.read',
    'commercial.read',
    'contracts.read',
    'reports.read',
    'activity.read',
  ],
  superadmin: [
    'dashboard.read',
    'inventory.read',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'alerts.read',
    'alerts.update',
    'operations.read',
    'campaigns.read',
    'commercial.read',
    'contracts.read',
    'reports.read',
    'activity.read',
    'superadmin',
  ],
};

export function createMockPermissions(role = 'operador', explicitPermissions = []) {
  return Array.from(new Set([
    ...(V4_ROLE_PERMISSIONS[role] ?? V4_ROLE_PERMISSIONS.operador),
    ...explicitPermissions,
  ]));
}

export function createMockUser({ role = 'operador', permissions, ...overrides } = {}) {
  const resolvedPermissions = permissions ?? createMockPermissions(role);
  return {
    id: 'test-user',
    userId: 'test-user',
    nome: 'Usuario Teste',
    name: 'Usuario Teste',
    email: 'teste@inmidia.local',
    role,
    permissions: resolvedPermissions,
    empresaId: 'empresa-test',
    ...overrides,
  };
}

export function createMockAuth({ role = 'operador', permissions, user } = {}) {
  const resolvedUser = user ?? createMockUser({ role, permissions });
  return {
    isAuthenticated: true,
    isLoading: false,
    sessionWarning: false,
    sessionExpired: false,
    token: 'test-token',
    role: resolvedUser.role,
    user: resolvedUser,
    permissions: resolvedUser.permissions,
    empresaId: resolvedUser.empresaId,
    userId: resolvedUser.userId ?? resolvedUser.id,
    hasPermission: (permission) => !permission || resolvedUser.permissions.includes(permission),
    hasAnyPermission: (required = []) => required.some((permission) => resolvedUser.permissions.includes(permission)),
    hasAllPermissions: (required = []) => required.every((permission) => resolvedUser.permissions.includes(permission)),
    canAccessRoute: () => true,
    login: async () => {},
    logout: () => {},
    updateUser: () => {},
  };
}

export function renderWithV4Providers(ui, { route = '/dashboard' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
}
