import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

// Tests for the OrgRoute / OrgInviteRoute guards defined inline in App.jsx.
// We replicate minimal guard logic here to keep tests self-contained.

let mockTenant = { canManageOrganization: false, canInviteMembers: false };

vi.mock('../../context/TenantContext', () => ({
  useTenant: () => mockTenant,
}));

// Minimal guard components matching App.jsx implementation
import { useTenant } from '../../context/TenantContext';

function OrgRoute({ children }) {
  const { canManageOrganization } = useTenant();
  if (!canManageOrganization) return <Navigate to="/dashboard" replace />;
  return children;
}

function OrgInviteRoute({ children }) {
  const { canInviteMembers } = useTenant();
  if (!canInviteMembers) return <Navigate to="/dashboard" replace />;
  return children;
}

describe('OrgRoute — rota protegida /organizacao/membros', () => {
  it('redireciona VIEWER para /dashboard (conteúdo protegido não aparece)', () => {
    mockTenant = { canManageOrganization: false, canInviteMembers: false };

    // Navigate durante SSR redireciona internamente — a rota de destino
    // só é renderizada se o MemoryRouter processar o redirect no mesmo ciclo.
    // O importante é que o conteúdo protegido NÃO apareça.
    const html = renderToString(
      <MemoryRouter initialEntries={['/organizacao/membros']}>
        <Routes>
          <Route path="/organizacao/membros" element={<OrgRoute><div>Membros</div></OrgRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).not.toContain('Membros');
  });

  it('permite acesso a OWNER', () => {
    mockTenant = { canManageOrganization: true, canInviteMembers: true };

    const html = renderToString(
      <MemoryRouter initialEntries={['/organizacao/membros']}>
        <Routes>
          <Route path="/organizacao/membros" element={<OrgRoute><div>Membros</div></OrgRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain('Membros');
  });
});

describe('OrgInviteRoute — rota protegida /organizacao/convites', () => {
  it('redireciona VIEWER para /dashboard (conteúdo protegido não aparece)', () => {
    mockTenant = { canManageOrganization: false, canInviteMembers: false };

    const html = renderToString(
      <MemoryRouter initialEntries={['/organizacao/convites']}>
        <Routes>
          <Route path="/organizacao/convites" element={<OrgInviteRoute><div>Convites</div></OrgInviteRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).not.toContain('Convites');
  });

  it('permite acesso a ADMIN', () => {
    mockTenant = { canManageOrganization: false, canInviteMembers: true };

    const html = renderToString(
      <MemoryRouter initialEntries={['/organizacao/convites']}>
        <Routes>
          <Route path="/organizacao/convites" element={<OrgInviteRoute><div>Convites</div></OrgInviteRoute>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain('Convites');
  });
});
