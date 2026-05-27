import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import apiClient from './apiClient.js';
import {
  changeOpportunityStage,
  convertProposal,
  createCommercialActivity,
  createOpportunity,
  createProposal,
  getCommercialConversions,
  getCommercialPipeline,
  listCommercialActivities,
  listCommercialOpportunities,
  listCommercialProposals,
  updateOpportunity,
  updateProposal,
} from './commercialV4Service.js';

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

describe('commercialV4Service', () => {
  beforeEach(() => {
    apiClient.request.mockReset();
  });

  it('usa somente /api/v4/commercial para resources obrigatorios', async () => {
    mockData({ stages: [], totalValue: 0, count: 0, conversionRate: 0 });
    await getCommercialPipeline();

    mockData({ opportunities: [], total: 0 });
    await listCommercialOpportunities();

    mockData({ proposals: [], total: 0 });
    await listCommercialProposals();

    mockData({ conversions: [], total: 0, rate: 0 });
    await getCommercialConversions();

    mockData({ activities: [], total: 0 });
    await listCommercialActivities();

    const urls = apiClient.request.mock.calls.map(([request]) => requestPath(request));
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringContaining('/api/v4/commercial/pipeline'),
      expect.stringContaining('/api/v4/commercial/opportunities'),
      expect.stringContaining('/api/v4/commercial/proposals'),
      expect.stringContaining('/api/v4/commercial/conversions'),
      expect.stringContaining('/api/v4/commercial/activities'),
    ]));
    expect(urls.every((url) => url.includes('/api/v4/commercial'))).toBe(true);
    expect(urls.every((url) => !url.includes('/api/v1'))).toBe(true);
  });

  it('liga mutations aos endpoints V4 esperados', async () => {
    mockData({ opportunity: { id: 'o1', value: 1000, stage: 'lead' } });
    await createOpportunity({ value: 1000 });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'post',
      url: '/v4/commercial/opportunities',
    }));

    mockData({ opportunity: { id: 'o1', value: 1200, stage: 'lead' } });
    await updateOpportunity('o1', { value: 1200 });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'patch',
      url: '/v4/commercial/opportunities/o1',
    }));

    mockData({ opportunity: { id: 'o1', stage: 'proposal' } });
    await changeOpportunityStage('o1', 'proposal');
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'patch',
      url: '/v4/commercial/opportunities/o1/stage',
      data: { stage: 'proposal' },
    }));

    mockData({ proposal: { id: 'p1', status: 'draft' } });
    await createProposal({ opportunityId: 'o1' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'post',
      url: '/v4/commercial/proposals',
    }));

    mockData({ proposal: { id: 'p1', status: 'sent' } });
    await updateProposal('p1', { status: 'sent' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'patch',
      url: '/v4/commercial/proposals/p1',
    }));

    mockData({ proposal: { id: 'p1', status: 'converted' }, conversion: { id: 'c1' } });
    await convertProposal('p1', {});
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'post',
      url: '/v4/commercial/proposals/p1/convert',
    }));

    mockData({ activity: { id: 'a1', type: 'note' } });
    await createCommercialActivity({ type: 'note' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'post',
      url: '/v4/commercial/activities',
    }));
  });

  it('CommercialProvider consome Sync Core sem mock, v1 ou service direto', () => {
    const provider = readFileSync(new URL('../v4-painel/providers/CommercialProvider.jsx', import.meta.url), 'utf8');

    expect(provider).toContain("useSyncResource('commercial.pipeline')");
    expect(provider).toContain("useSyncResource('commercial.opportunities')");
    expect(provider).toContain("useSyncMutation('commercial.opportunity.create')");
    expect(provider).toContain("useSyncMutation('commercial.proposal.convert')");
    expect(provider).not.toMatch(/commercialMockData|createMockCommercialSnapshot|api\/v1|apiClient|services\//);
  });
});
