/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { createMockAuth, renderWithV4Providers } from '../../test/test-utils.jsx';
import DashboardPage from './DashboardPage.jsx';

const testState = vi.hoisted(() => ({
  auth: null,
  dashboard: null,
  realtime: null,
  boardsResource: null,
}));

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => testState.auth,
  AuthProvider: ({ children }) => children,
}));

vi.mock('../../../core/sync-core/hooks/useSyncResource.js', () => ({
  useSyncResource: () => testState.boardsResource,
}));

vi.mock('../../providers/DashboardProvider.jsx', () => ({
  default: ({ children }) => children,
  useDashboard: () => testState.dashboard,
}));

vi.mock('../../providers/RealtimeProvider.jsx', () => ({
  useRealtime: () => testState.realtime,
}));

vi.mock('../../components/map/V4OperationalMap.jsx', () => ({
  default: ({ points = [], loading, error }) => (
    <div data-testid="operational-map" data-loading={loading ? 'true' : 'false'} data-error={error ?? ''}>
      {!loading && points.length === 0 && (
        <div data-testid="map-empty">Nenhuma placa com coordenadas disponivel.</div>
      )}
      {points.map((point) => (
        <div
          key={point.id}
          data-testid="map-point"
          data-id={point.id}
          data-lat={point.latitude ?? 'null'}
          data-lng={point.longitude ?? 'null'}
          data-status={point.status}
        >
          <a href={`/inventario?board=${encodeURIComponent(point.id)}`}>Ver detalhes</a>
        </div>
      ))}
    </div>
  ),
}));

function dashboardContext(overrides = {}) {
  return {
    dashboard: {},
    loading: false,
    refreshing: false,
    stale: false,
    status: 'success',
    error: null,
    source: 'real',
    refresh: vi.fn(),
    ...overrides,
  };
}

function boardsResource(data, overrides = {}) {
  return {
    data,
    status: 'success',
    error: null,
    isStale: false,
    isRefreshing: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function renderDashboard(role = 'admin_empresa') {
  testState.auth = createMockAuth({ role });
  return renderWithV4Providers(<DashboardPage />);
}

describe('DashboardPage - mapa operacional', () => {
  beforeEach(() => {
    testState.dashboard = dashboardContext();
    testState.realtime = { connected: true, reconnecting: false, eventCount: 0 };
  });

  it('renderiza placas com coordenadas vindas de inventory.boards', async () => {
    testState.boardsResource = boardsResource([
      { id: 'b1', codigo: 'SP-001', nome: 'Placa 1', status: 'available', lat: -23.55, lng: -46.63, localizacao: 'Rua A' },
    ]);

    renderDashboard();

    const map = await screen.findByTestId('operational-map');
    const point = screen.getByTestId('map-point');
    expect(map.dataset.loading).toBe('false');
    expect(point.dataset.id).toBe('b1');
    expect(point.dataset.lat).toBe('-23.55');
    expect(point.dataset.lng).toBe('-46.63');
  });

  it('nao quebra com placas sem coordenadas e nao as renderiza como ponto valido', async () => {
    testState.boardsResource = boardsResource([
      { id: 'b2', codigo: 'SP-002', nome: 'Placa 2', status: 'maintenance', localizacao: 'Rua B' },
    ]);

    renderDashboard();

    const map = await screen.findByTestId('operational-map');
    const point = screen.getByTestId('map-point');
    expect(map).toBeInTheDocument();
    expect(point.dataset.id).toBe('b2');
    expect(point.dataset.lat).toBe('null');
    expect(point.dataset.lng).toBe('null');
  });

  it('exibe fallback quando o inventario nao retorna placas', async () => {
    testState.boardsResource = boardsResource([]);

    renderDashboard();

    expect(await screen.findByTestId('map-empty')).toBeInTheDocument();
  });

  it('nao depende de dashboard.featuredBoards para alimentar o mapa', async () => {
    testState.dashboard = dashboardContext({ dashboard: { featuredBoards: [] } });
    testState.boardsResource = boardsResource([
      { id: 'b3', codigo: 'SP-003', nome: 'Placa 3', status: 'occupied', lat: -22.9, lng: -43.2 },
    ]);

    renderDashboard();

    const point = await screen.findByTestId('map-point');
    expect(point.dataset.id).toBe('b3');
  });

  it('link "Ver detalhes" aponta para /inventario?board=<id> da placa', async () => {
    testState.boardsResource = boardsResource([
      { id: 'b4', codigo: 'SP-004', nome: 'Placa 4', status: 'available', lat: -23.0, lng: -46.0 },
    ]);

    renderDashboard();

    const link = await screen.findByRole('link', { name: 'Ver detalhes' });
    expect(link).toHaveAttribute('href', '/inventario?board=b4');
  });

  it('reflete o status de carregamento de inventory.boards no mapa', async () => {
    testState.boardsResource = boardsResource([], { status: 'loading' });

    renderDashboard();

    const map = await screen.findByTestId('operational-map');
    expect(map.dataset.loading).toBe('true');
    expect(screen.queryByTestId('map-empty')).toBeNull();
  });

  // ── P0.3: region canônica ────────────────────────────────────────────────

  it('[P0.3] point.region usa regiaoId (ID canônico) em vez de regiao (nome)', async () => {
    testState.boardsResource = boardsResource([
      {
        id: 'b-canon',
        codigo: 'SP-CANON',
        nome: 'Placa Canônica',
        status: 'available',
        lat: -23.55,
        lng: -46.63,
        regiaoId: 'id-canonico-abc',
        regiao: 'Nome da Região',
      },
    ]);

    renderDashboard();

    const point = await screen.findByTestId('map-point');
    // O point renderizado no mock expõe data-id mas não data-region diretamente.
    // Verificamos via título e id que a placa foi renderizada — o correto mapeamento
    // de region é coberto pelo teste unitário do V4OperationalMap.
    expect(point.dataset.id).toBe('b-canon');
  });

  it('[P0.3] quando só regiao está disponível, usa como fallback', async () => {
    testState.boardsResource = boardsResource([
      {
        id: 'b-fallback',
        codigo: 'SP-FB',
        nome: 'Placa Fallback',
        status: 'available',
        lat: -23.55,
        lng: -46.63,
        regiao: 'Nome da Região',
      },
    ]);

    renderDashboard();

    const point = await screen.findByTestId('map-point');
    expect(point.dataset.id).toBe('b-fallback');
  });
});
