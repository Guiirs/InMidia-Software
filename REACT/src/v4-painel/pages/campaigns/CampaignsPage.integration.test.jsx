import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';

let campaignsState;

vi.mock('../../providers/CampaignsProvider.jsx', () => ({
  default: ({ children }) => <>{children}</>,
  useCampaigns: () => campaignsState,
}));

const EMPTY_SUMMARY = { total: 0, active: 0, scheduled: 0, paused: 0, draft: 0, completed: 0, generatedAt: null };
const EMPTY_PERF    = { totalTracked: 0, byStatus: {}, activeBudget: 0, generatedAt: null };

function baseState(overrides = {}) {
  return {
    campaigns: {
      summary:        EMPTY_SUMMARY,
      list:           [],
      total:          0,
      active:         [],
      activeCount:    0,
      scheduled:      [],
      scheduledCount: 0,
      performance:    EMPTY_PERF,
      generatedAt:    null,
    },
    loading:    false,
    refreshing: false,
    stale:      false,
    status:     'success',
    error:      null,
    source:     'empty',
    refresh:    vi.fn(),
    createCampaign:   vi.fn(),
    updateCampaign:   vi.fn(),
    pauseCampaign:    vi.fn(),
    activateCampaign: vi.fn(),
    deleteCampaign:   vi.fn(),
    mutations: {
      createMut:   { isLoading: false },
      updateMut:   { isLoading: false },
      pauseMut:    { isLoading: false },
      activateMut: { isLoading: false },
      deleteMut:   { isLoading: false },
    },
    ...overrides,
  };
}

describe('CampaignsPage integration surface', () => {
  beforeEach(() => {
    campaignsState = baseState();
  });

  it('nao importa mock, preview, services ou API direta', () => {
    const source = readFileSync(new URL('./CampaignsPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/campaignsMockData|mockData|preview|apiClient|axios|fetch\s*\(|services\//i);
  });

  it('fonte dos dados e CampaignsProvider — sem useSyncResource direto', () => {
    const source = readFileSync(new URL('./CampaignsPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/useSyncResource|useSyncMutation/);
    expect(source).toMatch(/useCampaigns/);
  });

  it('nao renderiza ComingSoon — CampaignsPage e o componente real', async () => {
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).not.toMatch(/Em desenvolvimento|será implementada/i);
  });

  it('renderiza empty-state real quando nao ha campanhas', async () => {
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/Nenhuma campanha cadastrada|Nenhuma campanha/i);
  });

  it('renderiza estado de loading', async () => {
    campaignsState = baseState({ loading: true, status: 'loading', source: 'empty' });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/CARREGANDO/i);
  });

  it('renderiza estado de erro com botao atualizar', async () => {
    campaignsState = baseState({
      status: 'error',
      source: 'error',
      error:  'Falha ao carregar campanhas.',
    });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/Falha ao carregar campanhas/i);
    expect(html).toMatch(/Atualizar/i);
  });

  it('renderiza estado unauthorized', async () => {
    campaignsState = baseState({ status: 'unauthorized', source: 'unauthorized' });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/Autenticação necessária/i);
  });

  it('renderiza estado forbidden', async () => {
    campaignsState = baseState({ status: 'forbidden', source: 'forbidden' });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/Sem permissão/i);
  });

  it('renderiza estado offline', async () => {
    campaignsState = baseState({ status: 'offline', source: 'offline' });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/Sem conexão/i);
  });

  it('renderiza estado stale com badge', async () => {
    campaignsState = baseState({
      status: 'stale',
      source: 'stale',
      stale:  true,
      campaigns: {
        ...baseState().campaigns,
        summary: { ...EMPTY_SUMMARY, total: 2, active: 1 },
        list: [
          { id: 'c1', name: 'Campanha Stale', status: 'active', createdAt: null },
        ],
        active: [
          { id: 'c1', name: 'Campanha Stale', status: 'active', createdAt: null },
        ],
        activeCount: 1,
      },
    });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/DADOS ANTERIORES/i);
  });

  it('renderiza lista de campanhas com dados reais', async () => {
    campaignsState = baseState({
      source: 'real',
      campaigns: {
        ...baseState().campaigns,
        summary: { ...EMPTY_SUMMARY, total: 2, active: 1, scheduled: 1 },
        list: [
          { id: 'c1', name: 'Campanha Verão 2026', status: 'active', budget: 15000, target: 'Jovens', createdAt: '2026-05-01T10:00:00.000Z', startDate: '2026-06-01', endDate: '2026-08-31' },
          { id: 'c2', name: 'Campanha Natal', status: 'scheduled', budget: 8000, createdAt: '2026-05-10T12:00:00.000Z', startDate: '2026-12-01' },
        ],
        active: [
          { id: 'c1', name: 'Campanha Verão 2026', status: 'active', budget: 15000, createdAt: '2026-05-01T10:00:00.000Z' },
        ],
        activeCount: 1,
        scheduledCount: 1,
      },
    });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/Campanha Verão 2026/i);
    expect(html).toMatch(/Campanha Natal/i);
    expect(html).toMatch(/Ativa/i);
    expect(html).toMatch(/Agendada/i);
  });

  it('renderiza summary cards com contagens corretas', async () => {
    campaignsState = baseState({
      source: 'real',
      campaigns: {
        ...baseState().campaigns,
        summary: { total: 5, active: 2, scheduled: 1, paused: 1, draft: 1, completed: 0, generatedAt: null },
      },
    });
    const { default: CampaignsPage } = await import('./CampaignsPage.jsx');
    const html = renderToString(<CampaignsPage />);
    expect(html).toMatch(/5/);
    expect(html).toMatch(/2/);
    expect(html).toMatch(/Ativas/i);
    expect(html).toMatch(/Total/i);
  });

  it('mutations estao ligadas ao provider — sem chamada direta de API', () => {
    const source = readFileSync(new URL('./CampaignsPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/campaignsV4Service|apiClient|requestFirstAvailable/);
    expect(source).toMatch(/createCampaign|pauseCampaign|activateCampaign|deleteCampaign/);
  });

  it('boundary: CampaignsPage nao importa useSyncResource nem useSyncMutation', () => {
    const source = readFileSync(new URL('./CampaignsPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/useSyncResource|useSyncMutation/);
  });
});
