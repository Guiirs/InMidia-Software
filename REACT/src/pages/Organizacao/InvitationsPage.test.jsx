import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import InvitationsPage from './InvitationsPage';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseOrganizationInvitations = vi.fn();
const mockCreateInvitation           = vi.fn();

vi.mock('../../hooks/useOrganization', () => ({
  useOrganizationInvitations: () => mockUseOrganizationInvitations(),
  useCreateInvitation:        (opts) => mockCreateInvitation(opts),
}));

vi.mock('../../components/ToastNotification/ToastNotification', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../components/Spinner/Spinner', () => ({
  default: ({ message }) => <div>{message}</div>,
}));

let mockTenant = { canInviteMembers: true };
vi.mock('../../context/TenantContext', () => ({
  useTenant: () => mockTenant,
}));

const noopMutation = { mutate: vi.fn(), isPending: false };

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('InvitationsPage', () => {
  it('exibe spinner enquanto carrega', () => {
    mockUseOrganizationInvitations.mockReturnValue({ isLoading: true });
    mockCreateInvitation.mockReturnValue(noopMutation);

    const html = renderToString(<InvitationsPage />);
    expect(html).toContain('Carregando convites');
  });

  it('exibe mensagem de erro quando query falha', () => {
    mockUseOrganizationInvitations.mockReturnValue({ isLoading: false, isError: true, error: new Error('Erro ao carregar') });
    mockCreateInvitation.mockReturnValue(noopMutation);

    const html = renderToString(<InvitationsPage />);
    expect(html).toContain('Erro ao carregar');
  });

  it('lista convites com email, role e status', () => {
    mockUseOrganizationInvitations.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        { _id: 'i1', email: 'joao@e.com', role: 'VIEWER', status: 'PENDING', expiresAt: '2025-12-01' },
        { _id: 'i2', email: 'maria@e.com', role: 'ADMIN', status: 'ACCEPTED', expiresAt: '2025-11-01' },
      ],
    });
    mockCreateInvitation.mockReturnValue(noopMutation);

    const html = renderToString(<InvitationsPage />);
    expect(html).toContain('joao@e.com');
    expect(html).toContain('maria@e.com');
    expect(html).toContain('Pendente');
    expect(html).toContain('Aceito');
    expect(html).toContain('Visualizador');
    expect(html).toContain('Administrador');
  });

  it('exibe formulário de convite para ADMIN/OWNER', () => {
    mockTenant = { canInviteMembers: true };
    mockUseOrganizationInvitations.mockReturnValue({ isLoading: false, isError: false, data: [] });
    mockCreateInvitation.mockReturnValue(noopMutation);

    const html = renderToString(<InvitationsPage />);
    expect(html).toContain('Convidar membro');
    expect(html).toContain('Convidar');
  });

  it('oculta formulário de convite para VIEWER', () => {
    mockTenant = { canInviteMembers: false };
    mockUseOrganizationInvitations.mockReturnValue({ isLoading: false, isError: false, data: [] });
    mockCreateInvitation.mockReturnValue(noopMutation);

    const html = renderToString(<InvitationsPage />);
    expect(html).not.toContain('Convidar membro');
  });

  it('exibe mensagem vazia quando não há convites', () => {
    mockTenant = { canInviteMembers: true };
    mockUseOrganizationInvitations.mockReturnValue({ isLoading: false, isError: false, data: [] });
    mockCreateInvitation.mockReturnValue(noopMutation);

    const html = renderToString(<InvitationsPage />);
    expect(html).toContain('Nenhum convite encontrado');
  });
});
