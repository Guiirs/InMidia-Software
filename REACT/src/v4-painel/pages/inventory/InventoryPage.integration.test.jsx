import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createMockAuth } from '../../test/test-utils.jsx';

let inventoryState;
let authState;

vi.mock('../../providers/InventoryProvider.jsx', () => ({
  default: ({ children }) => children,
  useInventory: () => inventoryState,
}));

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }) => children,
}));

const BASE_INVENTORY = {
  boards: [],
  summary: {
    compact: { total: 0, ocupadas: 0, disponiveis: 0, manutencao: 0, criticas: 0, taxaOcupacao: 0 },
    statusDistribution: [],
  },
  summaryLoading: false,
  summaryError: null,
  loading: false,
  refreshing: false,
  stale: false,
  status: 'success',
  error: null,
  source: 'empty',
  refresh: vi.fn(),
  refreshSummary: vi.fn(),
  setBoardQuery: vi.fn(),
  updateBoard: vi.fn(),
  createBoard: vi.fn(),
  deleteBoard: vi.fn(),
  toggleAvailability: vi.fn(),
  actionLoading: false,
  actionError: null,
  clearActionError: vi.fn(),
};

describe('InventoryPage integration surface', () => {
  beforeEach(() => {
    authState = createMockAuth({
      role: 'admin_empresa',
      permissions: [
        'dashboard.read',
        'inventory.read',
        'inventory.create',
        'inventory.update',
        'inventory.delete',
      ],
    });

    inventoryState = { ...BASE_INVENTORY };
  });

  /* ── Existing contract tests (must stay green) ───────────── */

  it('renderiza empty-state real quando a API V4 retorna lista vazia', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);

    expect(html).toContain('Sem ativos cadastrados');
    expect(html).toContain('Nenhuma placa encontrada com os filtros selecionados.');
    expect(html).not.toContain('PREVIEW');
    expect(html).not.toContain('exibindo dados de preview');
  });

  it('renderiza erro e stale sem quebrar a tela', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');

    inventoryState = { ...BASE_INVENTORY, status: 'error', source: 'error', error: 'Falha V4' };
    expect(renderToString(<InventoryPage />)).toContain('Falha V4');

    inventoryState = { ...BASE_INVENTORY, status: 'stale', source: 'stale', stale: true, error: null };
    expect(renderToString(<InventoryPage />)).toContain('Desatualizado');
  });

  /* ── Header premium ─────────────────────────────────────── */

  it('renderiza título da página "Inventário de Placas"', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Inventário de Placas');
  });

  it('renderiza subtítulo descritivo da página', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('disponibilidade operacional');
  });

  it('renderiza eyebrow "Inventário OOH"', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Inventário OOH');
  });

  /* ── Botão Nova placa ───────────────────────────────────── */

  it('renderiza botão Nova placa quando canCreate=true (admin)', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Nova placa');
  });

  it('não renderiza botão Nova placa quando sem permissão de criação', async () => {
    authState = createMockAuth({
      role: 'viewer',
      permissions: ['inventory.read'],
    });
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).not.toContain('Nova placa');
  });

  /* ── Toolbar / busca / filtros ──────────────────────────── */

  it('renderiza input de busca de placas', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Buscar código ou localização');
  });

  it('renderiza botão de limpar filtros', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Limpar');
  });

  it('renderiza filtros de região, categoria e prioridade', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Filtrar por região');
    expect(html).toContain('Filtrar por categoria');
    expect(html).toContain('Filtrar por prioridade');
  });

  /* ── View toggle ────────────────────────────────────────── */

  it('renderiza view toggle com opções Cards e Tabela', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Cards');
    expect(html).toContain('Tabela');
  });

  /* ── KPIs ───────────────────────────────────────────────── */

  it('renderiza indicadores operacionais (KPIs) no header', async () => {
    inventoryState = {
      ...BASE_INVENTORY,
      source: 'real',
      summary: {
        compact: { total: 42, ocupadas: 28, disponiveis: 10, manutencao: 2, criticas: 2, taxaOcupacao: 0.67 },
        statusDistribution: [],
      },
    };
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('ativos');
    expect(html).toContain('disponíveis');
  });

  /* ── Status rail ────────────────────────────────────────── */

  it('renderiza status rail com opção "Todas"', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Todas');
  });

  /* ── Cards com boards ───────────────────────────────────── */

  it('renderiza cards quando boards estão disponíveis', async () => {
    inventoryState = {
      ...BASE_INVENTORY,
      source: 'real',
      boards: [
        {
          id: 'b1', codigo: 'SP-001', nome: 'Placa SP-001',
          localizacao: 'Av. Paulista', regiao: 'São Paulo',
          status: 'available', categoria: 'Outdoor', prioridade: 'normal',
          cliente: null,
        },
      ],
    };
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('SP-001');
  });

  /* ── Estado de loading ──────────────────────────────────── */

  it('renderiza skeletons durante loading', async () => {
    inventoryState = { ...BASE_INVENTORY, loading: true };
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('inv-skeleton-card');
  });

  /* ── Mapa toggle ────────────────────────────────────────── */

  it('renderiza botão de mapa lateral', async () => {
    const { default: InventoryPage } = await import('./InventoryPage.jsx');
    const html = renderToString(<InventoryPage />);
    expect(html).toContain('Mapa');
  });
});
