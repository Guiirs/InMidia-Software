import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import MembersPage from './MembersPage';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseOrganization      = vi.fn();
const mockUseOrganizationMembers = vi.fn();
const mockUpdateMemberRole     = vi.fn();
const mockUpdateMemberStatus   = vi.fn();

vi.mock('../../hooks/useOrganization', () => ({
  useOrganization:        () => mockUseOrganization(),
  useOrganizationMembers: () => mockUseOrganizationMembers(),
  useUpdateMemberRole:    (opts) => mockUpdateMemberRole(opts),
  useUpdateMemberStatus:  (opts) => mockUpdateMemberStatus(opts),
}));

vi.mock('../../components/ToastNotification/ToastNotification', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../context/ConfirmationContext', () => ({
  useConfirmation: () => vi.fn(),
}));

vi.mock('../../components/Spinner/Spinner', () => ({
  default: ({ message }) => <div>{message}</div>,
}));

let mockTenant = { isOwner: true, membership: null, canManageOrganization: true };
vi.mock('../../context/TenantContext', () => ({
  useTenant: () => mockTenant,
}));

const noopMutation = { mutate: vi.fn(), isPending: false };

// ── Helpers ────────────────────────────────────────────────────────────────────

const setupDefaults = () => {
  mockUseOrganization.mockReturnValue({ data: { name: 'Org Teste', plan: 'PRO' }, isLoading: false });
  mockUpdateMemberRole.mockReturnValue(noopMutation);
  mockUpdateMemberStatus.mockReturnValue(noopMutation);
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('MembersPage', () => {
  it('exibe spinner enquanto carrega', () => {
    mockUseOrganization.mockReturnValue({ isLoading: true });
    mockUseOrganizationMembers.mockReturnValue({ isLoading: true });
    mockUpdateMemberRole.mockReturnValue(noopMutation);
    mockUpdateMemberStatus.mockReturnValue(noopMutation);

    const html = renderToString(<MembersPage />);
    expect(html).toContain('Carregando membros');
  });

  it('exibe mensagem de erro quando query falha', () => {
    setupDefaults();
    mockUseOrganizationMembers.mockReturnValue({ isLoading: false, isError: true, error: new Error('Falha de rede') });

    const html = renderToString(<MembersPage />);
    expect(html).toContain('Falha de rede');
  });

  it('lista membros com nome, role e status', () => {
    setupDefaults();
    mockUseOrganizationMembers.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        { _id: 'm1', role: 'OWNER',  status: 'ACTIVE', user: { name: 'Ana', email: 'ana@e.com' }, createdAt: '2025-01-01' },
        { _id: 'm2', role: 'VIEWER', status: 'ACTIVE', user: { name: 'Bob', email: 'bob@e.com' }, createdAt: '2025-02-01' },
      ],
    });

    const html = renderToString(<MembersPage />);
    expect(html).toContain('Ana');
    expect(html).toContain('Bob');
    expect(html).toContain('Proprietário');
    expect(html).toContain('Visualizador');
  });

  it('exibe nome e plano da organização', () => {
    setupDefaults();
    mockUseOrganizationMembers.mockReturnValue({ isLoading: false, isError: false, data: [] });

    const html = renderToString(<MembersPage />);
    expect(html).toContain('Org Teste');
    expect(html).toContain('PRO');
  });

  it('exibe coluna de ações para OWNER', () => {
    mockTenant = { isOwner: true, membership: null };
    setupDefaults();
    mockUseOrganizationMembers.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ _id: 'm2', role: 'VIEWER', status: 'ACTIVE', user: { name: 'Carlos', email: 'c@e.com' } }],
    });

    const html = renderToString(<MembersPage />);
    expect(html).toContain('Ações');
  });

  it('nao exibe coluna de ações para ADMIN (nao-OWNER)', () => {
    mockTenant = { isOwner: false, membership: null };
    setupDefaults();
    mockUseOrganizationMembers.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ _id: 'm3', role: 'ADMIN', status: 'ACTIVE', user: { name: 'Diana', email: 'd@e.com' } }],
    });

    const html = renderToString(<MembersPage />);
    expect(html).not.toContain('Ações');
  });

  it('exibe mensagem vazia quando lista de membros é vazia', () => {
    setupDefaults();
    mockUseOrganizationMembers.mockReturnValue({ isLoading: false, isError: false, data: [] });

    const html = renderToString(<MembersPage />);
    expect(html).toContain('Nenhum membro encontrado');
  });
});
