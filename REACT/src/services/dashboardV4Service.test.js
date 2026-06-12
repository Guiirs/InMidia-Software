import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from './apiClient.js';
import {
  getDashboardActivity,
  getDashboardAlertsSummary,
  getDashboardKpis,
  getDashboardOverview,
  getDashboardPerformance,
} from './dashboardV4Service.js';

vi.mock('./apiClient.js', () => ({
  default: {
    request: vi.fn(),
  },
}));

function mockData(data) {
  apiClient.request.mockResolvedValueOnce({ data: { success: true, data } });
}

function lastRequest() {
  return apiClient.request.mock.calls.at(-1)?.[0];
}

function requestPath(request) {
  return `${request?.baseURL || ''}${request?.url || ''}`;
}

describe('dashboardV4Service', () => {
  beforeEach(() => {
    apiClient.request.mockReset();
  });

  it('consome KPIs pelo endpoint V4 e normaliza para o contrato visual', async () => {
    mockData({
      totalBoards: 10,
      availableBoards: 4,
      occupiedBoards: 6,
      occupancyRate: 60,
      activeContracts: 3,
      monthlyRevenue: 12000,
      commercialPipelineValue: 0,
      criticalAlerts: 1,
      pendingTasks: 2,
      operations: { maintenances: 0, blocks: 0 },
    });

    const result = await getDashboardKpis();

    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      url: '/v4/dashboard/kpis',
    }));
    expect(result.hero).toMatchObject({ totalBoards: 10, occupiedBoards: 6, revenueLabel: 'R$ 12.000' });
    expect(result.kpis).toMatchObject({ totalBoards: 10, availableBoards: 4, occupiedBoards: 6, occupancyRate: 60, criticalAlerts: 1 });
    expect(result.mainKpis).toHaveLength(4);
    expect(result.operationMix.map((item) => item.value)).toEqual([6, 4, 0]);
  });

  it('consome overview, activity, performance e alerts-summary somente por /api/v4/dashboard', async () => {
    mockData({
      regions: [{ regionId: 'r1', name: 'Norte', total: 2, available: 1, occupied: 1, occupancyRate: 50 }],
      domains: { inventory: { total: 2 }, contracts: { total: 0 }, commercial: { total: 0 }, alerts: { total: 0 }, operations: { total: 0 }, reports: { total: 0 } },
    });
    await expect(getDashboardOverview()).resolves.toMatchObject({ regions: [expect.objectContaining({ label: 'Norte' })] });

    mockData({ items: [{ id: 'p1', type: 'operation', domain: 'operations', label: 'Tarefa PL-1', severity: 'info', occurredAt: new Date().toISOString() }], cursor: null });
    await expect(getDashboardActivity()).resolves.toMatchObject({ activityTimeline: [expect.objectContaining({ label: 'Tarefa PL-1' })] });

    mockData({ idleBoards: [{ id: 'p2', numeroPlaca: 'PL-2', regionId: 'Sul', since: new Date().toISOString() }], regions: [], expiringContracts: [], commercial: {}, reports: { recent: [] } });
    await expect(getDashboardPerformance()).resolves.toMatchObject({ idleBoards: [expect.objectContaining({ numeroPlaca: 'PL-2' })] });

    mockData({ total: 1, critical: 1, unread: 1, byDomain: [{ domain: 'operations', count: 1, open: 1 }] });
    await expect(getDashboardAlertsSummary()).resolves.toMatchObject({
      alerts: expect.objectContaining({ total: 1, critical: 1 }),
    });

    const urls = apiClient.request.mock.calls.map(([request]) => requestPath(request));
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringContaining('/api/v4/dashboard/overview'),
      expect.stringContaining('/api/v4/dashboard/activity'),
      expect.stringContaining('/api/v4/dashboard/performance'),
      expect.stringContaining('/api/v4/dashboard/alerts-summary'),
    ]));
    expect(urls.every((url) => url.includes('/api/v4/dashboard/'))).toBe(true);
  });
});
