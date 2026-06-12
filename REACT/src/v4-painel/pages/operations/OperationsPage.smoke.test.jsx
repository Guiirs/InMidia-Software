/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithV4Providers } from '../../test/test-utils.jsx';
import OperationsPage from './OperationsPage.jsx';

const testState = vi.hoisted(() => ({
  operations: null,
  authPermissions: [],
  boardsResource: null,
}));

vi.mock('../../providers/OperationsProvider.jsx', () => ({
  default: ({ children }) => children,
  useOperations: () => testState.operations,
}));

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    permissions: testState.authPermissions,
    user: { permissions: testState.authPermissions },
    hasPermission: (perm) => testState.authPermissions.includes(perm),
  }),
}));

vi.mock('../../../core/sync-core/hooks/useSyncResource.js', () => ({
  useSyncResource: () => testState.boardsResource,
}));

vi.mock('../../../core/sync-core/hooks/useSyncMutation.js', () => ({
  useSyncMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    mutate: vi.fn(),
    status: 'idle',
    error: null,
    data: null,
    isLoading: false,
  }),
}));

// Also mock the admin components so they don't try to fetch on expand
vi.mock('../../components/operations/OperationCanonicalizationCard.jsx', () => ({
  default: () => <div data-testid="mock-canonicalization-card">Canonicalization Card</div>,
  OperationLinkResolutionModal: () => null,
  getCanonicalizationStatus: () => ({ label: 'Saudável', variant: 'success', className: 'is-healthy' }),
}));

vi.mock('../../components/operations/OperationLinkResolutionQueue.jsx', () => ({
  default: () => <div data-testid="mock-link-queue">Link Resolution Queue</div>,
}));

function operationsContext(overrides = {}) {
  return {
    operations: {
      overview: {
        totalPontos: 42,
        pontosAtivos: 31,
        pontosDisponiveis: 8,
        emManutencao: 3,
        reservados: 2,
        ocupacaoGlobal: 0.74,
        receitaAtiva: 87000,
        alertasRegionais: 2,
        sincronizacao: 'warning',
        ultimaAtualizacao: 'agora',
      },
      health: {
        status: 'attention',
        score: 88,
        pendingCount: 3,
        completedToday: 6,
        warningCount: 2,
        criticalCount: 0,
        sla: {
          overdueOperations: 1,
          dueSoonOperations: 2,
          resolvedOperations: 4,
          averageResolutionMinutes: 90,
          criticalBacklog: 1,
          highPriorityBacklog: 2,
          operationsSlaHealth: 'ATTENTION',
          backlogByPriority: { critical: 1, high: 2, medium: 0, low: 0 },
        },
      },
      sla: {
        overdueOperations: 1,
        dueSoonOperations: 2,
        resolvedOperations: 4,
        averageResolutionMinutes: 90,
        criticalBacklog: 1,
        highPriorityBacklog: 2,
        operationsSlaHealth: 'ATTENTION',
        backlogByPriority: { critical: 1, high: 2, medium: 0, low: 0 },
      },
      regionalOperations: [
        {
          id: 'sp',
          label: 'São Paulo',
          sigla: 'SP',
          responsavel: 'Operação SP',
          ocupacao: 0.81,
          ativos: 18,
          disponiveis: 4,
          emManutencao: 1,
          alertas: 1,
          receitaAtiva: 43000,
        },
      ],
      feed: [
        {
          id: 'feed-1',
          label: 'Ponto atualizado',
          regiao: 'SP',
          tempo: 'agora',
          icone: 'sync',
        },
      ],
      tasks: [],
      pending: [],
      byDomain: {},
      generalizedAt: null,
      generatedAt: '2026-05-24T10:00:00.000Z',
    },
    loading: false,
    refreshing: false,
    stale: false,
    status: 'success',
    error: null,
    source: 'real',
    refresh: vi.fn(),
    createTask: vi.fn(),
    startTask: vi.fn(),
    completeTask: vi.fn(),
    cancelTask: vi.fn(),
    ...overrides,
  };
}

function renderOperations() {
  return renderWithV4Providers(<OperationsPage />, { route: '/operacoes' });
}

describe('OperationsPage smoke', () => {
  beforeEach(() => {
    testState.authPermissions = [];
    testState.operations = operationsContext();
    testState.boardsResource = {
      data: [{ id: 'board-07', codigo: '07', endereco: 'Av. Central', cidade: 'Caucaia', regiao: 'Ceará Norte', status: 'available' }],
      status: 'success',
      error: null,
      isStale: false,
      isRefreshing: false,
      refresh: vi.fn(),
    };
  });

  // ── Núcleo operacional ──────────────────────────────────────────────────

  it('renderiza núcleo operacional: título, KPIs e board', () => {
    renderOperations();

    expect(screen.getByRole('heading', { name: 'Operações' })).toBeInTheDocument();
    expect(screen.getByText('Central operacional')).toBeInTheDocument();
    expect(screen.getByText('Board operacional')).toBeInTheDocument();
    expect(screen.getByLabelText('Indicadores operacionais')).toBeInTheDocument();
  });

  it('renderiza KPIs operacionais esperados', () => {
    renderOperations();

    // Atrasadas aparece tanto no KPI quanto no SLA panel — usar getAllByText
    expect(screen.getByText('Pendentes')).toBeInTheDocument();
    expect(screen.getAllByText('Atrasadas').length).toBeGreaterThan(0);
    expect(screen.getByText('Críticas')).toBeInTheDocument();
    expect(screen.getByText('Instalações')).toBeInTheDocument();
    expect(screen.getByText('Em manutenção')).toBeInTheDocument();
  });

  it('renderiza painel SLA com prioridade operacional', () => {
    renderOperations();

    expect(screen.getByText('Prioridade operacional')).toBeInTheDocument();
    expect(screen.getByText('Vencendo hoje')).toBeInTheDocument();
  });

  it('renderiza tabela de regiões e feed de atividade', () => {
    renderOperations();

    expect(screen.getByText('Execução por região')).toBeInTheDocument();
    expect(screen.getByText('O que mudou')).toBeInTheDocument();
  });

  it('renderiza apenas a ação genérica de nova operação no header', () => {
    renderOperations();

    expect(screen.getByRole('button', { name: /Nova operação/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nova instalação/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Raspagem$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Manutenção$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bloqueio$/i })).not.toBeInTheDocument();
  });

  it('abre o modal redesenhado e oferece a escolha de tipo dentro dele', () => {
    testState.authPermissions = ['operations.create'];
    renderOperations();

    expect(screen.queryByTestId('operation-form-modal-redesigned')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Nova operação/i }));

    const modal = screen.getByTestId('operation-form-modal-redesigned');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Tipo de operação')).toBeInTheDocument();
    expect(within(modal).getByText('Identificação')).toBeInTheDocument();
    expect(within(modal).getByText('Agendamento')).toBeInTheDocument();
    expect(within(modal).getByText('Detalhes específicos')).toBeInTheDocument();
    expect(within(modal).getAllByText('Observações').length).toBeGreaterThan(0);
    expect(within(modal).getByRole('radio', { name: /^Instalação$/i })).toBeChecked();
    expect(within(modal).getByRole('radio', { name: /^Raspagem$/i })).toBeInTheDocument();
    expect(within(modal).getByRole('radio', { name: /^Manutenção$/i })).toBeInTheDocument();
    expect(within(modal).getByRole('radio', { name: /^Bloqueio operacional$/i })).toBeInTheDocument();
  });

  it('cancela usando payload objeto com o id canonico da operacao', async () => {
    const cancelTask = vi.fn().mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    testState.operations = operationsContext({
      cancelTask,
      operations: {
        ...operationsContext().operations,
        tasks: [{ id: 'op-123', title: 'Raspagem 07', status: 'PENDING', operationType: 'SCRAPING', payload: {} }],
      },
    });

    renderOperations();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(cancelTask).toHaveBeenCalledWith({
      id: 'op-123',
      reason: 'Cancelado pelo usuário',
    });
  });

  it('inicia usando payload objeto com o id canonico da operacao', async () => {
    const startTask = vi.fn().mockResolvedValue({});
    testState.operations = operationsContext({
      startTask,
      operations: {
        ...operationsContext().operations,
        tasks: [{ id: 'op-123', title: 'Raspagem 07', status: 'PENDING', operationType: 'SCRAPING', payload: {} }],
      },
    });

    renderOperations();
    fireEvent.click(screen.getByRole('button', { name: /Iniciar/i }));

    expect(startTask).toHaveBeenCalledTimes(1);
    const [payload] = startTask.mock.calls[0];
    expect(typeof payload).toBe('object');
    expect(payload).toMatchObject({ id: 'op-123' });
  });

  it('nao chama a API ao tentar iniciar operacao sem id e mostra erro amigavel', async () => {
    const startTask = vi.fn().mockResolvedValue({});
    testState.operations = operationsContext({
      startTask,
      operations: {
        ...operationsContext().operations,
        tasks: [{ id: '', title: 'Raspagem sem id', status: 'PENDING', operationType: 'SCRAPING', payload: {} }],
      },
    });

    renderOperations();
    fireEvent.click(screen.getByRole('button', { name: /Iniciar/i }));

    expect(startTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível iniciar esta operação porque o identificador está ausente.',
    );
  });

  // ── Separação admin / operacional ──────────────────────────────────────

  it('usuário comum NÃO vê seção de diagnóstico avançado', () => {
    testState.authPermissions = [];
    renderOperations();

    expect(screen.queryByTestId('ops-advanced-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-canonicalization-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-link-queue')).not.toBeInTheDocument();
  });

  it('admin vê botão de diagnóstico avançado colapsado', () => {
    testState.authPermissions = ['admin.access'];
    renderOperations();

    expect(screen.getByTestId('ops-advanced-section')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Diagnóstico avançado/i })).toBeInTheDocument();
    // Conteúdo admin NÃO visível enquanto colapsado
    expect(screen.queryByTestId('mock-canonicalization-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-link-queue')).not.toBeInTheDocument();
  });

  it('admin expande diagnóstico avançado e vê as ferramentas técnicas', () => {
    testState.authPermissions = ['admin.access'];
    renderOperations();

    const toggleBtn = screen.getByRole('button', { name: /Diagnóstico avançado/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('mock-canonicalization-card')).toBeInTheDocument();
    expect(screen.getByTestId('mock-link-queue')).toBeInTheDocument();
    expect(screen.getByText(/Ferramentas técnicas para saúde dos vínculos operacionais/i)).toBeInTheDocument();
  });

  it('canonicalization card NÃO aparece na área principal para nenhum perfil', () => {
    // Non-admin: not at all
    renderOperations();
    expect(screen.queryByTestId('mock-canonicalization-card')).not.toBeInTheDocument();
  });

  // ── Cards de operação ───────────────────────────────────────────────────

  it('renderiza cards de operação com SLA, prioridade e ações', () => {
    testState.operations = operationsContext({
      operations: {
        ...operationsContext().operations,
        tasks: [
          {
            id: 'task-1',
            title: 'Instalação SP-01',
            payload: { operationType: 'INSTALLATION', operationStatus: 'PENDING', priority: 'HIGH', plateId: 'abc123' },
            slaStatus: 'DUE_SOON',
          },
          {
            id: 'task-2',
            title: 'Raspagem RJ-05',
            payload: { operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', priority: 'MEDIUM' },
            slaStatus: 'OVERDUE',
          },
        ],
      },
    });

    renderOperations();

    expect(screen.getByText('Instalação SP-01')).toBeInTheDocument();
    expect(screen.getByText('Raspagem RJ-05')).toBeInTheDocument();

    // Badge contents: V4Badge pode gerar múltiplos nós com o mesmo texto (wrapper + inner)
    expect(screen.getAllByText('Instalação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vence hoje').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Atrasada').length).toBeGreaterThan(0);

    // Ações corretas por status
    expect(screen.getAllByRole('button', { name: /Iniciar/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Concluir/i }).length).toBeGreaterThan(0);
  });

  it('exibe a equipe responsável e o total de integrantes no card da operação', () => {
    testState.operations = operationsContext({
      operations: {
        ...operationsContext().operations,
        tasks: [
          {
            id: 'task-team-1',
            title: 'Instalação SP-02',
            payload: {
              operationType: 'INSTALLATION',
              operationStatus: 'PENDING',
              priority: 'MEDIUM',
              teamId: 'team-1',
              teamSnapshot: { id: 'team-1', name: 'Equipe Instalação Norte', memberCount: 2, members: [] },
            },
            slaStatus: 'ON_TRACK',
          },
        ],
      },
    });

    renderOperations();

    expect(screen.getByText('Equipe: Equipe Instalação Norte · 2 integrantes')).toBeInTheDocument();
  });

  // ── Conclusão de manutenção (relatório final obrigatório) ────────────────

  describe('Conclusão de manutenção', () => {
    function renderWithMaintenanceTask() {
      const completeTask = vi.fn().mockResolvedValue(undefined);
      testState.operations = operationsContext({
        operations: {
          ...operationsContext().operations,
          tasks: [
            {
              id: 'task-maint-1',
              title: 'Manutenção preventiva PL-009',
              payload: { operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', priority: 'MEDIUM', plateId: 'plate-009' },
              slaStatus: 'ON_TRACK',
            },
          ],
        },
        completeTask,
      });
      renderOperations();
      return { completeTask };
    }

    it('abre o modal de relatório final ao concluir uma manutenção em andamento', () => {
      renderWithMaintenanceTask();

      expect(screen.queryByTestId('maintenance-completion-modal')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Concluir/i }));

      expect(screen.getByTestId('maintenance-completion-modal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Concluir manutenção' })).toBeInTheDocument();
    });

    it('bloqueia a conclusão sem relatório final preenchido', async () => {
      const { completeTask } = renderWithMaintenanceTask();

      fireEvent.click(screen.getByRole('button', { name: /Concluir/i }));
      fireEvent.click(screen.getByRole('button', { name: /Concluir manutenção/i }));

      expect(await screen.findByText('Relatório final é obrigatório para concluir a manutenção.')).toBeInTheDocument();
      expect(completeTask).not.toHaveBeenCalled();
    });

    it('conclui a manutenção enviando { id, finalReport } quando o relatório é preenchido', async () => {
      const { completeTask } = renderWithMaintenanceTask();

      fireEvent.click(screen.getByRole('button', { name: /Concluir/i }));

      const textarea = screen.getByLabelText(/Relatório final/i);
      fireEvent.change(textarea, { target: { value: 'Troca de lâmpadas e revisão da estrutura.' } });
      fireEvent.click(screen.getByRole('button', { name: /Concluir manutenção/i }));

      await vi.waitFor(() => {
        expect(completeTask).toHaveBeenCalledWith({ id: 'task-maint-1', finalReport: 'Troca de lâmpadas e revisão da estrutura.' });
      });
    });
  });

  // ── Conclusão de operações não-manutenção (raspagem, instalação, etc.) ───

  describe('Conclusão de operação não-manutenção', () => {
    it('conclui uma raspagem em andamento enviando { id, completedAt }', async () => {
      const completeTask = vi.fn().mockResolvedValue(undefined);
      testState.operations = operationsContext({
        operations: {
          ...operationsContext().operations,
          tasks: [
            {
              id: 'task-scrap-1',
              title: 'Raspagem RJ-05',
              payload: { operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', priority: 'MEDIUM', plateId: 'plate-rj-05' },
              slaStatus: 'ON_TRACK',
            },
          ],
        },
        completeTask,
      });
      renderOperations();

      fireEvent.click(screen.getByRole('button', { name: /Concluir/i }));

      await vi.waitFor(() => {
        expect(completeTask).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'task-scrap-1', completedAt: expect.any(String) }),
        );
      });
      const [payload] = completeTask.mock.calls[0];
      expect(typeof payload).toBe('object');
      expect(payload.id).toBe('task-scrap-1');
    });

    it('exibe erro amigavel e nao chama completeTask quando o identificador da operacao esta ausente', async () => {
      const completeTask = vi.fn().mockResolvedValue(undefined);
      testState.operations = operationsContext({
        operations: {
          ...operationsContext().operations,
          tasks: [
            {
              id: undefined,
              title: 'Raspagem sem id',
              payload: { operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', priority: 'MEDIUM', plateId: 'plate-rj-06' },
              slaStatus: 'ON_TRACK',
            },
          ],
        },
        completeTask,
      });
      renderOperations();

      fireEvent.click(screen.getByRole('button', { name: /Concluir/i }));

      expect(await screen.findByText('Não foi possível concluir esta operação porque o identificador está ausente.')).toBeInTheDocument();
      expect(completeTask).not.toHaveBeenCalled();
    });
  });

  // ── Erros amigáveis de criação/conclusão ────────────────────────────────

  describe('Tratamento de erros amigáveis', () => {
    function apiError(code, field) {
      const err = new Error('erro tecnico');
      err.code = code;
      err.field = field;
      err.requestId = 'req-123';
      return err;
    }

    it('exibe mensagem amigavel e destaca o campo Placa quando criação falha com OPERATION_BOARD_NOT_FOUND', async () => {
      testState.authPermissions = ['operations.create'];
      const createTask = vi.fn().mockRejectedValue(apiError('OPERATION_BOARD_NOT_FOUND', 'boardId'));
      testState.operations = operationsContext({ createTask });
      renderOperations();

      fireEvent.click(screen.getByRole('button', { name: /Nova operação/i }));
      const modal = screen.getByTestId('operation-form-modal-redesigned');

      fireEvent.click(within(modal).getByRole('radio', { name: 'Raspagem' }));
      fireEvent.focus(within(modal).getByRole('combobox', { name: /^Placa/ }));
      fireEvent.click(within(modal).getByRole('button', { name: /Placa 07/ }));
      fireEvent.click(within(modal).getByRole('button', { name: 'Criar operação' }));

      expect(await screen.findByTestId('operation-form-error-banner')).toBeInTheDocument();
      expect(screen.getByText('Não foi possível criar a operação.')).toBeInTheDocument();
      expect(screen.getByText(/Não encontramos a placa selecionada/)).toBeInTheDocument();
      expect(screen.getByText('Placa não encontrada.')).toBeInTheDocument();

      // mensagem tecnica nunca aparece
      const pageText = document.body.textContent;
      expect(pageText).not.toContain('erro tecnico');
      expect(pageText).not.toContain('empresaId');
    });

    it('limpa o erro de criação ao fechar e reabrir o modal', async () => {
      testState.authPermissions = ['operations.create'];
      const createTask = vi.fn().mockRejectedValue(apiError('OPERATION_BOARD_NOT_FOUND', 'boardId'));
      testState.operations = operationsContext({ createTask });
      renderOperations();

      fireEvent.click(screen.getByRole('button', { name: /Nova operação/i }));
      let modal = screen.getByTestId('operation-form-modal-redesigned');
      fireEvent.click(within(modal).getByRole('radio', { name: 'Raspagem' }));
      fireEvent.focus(within(modal).getByRole('combobox', { name: /^Placa/ }));
      fireEvent.click(within(modal).getByRole('button', { name: /Placa 07/ }));
      fireEvent.click(within(modal).getByRole('button', { name: 'Criar operação' }));

      expect(await screen.findByTestId('operation-form-error-banner')).toBeInTheDocument();

      fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByTestId('operation-form-modal-redesigned')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Nova operação/i }));
      modal = screen.getByTestId('operation-form-modal-redesigned');
      expect(within(modal).queryByTestId('operation-form-error-banner')).not.toBeInTheDocument();
    });

    it('exibe mensagem amigavel e destaca o relatório final quando conclusão de manutenção falha com OPERATION_FINAL_REPORT_REQUIRED', async () => {
      const completeTask = vi.fn().mockRejectedValue(apiError('OPERATION_FINAL_REPORT_REQUIRED', 'finalReport'));
      testState.operations = operationsContext({
        operations: {
          ...operationsContext().operations,
          tasks: [
            {
              id: 'task-maint-2',
              title: 'Manutenção corretiva PL-010',
              payload: { operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', priority: 'MEDIUM', plateId: 'plate-010' },
              slaStatus: 'ON_TRACK',
            },
          ],
        },
        completeTask,
      });
      renderOperations();

      fireEvent.click(screen.getByRole('button', { name: /Concluir/i }));
      fireEvent.change(screen.getByLabelText(/Relatório final/i), { target: { value: 'Relatório qualquer' } });
      fireEvent.click(screen.getByRole('button', { name: /Concluir manutenção/i }));

      expect(await screen.findByTestId('maintenance-completion-error-banner')).toBeInTheDocument();
      expect(screen.getByText('Não foi possível concluir a manutenção.')).toBeInTheDocument();
      expect(screen.getByText(/Informe o relatório final da manutenção/)).toBeInTheDocument();
      expect(screen.getByText('Relatório final é obrigatório.')).toBeInTheDocument();
    });
  });

  // ── Estado de erro ──────────────────────────────────────────────────────

  it('mostra erro acionável sem mascarar falha real', () => {
    testState.operations = operationsContext({
      status: 'error',
      source: 'error',
      error: 'Não foi possível atualizar os dados agora.',
    });

    renderOperations();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
  });

  // ── Linguagem operacional ───────────────────────────────────────────────

  it('mantém linguagem operacional sem termos técnicos proibidos na área principal', () => {
    renderOperations();
    const pageText = document.body.textContent.toLowerCase();

    expect(pageText).not.toContain('mock');
    expect(pageText).not.toContain('payload');
    expect(pageText).not.toContain('provider unavailable');
    expect(pageText).not.toContain('sync error');
    expect(pageText).not.toContain('websocket');
    expect(pageText).not.toContain('runtime debug');
    // Termos técnicos de diagnóstico NÃO devem aparecer para usuários comuns
    expect(pageText).not.toContain('canonicalização');
    expect(pageText).not.toContain('backfill');
    expect(pageText).not.toContain('unresolved');
    expect(pageText).not.toContain('ambiguous');
  });

  it('admin exposto a termos técnicos apenas dentro da seção avançada expandida', () => {
    testState.authPermissions = ['admin.access'];
    renderOperations();

    // Antes de expandir: sem termos técnicos visíveis
    expect(document.body.textContent.toLowerCase()).not.toContain('canonicalização');

    // Após expandir: termos técnicos aparecem na seção avançada (componentes mockados renderizam texto genérico)
    const toggleBtn = screen.getByRole('button', { name: /Diagnóstico avançado/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('mock-canonicalization-card')).toBeInTheDocument();
  });
});
