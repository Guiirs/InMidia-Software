// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import OperationTeamsPanel from './OperationTeamsPanel.jsx';

const testState = vi.hoisted(() => ({
  teamsResource: null,
  authPermissions: [],
  mutations: {},
}));

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    hasPermission: (permission) => testState.authPermissions.includes(permission),
  }),
}));

vi.mock('../../../core/sync-core/hooks/useSyncResource.js', () => ({
  useSyncResource: (key) => {
    if (key !== 'operations.teams') throw new Error(`Recurso inesperado: ${key}`);
    return testState.teamsResource;
  },
}));

vi.mock('../../../core/sync-core/hooks/useSyncMutation.js', () => ({
  useSyncMutation: (key) => testState.mutations[key],
}));

function resource(overrides = {}) {
  return {
    data: [],
    status: 'success',
    error: null,
    isStale: false,
    isRefreshing: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function mutation(overrides = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue({}),
    mutate: vi.fn(),
    status: 'idle',
    error: null,
    data: null,
    isLoading: false,
    ...overrides,
  };
}

const TEAMS = [
  {
    id: 'team-1',
    name: 'Equipe Instalação Norte',
    members: [
      { name: 'João Silva', role: 'Instalador', phone: '11999990000', active: true },
      { name: 'Maria Souza', role: 'Auxiliar', phone: null, active: true },
    ],
    memberCount: 2,
    notes: null,
    status: 'ACTIVE',
  },
  {
    id: 'team-2',
    name: 'Equipe Antiga',
    members: [{ name: 'Carlos Pereira', role: null, phone: null, active: true }],
    memberCount: 1,
    notes: null,
    status: 'ARCHIVED',
  },
];

describe('OperationTeamsPanel', () => {
  beforeEach(() => {
    testState.authPermissions = ['operations.read', 'operations.create', 'operations.update'];
    testState.teamsResource = resource({ data: TEAMS });
    testState.mutations = {
      'operations.team.create': mutation(),
      'operations.team.update': mutation(),
      'operations.team.archive': mutation(),
    };
  });

  it('renderiza a lista de equipes ativas', () => {
    render(<OperationTeamsPanel />);

    expect(screen.getByText('Equipes operacionais')).toBeInTheDocument();
    expect(screen.getByText('Equipe Instalação Norte')).toBeInTheDocument();
    expect(screen.getByText('2 integrantes')).toBeInTheDocument();
    expect(screen.queryByText('Equipe Antiga')).not.toBeInTheDocument();
  });

  it('exibe o botão "Nova equipe" no header do painel, com ícone "add"', () => {
    const { container } = render(<OperationTeamsPanel />);

    const button = screen.getByTestId('operation-team-new-btn');
    const header = container.querySelector('.v4-ui-card__header');

    expect(header).toContainElement(button);
    expect(within(header).getByText('add', { selector: '.material-symbols-rounded' })).toBeInTheDocument();
    expect(within(button).getByText('Nova equipe')).toBeInTheDocument();
  });

  it('abre o formulário de equipe ao clicar em "Nova equipe"', () => {
    render(<OperationTeamsPanel />);

    expect(screen.queryByTestId('operation-team-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('operation-team-new-btn'));

    expect(screen.getByTestId('operation-team-form')).toBeInTheDocument();
    expect(screen.getByText('Nova equipe', { selector: '.v4p-teams-form__title' })).toBeInTheDocument();
  });

  it('alterna para a aba de arquivadas', () => {
    render(<OperationTeamsPanel />);

    fireEvent.click(screen.getByRole('tab', { name: 'Arquivadas' }));

    expect(screen.getByText('Equipe Antiga')).toBeInTheDocument();
    expect(screen.queryByText('Equipe Instalação Norte')).not.toBeInTheDocument();
  });

  it('cria uma equipe com integrantes e recalcula a contagem ao alternar ativo/inativo', async () => {
    const createMutation = mutation();
    testState.mutations['operations.team.create'] = createMutation;
    render(<OperationTeamsPanel />);

    fireEvent.click(screen.getByTestId('operation-team-new-btn'));

    const form = screen.getByTestId('operation-team-form');
    fireEvent.change(within(form).getByLabelText('Nome da equipe *'), { target: { value: 'Equipe Sul' } });
    fireEvent.change(within(form).getByLabelText('Nome do integrante 1'), { target: { value: 'Ana Lima' } });

    expect(within(form).getByTestId('operation-team-member-count')).toHaveTextContent('1 integrante ativo');

    fireEvent.click(within(form).getByLabelText('Ativo'));
    expect(within(form).getByTestId('operation-team-member-count')).toHaveTextContent('0 integrantes ativos');

    fireEvent.click(within(form).getByLabelText('Ativo'));
    expect(within(form).getByTestId('operation-team-member-count')).toHaveTextContent('1 integrante ativo');

    fireEvent.click(within(form).getByRole('button', { name: 'Salvar equipe' }));

    await vi.waitFor(() => {
      expect(createMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Equipe Sul',
        members: [expect.objectContaining({ name: 'Ana Lima', active: true })],
      }));
    });
  });

  it('exibe mensagem amigável quando o nome da equipe já existe (409)', async () => {
    const error = new Error('erro tecnico');
    error.code = 'OPERATION_TEAM_NAME_CONFLICT';
    error.field = 'name';
    const createMutation = mutation({ mutateAsync: vi.fn().mockRejectedValue(error) });
    testState.mutations['operations.team.create'] = createMutation;
    render(<OperationTeamsPanel />);

    fireEvent.click(screen.getByTestId('operation-team-new-btn'));
    const form = screen.getByTestId('operation-team-form');
    fireEvent.change(within(form).getByLabelText('Nome da equipe *'), { target: { value: 'Equipe Instalação Norte' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar equipe' }));

    expect(await screen.findByText('Já existe uma equipe cadastrada com esse nome.')).toBeInTheDocument();
  });

  it('arquiva uma equipe ativa', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const archiveMutation = mutation();
    testState.mutations['operations.team.archive'] = archiveMutation;
    render(<OperationTeamsPanel />);

    const row = screen.getByText('Equipe Instalação Norte').closest('[data-testid="operation-team-row"]');
    fireEvent.click(within(row).getByRole('button', { name: /Arquivar/i }));

    await vi.waitFor(() => {
      expect(archiveMutation.mutateAsync).toHaveBeenCalledWith({ id: 'team-1' });
    });
  });

  it('oculta ações de gestão sem permissão de criação/atualização', () => {
    testState.authPermissions = ['operations.read'];
    render(<OperationTeamsPanel />);

    expect(screen.queryByTestId('operation-team-new-btn')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arquivar/i })).not.toBeInTheDocument();
  });
});
