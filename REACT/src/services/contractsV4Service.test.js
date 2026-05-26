import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import apiClient from './apiClient.js';
import {
  cancelContract,
  changeContractStatus,
  createContract,
  getActiveContracts,
  getContractsSummary,
  getContractsTimeline,
  getExpiringContracts,
  listContracts,
  renewContract,
  updateContract,
} from './contractsV4Service.js';

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

describe('contractsV4Service', () => {
  beforeEach(() => {
    apiClient.request.mockReset();
  });

  it('usa somente /api/v4/contracts para resources obrigatorios', async () => {
    mockData({ totals: {}, revenue: {}, expiringContracts: [], recentContracts: [] });
    await getContractsSummary();

    mockData([]);
    await listContracts({ limit: 20 });

    mockData([]);
    await getActiveContracts();

    mockData([]);
    await getExpiringContracts({ days: 30 });

    mockData({ timeline: [], total: 0 });
    await getContractsTimeline();

    const urls = apiClient.request.mock.calls.map(([request]) => request.url);
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringContaining('/api/v4/contracts/summary'),
      expect.stringContaining('/api/v4/contracts/list'),
      expect.stringContaining('/api/v4/contracts/active'),
      expect.stringContaining('/api/v4/contracts/expiring'),
      expect.stringContaining('/api/v4/contracts/timeline'),
    ]));
    expect(urls.every((url) => url.includes('/api/v4/contracts'))).toBe(true);
    expect(urls.every((url) => !url.includes('/api/v1'))).toBe(true);
  });

  it('liga mutations aos endpoints V4 esperados', async () => {
    mockData({ id: 'c1', status: 'active' });
    await createContract({ boardId: 'b1' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'post',
      url: expect.stringContaining('/api/v4/contracts'),
    }));

    mockData({ id: 'c1', status: 'active' });
    await updateContract('c1', { observacoes: 'ok' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'patch',
      url: expect.stringContaining('/api/v4/contracts/c1'),
    }));

    mockData({ id: 'c1', status: 'completed' });
    await changeContractStatus('c1', 'completed');
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'patch',
      url: expect.stringContaining('/api/v4/contracts/c1/status'),
      data: { status: 'completed' },
    }));

    mockData({ id: 'c1', status: 'cancelled' });
    await cancelContract('c1', { reason: 'teste' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'post',
      url: expect.stringContaining('/api/v4/contracts/c1/cancel'),
    }));

    mockData({ id: 'c1', status: 'active' });
    await renewContract('c1', { newEndDate: '2026-08-01' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'post',
      url: expect.stringContaining('/api/v4/contracts/c1/renew'),
    }));
  });

  it('ContractsProvider consome Sync Core sem mock, v1 ou service direto', () => {
    const provider = readFileSync(new URL('../v4-painel/providers/ContractsProvider.jsx', import.meta.url), 'utf8');

    expect(provider).toContain("useSyncResource('contracts.summary')");
    expect(provider).toContain("useSyncResource('contracts.list')");
    expect(provider).toContain("useSyncMutation('contracts.create')");
    expect(provider).toContain("useSyncMutation('contracts.renew')");
    expect(provider).not.toMatch(/contractsMockData|createMockContractsPayload|api\/v1|apiClient|services\//);
  });
});
