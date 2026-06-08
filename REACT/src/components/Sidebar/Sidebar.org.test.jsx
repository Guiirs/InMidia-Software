import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

// ── Mock base helpers ──────────────────────────────────────────────────────────

let mockCanAccessRoute = () => false;
let mockTenant = { canManageOrganization: false, canInviteMembers: false };

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    canAccessRoute: (key) => mockCanAccessRoute(key),
    logout: vi.fn(),
  }),
}));

vi.mock('../../context/ConfirmationContext', () => ({
  useConfirmation: () => vi.fn(),
}));

vi.mock('../../context/TenantContext', () => ({
  useTenant: () => mockTenant,
}));

import Sidebar from './Sidebar';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Sidebar — links de organização', () => {
  it('OWNER vê Membros e Convites', () => {
    mockTenant = { canManageOrganization: true, canInviteMembers: true };

    const html = renderToString(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(html).toContain('Membros');
    expect(html).toContain('Convites');
    expect(html).toContain('/organizacao/membros');
    expect(html).toContain('/organizacao/convites');
  });

  it('ADMIN vê Convites mas não Membros', () => {
    mockTenant = { canManageOrganization: false, canInviteMembers: true };

    const html = renderToString(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(html).toContain('Convites');
    expect(html).not.toContain('Membros');
  });

  it('VIEWER não vê Membros nem Convites', () => {
    mockTenant = { canManageOrganization: false, canInviteMembers: false };

    const html = renderToString(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(html).not.toContain('Membros');
    expect(html).not.toContain('Convites');
  });
});
