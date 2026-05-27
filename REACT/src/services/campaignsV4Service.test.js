import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import apiClient from './apiClient.js';
import {
  activateCampaign,
  createCampaign,
  deleteCampaign,
  getActiveCampaigns,
  getCampaignsPerformance,
  getCampaignsSummary,
  getScheduledCampaigns,
  listCampaigns,
  pauseCampaign,
  updateCampaign,
} from './campaignsV4Service.js';

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

describe('campaignsV4Service', () => {
  beforeEach(() => {
    apiClient.request.mockReset();
  });

  it('usa somente /api/v4/campaigns para resources obrigatorios', async () => {
    mockData({ total: 0, active: 0, scheduled: 0, paused: 0, draft: 0, completed: 0, generatedAt: '' });
    await getCampaignsSummary();

    mockData({ campaigns: [], total: 0 });
    await listCampaigns();

    mockData({ campaigns: [], count: 0 });
    await getActiveCampaigns();

    mockData({ campaigns: [], count: 0 });
    await getScheduledCampaigns();

    mockData({ totalTracked: 0, byStatus: {}, activeBudget: 0, generatedAt: '' });
    await getCampaignsPerformance();

    const urls = apiClient.request.mock.calls.map(([request]) => requestPath(request));
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringContaining('/api/v4/campaigns/summary'),
      expect.stringContaining('/api/v4/campaigns'),
      expect.stringContaining('/api/v4/campaigns/active'),
      expect.stringContaining('/api/v4/campaigns/scheduled'),
      expect.stringContaining('/api/v4/campaigns/performance'),
    ]));
    expect(urls.every((url) => url.includes('/api/v4/campaigns'))).toBe(true);
    expect(urls.every((url) => !url.includes('/api/v1'))).toBe(true);
  });

  it('liga mutations aos endpoints V4 esperados', async () => {
    mockData({ campaign: { id: 'c1', name: 'Verão', status: 'draft' } });
    await createCampaign({ name: 'Verão', status: 'draft' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'post',
      url: '/v4/campaigns',
      data: expect.objectContaining({ name: 'Verão' }),
    }));

    mockData({ campaign: { id: 'c1', name: 'Verão Updated', status: 'scheduled' } });
    await updateCampaign('c1', { name: 'Verão Updated', status: 'scheduled' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'patch',
      url: '/v4/campaigns/c1',
    }));

    mockData({ campaign: { id: 'c1', status: 'paused' } });
    await pauseCampaign('c1');
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'patch',
      url: '/v4/campaigns/c1/pause',
    }));

    mockData({ campaign: { id: 'c1', status: 'active' } });
    await activateCampaign('c1');
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'patch',
      url: '/v4/campaigns/c1/activate',
    }));

    mockData({ deleted: true, id: 'c1' });
    await deleteCampaign('c1');
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'delete',
      url: '/v4/campaigns/c1',
    }));
  });

  it('CampaignsProvider consome Sync Core sem mock, v1 ou service direto', () => {
    const provider = readFileSync(new URL('../v4-painel/providers/CampaignsProvider.jsx', import.meta.url), 'utf8');

    expect(provider).toContain("useSyncResource('campaigns.summary')");
    expect(provider).toContain("useSyncResource('campaigns.list')");
    expect(provider).toContain("useSyncResource('campaigns.active')");
    expect(provider).toContain("useSyncResource('campaigns.scheduled')");
    expect(provider).toContain("useSyncResource('campaigns.performance')");
    expect(provider).toContain("useSyncMutation('campaigns.create')");
    expect(provider).toContain("useSyncMutation('campaigns.update')");
    expect(provider).toContain("useSyncMutation('campaigns.pause')");
    expect(provider).toContain("useSyncMutation('campaigns.activate')");
    expect(provider).toContain("useSyncMutation('campaigns.delete')");
    expect(provider).not.toMatch(/campaignsMockData|createMockCampaign|api\/v1|apiClient|services\//);
  });
});
