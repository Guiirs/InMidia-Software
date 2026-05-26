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
}));

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => testState.auth,
  AuthProvider: ({ children }) => children,
}));

vi.mock('../../providers/DashboardProvider.jsx', () => ({
  default: ({ children }) => children,
  useDashboard: () => testState.dashboard,
}));

vi.mock('../../providers/RealtimeProvider.jsx', () => ({
  useRealtime: () => testState.realtime,
}));

vi.mock('../../components/map/index.js', () => ({
  OperationalMap: () => <div data-testid="operational-map">Mapa operacional</div>,
  V4OperationalMap: () => <div data-testid="operational-map">Mapa operacional</div>,
}));

function dashboardContext(overrides = {}) {
  return {
    dashboard: {
      generatedAt: '2026-05-24T10:00:00.000Z',
      hero: {
        revenueLabel: 'R$ 120.000',
        occupancyRate: 0.78,
        totalBoards: 100,
        occupiedBoards: 78,
        expiringContracts: 4,
      },
      kpis: {
        totalBoards: 100,
        occupiedBoards: 78,
        availableBoards: 22,
        occupancyRate: 0.78,
        activeRevenue: 120000,
        contractsExpiring: 4,
        criticalAlerts: 1,
      },
      executive: {
        operationalHealth: 'warning',
        revenueHealth: 'healthy',
      },
      operations: {
        score: 91,
        maintenanceBoards: 2,
        dataQualityIssues: 0,
      },
      commercial: {
        availableInventoryPotential: 45000,
        lowOccupancyRegions: 1,
      },
      contracts: {
        expiring7Days: 1,
        expiring30Days: 4,
        atRiskRevenue: 18000,
      },
      alerts: {
        critical: 1,
        warning: 2,
        info: 0,
        topAlerts: [],
      },
      metadata: {
        partial: false,
      },
      priorityActions: [
        {
          id: 'alert-1',
          label: 'Placa sem contrato',
          detail: 'Revisar disponibilidade comercial hoje.',
          value: '1 ponto',
          tone: 'warning',
        },
      ],
      operationMix: [
        { label: 'Ocupadas', value: 78, color: 'var(--v4p-success)' },
        { label: 'Disponiveis', value: 22, color: 'var(--v4p-accent)' },
      ],
      featuredBoards: [],
      activityTimeline: [
        {
          id: 'activity-1',
          label: 'Contrato renovado com cliente regional',
          regiao: 'SP',
          tempo: 'hoje',
          categoria: 'success',
        },
      ],
      timeline: [],
    },
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

function renderDashboard(role) {
  testState.auth = createMockAuth({ role });
  return renderWithV4Providers(<DashboardPage />);
}

describe('DashboardPage smoke por role', () => {
  beforeEach(() => {
    testState.dashboard = dashboardContext();
    testState.realtime = {
      connected: true,
      reconnecting: false,
      eventCount: 0,
    };
  });

  it('operador ve saude e operacao sem blocos financeiros de gestao', () => {
    renderDashboard('operador');

    expect(screen.getByText('Saude operacional')).toBeInTheDocument();
    expect(screen.getByText('Operacao')).toBeInTheDocument();
    expect(screen.getByTestId('operational-map')).toBeInTheDocument();
    expect(screen.queryByText('Comercial e gestao')).not.toBeInTheDocument();
    expect(screen.queryByText('Receita ativa')).not.toBeInTheDocument();
    expect(screen.queryByText('Contratos a renovar')).not.toBeInTheDocument();
  });

  it('admin_empresa ve operacao e blocos de gestao comercial', () => {
    renderDashboard('admin_empresa');

    expect(screen.getByText('Saude operacional')).toBeInTheDocument();
    expect(screen.getByText('Operacao')).toBeInTheDocument();
    expect(screen.getByText('Comercial e gestao')).toBeInTheDocument();
    expect(screen.getAllByText('Receita ativa').length).toBeGreaterThan(0);
    expect(screen.getByText('Contratos a renovar')).toBeInTheDocument();
  });

  it('superadmin ve sinais sistemicos resumidos sem debug cru', () => {
    renderDashboard('superadmin');
    const pageText = document.body.textContent.toLowerCase();

    expect(screen.getByText('Sinais sistemicos')).toBeInTheDocument();
    expect(screen.getByText('Consistencia das origens')).toBeInTheDocument();
    expect(pageText).not.toContain('runtime debug');
    expect(pageText).not.toContain('stack trace');
  });

  it('mantem linguagem operacional e nao exibe termos tecnicos proibidos', () => {
    renderDashboard('admin_empresa');
    const pageText = document.body.textContent.toLowerCase();

    expect(pageText).not.toContain('mock');
    expect(pageText).not.toContain('payload');
    expect(pageText).not.toContain('provider unavailable');
    expect(pageText).not.toContain('sync error');
    expect(pageText).not.toContain('websocket');
    expect(pageText).not.toContain('runtime debug');
  });

  it('nao renderiza shell legado ao montar a pagina isolada', () => {
    renderDashboard('admin_empresa');

    expect(document.querySelector('.main-layout, [data-legacy-shell]')).toBeNull();
    expect(document.querySelector('.v4p-dashboard-page')).not.toBeNull();
  });
});
