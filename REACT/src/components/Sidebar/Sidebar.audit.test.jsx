import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

let mockCanAccessRoute = () => false;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    canAccessRoute: mockCanAccessRoute,
    logout: vi.fn(),
  }),
}));

vi.mock('../../context/ConfirmationContext', () => ({
  useConfirmation: () => vi.fn(),
}));

import Sidebar from './Sidebar';

describe('Sidebar audit access', () => {
  it('vendedor nao ve menu de auditoria', () => {
    mockCanAccessRoute = (routeKey) => routeKey === 'placas';

    const html = renderToString(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(html).toContain('Placas');
    expect(html).not.toContain('Auditoria');
  });

  it('gestor com audit.read ve menu de auditoria', () => {
    mockCanAccessRoute = (routeKey) => routeKey === 'audit';

    const html = renderToString(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(html).toContain('Auditoria');
  });
});
