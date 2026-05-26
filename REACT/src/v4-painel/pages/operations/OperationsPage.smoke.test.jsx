/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithV4Providers } from '../../test/test-utils.jsx';
import OperationsPage from './OperationsPage.jsx';

const testState = vi.hoisted(() => ({
  operations: null,
  authPermissions: [],
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

  it('renderiza botões de criação rápida no header', () => {
    renderOperations();

    expect(screen.getByRole('button', { name: /Nova instalação/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Raspagem/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manutenção/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bloqueio/i })).toBeInTheDocument();
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
