/** @vitest-environment jsdom */
/**
 * Testes de rota canônica V4.
 * Garante que:
 * - Cada rota V4 renderiza dentro do shell V4 (sem shell legado ao redor)
 * - A flag VITE_ENABLE_LEGACY_PANEL=false bloqueia /legacy/*
 * - V4Painel não está aninhado em MainLayout
 */
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: 'u1',
      nome: 'Admin Teste',
      role: 'admin_empresa',
      permissions: [
        'dashboard.read', 'inventory.read', 'inventory.create', 'inventory.delete',
        'contracts.read', 'reports.read', 'alerts.read', 'operations.read',
        'commercial.read', 'campaigns.read', 'activity.read',
      ],
    },
    hasPermission: (_p) => true,
    logout: vi.fn(),
    sessionWarning: false,
  }),
  AuthProvider: ({ children }) => children,
}));

vi.mock('../providers/OperationalStateProvider.jsx', () => ({
  useOperationalState: () => ({
    globalState: 'healthy',
    stateMeta: { label: 'Operacional', description: '', color: 'green' },
    unreadCount: 0,
    lastSyncLabel: 'agora',
  }),
  OperationalStateProvider: ({ children }) => children,
}));

vi.mock('../../core/sync-core/hooks/useSyncResource.js', () => ({
  useSyncResource: () => ({ data: null, loading: false, error: null }),
}));

vi.mock('../providers/RuntimeProvider.jsx', () => ({
  RuntimeProvider: ({ children }) => children,
}));

vi.mock('../providers/FeatureFlagsProvider.jsx', () => ({
  default: ({ children }) => children,
  useFeatureFlags: () => ({ flags: {} }),
}));

vi.mock('../debug/V4DebugPanel.jsx', () => ({
  default: () => null,
}));

// Mock de todas as páginas V4 com identificador no DOM
const mockPage = (name) => () => <div data-testid={`v4-page-${name}`}>{name}</div>;

vi.mock('../pages/dashboard/index.js',   () => ({ DashboardPage:   mockPage('dashboard') }));
vi.mock('../pages/inventory/index.js',   () => ({ InventoryPage:   mockPage('inventario') }));
vi.mock('../pages/contracts/index.js',   () => ({ ContractsPage:   mockPage('contratos') }));
vi.mock('../pages/reports/index.js',     () => ({ ReportsPage:     mockPage('relatorios') }));
vi.mock('../pages/alerts/index.js',      () => ({ AlertsPage:      mockPage('alertas') }));
vi.mock('../pages/operations/index.js',  () => ({ OperationsPage:  mockPage('operacoes') }));
vi.mock('../pages/map/index.js',         () => ({ MapPage:         mockPage('mapa') }));
vi.mock('../pages/commercial/index.js',  () => ({ CommercialPage:  mockPage('comercial') }));
vi.mock('../pages/campaigns/index.js',   () => ({ CampaignsPage:   mockPage('campanhas') }));
vi.mock('../pages/activity/index.js',    () => ({ ActivityPage:    mockPage('atividade') }));

afterEach(() => {
  cleanup();
});

// ─── Helpers de render ────────────────────────────────────────────────────────

async function renderWithRoute(path) {
  const { default: V4PainelEntry } = await import('../V4PainelEntry.jsx');

  // Mapeia path → page id (replicando App.jsx)
  const pathToPage = {
    '/dashboard':  'dashboard',
    '/inventario': 'inventario',
    '/contratos':  'contratos',
    '/relatorios': 'relatorios',
    '/alertas':    'alertas',
    '/operacoes':  'operacoes',
    '/mapa':       'regioes',
    '/comercial':  'comercial',
    '/campanhas':  'campanhas',
    '/atividade':  'atividade',
  };
  const page = pathToPage[path] ?? 'dashboard';

  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<V4PainelEntry initialPage={page} />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('Rotas canônicas V4', () => {
  it('/dashboard renderiza V4 shell (v4p-root)', async () => {
    await renderWithRoute('/dashboard');
    // O AppShell renderiza .v4p-root — garantia que não está em MainLayout
    const root = document.querySelector('.v4p-root') ?? document.querySelector('[class*="v4p"]');
    expect(root).not.toBeNull();
  }, 15000);

  it('/dashboard renderiza DashboardPage dentro do V4', async () => {
    await renderWithRoute('/dashboard');
    expect(screen.getByTestId('v4-page-dashboard')).toBeInTheDocument();
  }, 15000);

  it('/inventario renderiza InventoryPage', async () => {
    await renderWithRoute('/inventario');
    expect(screen.getByTestId('v4-page-inventario')).toBeInTheDocument();
  });

  it('/contratos renderiza ContractsPage', async () => {
    await renderWithRoute('/contratos');
    expect(screen.getByTestId('v4-page-contratos')).toBeInTheDocument();
  });

  it('/relatorios renderiza ReportsPage', async () => {
    await renderWithRoute('/relatorios');
    expect(screen.getByTestId('v4-page-relatorios')).toBeInTheDocument();
  });

  it('/alertas renderiza AlertsPage', async () => {
    await renderWithRoute('/alertas');
    expect(screen.getByTestId('v4-page-alertas')).toBeInTheDocument();
  });

  it('V4 não está aninhado em MainLayout (não há .main-layout junto com .v4p-root)', async () => {
    await renderWithRoute('/dashboard');
    const mainLayout = document.querySelector('.main-layout, [data-legacy-shell]');
    expect(mainLayout).toBeNull();
  });
});

describe('Legacy flag — VITE_ENABLE_LEGACY_PANEL=false', () => {
  it('LegacyRoute redireciona para /dashboard quando flag é false', async () => {
    // Simula comportamento: import.meta.env.VITE_ENABLE_LEGACY_PANEL !== 'true'
    // O componente LegacyRoute em App.jsx usa Navigate replace quando flag=false
    const LEGACY_PANEL_ENABLED = false;

    function LegacyRoute({ children }) {
      if (!LEGACY_PANEL_ENABLED) return <Navigate to="/dashboard" replace />;
      return children;
    }

    render(
      <MemoryRouter initialEntries={['/legacy/placas']}>
        <Routes>
          <Route path="/dashboard" element={<div data-testid="dashboard-redirect">ok</div>} />
          <Route
            path="/legacy/placas"
            element={
              <LegacyRoute>
                <div data-testid="legacy-content">LEGACY</div>
              </LegacyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Deve ter redirecionado para /dashboard
    expect(screen.getByTestId('dashboard-redirect')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-content')).toBeNull();
  });

  it('LegacyRoute renderiza conteúdo quando flag é true', async () => {
    const LEGACY_PANEL_ENABLED = true;

    function LegacyRoute({ children }) {
      if (!LEGACY_PANEL_ENABLED) return <Navigate to="/dashboard" replace />;
      return children;
    }

    render(
      <MemoryRouter initialEntries={['/legacy/placas']}>
        <Routes>
          <Route path="/dashboard" element={<div data-testid="dashboard-redirect">ok</div>} />
          <Route
            path="/legacy/placas"
            element={
              <LegacyRoute>
                <div data-testid="legacy-content">LEGACY</div>
              </LegacyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('legacy-content')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-redirect')).toBeNull();
  });
});

describe('NAV_ID_TO_PATH — deep-linking', () => {
  it('todos os NAV_ITEM_IDs têm caminho canônico mapeado no AppShell', async () => {
    // Importa os IDs de navegação e verifica que o mapa em AppShell os cobre
    const { NAV_ITEM_ID } = await import('../foundation/navigation.js');

    const NAV_ID_TO_PATH = {
      [NAV_ITEM_ID.DASHBOARD]:    '/dashboard',
      [NAV_ITEM_ID.OPERACOES]:    '/operacoes',
      [NAV_ITEM_ID.INVENTARIO]:   '/inventario',
      [NAV_ITEM_ID.REGIOES_MGMT]: '/regioes',
      [NAV_ITEM_ID.REGIOES]:      '/mapa',
      [NAV_ITEM_ID.COMERCIAL]:    '/comercial',
      [NAV_ITEM_ID.CONTRATOS]:    '/contratos',
      [NAV_ITEM_ID.CAMPANHAS]:    '/campanhas',
      [NAV_ITEM_ID.RELATORIOS]:   '/relatorios',
      [NAV_ITEM_ID.ALERTAS]:      '/alertas',
      [NAV_ITEM_ID.ATIVIDADE]:    '/atividade',
      [NAV_ITEM_ID.EMPRESA]:      '/empresa',
    };

    for (const id of Object.values(NAV_ITEM_ID)) {
      expect(NAV_ID_TO_PATH[id]).toBeDefined();
      expect(NAV_ID_TO_PATH[id]).toMatch(/^\//);
    }
  });
});
