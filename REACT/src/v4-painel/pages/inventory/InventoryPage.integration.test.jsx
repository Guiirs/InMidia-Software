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

    inventoryState = {
      boards: [],
      summary: { compact: { total: 0, ocupadas: 0, disponiveis: 0, manutencao: 0, criticas: 0, taxaOcupacao: 0 }, statusDistribution: [] },
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
  });

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

    inventoryState = {
      ...inventoryState,
      status: 'error',
      source: 'error',
      error: 'Falha V4',
    };
    expect(renderToString(<InventoryPage />)).toContain('Falha V4');

    inventoryState = {
      ...inventoryState,
      status: 'stale',
      source: 'stale',
      stale: true,
      error: null,
    };
    expect(renderToString(<InventoryPage />)).toContain('Desatualizado');
  });
});
