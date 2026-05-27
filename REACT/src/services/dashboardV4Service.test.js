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
      totalPlacas: 10,
      placasDisponiveis: 4,
      placasAlugadasOcupadas: 6,
      taxaOcupacao: 60,
      contratosAtivos: 3,
      receitaEstimadaMensal: 12000,
      regioesAtivas: 2,
      propostasEmAberto: 1,
    });

    const result = await getDashboardKpis();

    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      url: '/v4/dashboard/kpis',
    }));
    expect(result.hero).toMatchObject({ totalBoards: 10, occupiedBoards: 6, revenueLabel: 'R$ 12.000' });
    expect(result.mainKpis).toHaveLength(4);
    expect(result.operationMix.map((item) => item.value)).toEqual([6, 4, 0]);
  });

  it('consome overview, activity, performance e alerts-summary somente por /api/v4/dashboard', async () => {
    mockData([{ regiaoId: 'r1', regiao: 'Norte', totalPlacas: 2, placasAlugadas: 1, taxaOcupacao: 50 }]);
    await expect(getDashboardOverview()).resolves.toMatchObject({ regions: [expect.objectContaining({ label: 'Norte' })] });

    mockData([{ placaId: 'p1', placa: 'PL-1', localizacao: 'Centro', regiao: 'Norte', receitaGerada: 100 }]);
    await expect(getDashboardActivity()).resolves.toMatchObject({ featuredBoards: [expect.objectContaining({ codigo: 'PL-1' })] });

    mockData([{ placaId: 'p2', placa: 'PL-2', diasSemAluguel: 70, regiao: 'Sul' }]);
    await expect(getDashboardPerformance()).resolves.toMatchObject({ idleBoards: [expect.objectContaining({ placa: 'PL-2' })] });

    mockData([{ id: 'a1', titulo: 'Alerta', severidade: 'critical', acaoSugerida: 'Agir' }]);
    await expect(getDashboardAlertsSummary()).resolves.toMatchObject({
      alerts: expect.objectContaining({ total: 1, critical: 1 }),
      priorityActions: [expect.objectContaining({ label: 'Alerta', tone: 'danger' })],
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
