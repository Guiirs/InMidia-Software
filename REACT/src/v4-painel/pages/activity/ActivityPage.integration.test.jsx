import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';

let activityState;

vi.mock('../../providers/ActivityProvider.jsx', () => ({
  default: ({ children }) => <>{children}</>,
  useActivity: () => activityState,
}));

function baseState(overrides = {}) {
  return {
    activity: {
      timeline: [],
      timelineCursor: null,
      feed: [],
      audit: [],
      auditTotal: 0,
      byDomain: {},
      generatedAt: null,
    },
    loading: false,
    refreshing: false,
    stale: false,
    status: 'success',
    error: null,
    source: 'empty',
    refresh: vi.fn(),
    ...overrides,
  };
}

describe('ActivityPage integration surface', () => {
  beforeEach(() => {
    activityState = baseState();
  });

  it('nao importa mock, preview, services ou API direta', () => {
    const source = readFileSync(new URL('./ActivityPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/activityMockData|mockData|preview|apiClient|axios|fetch\s*\(|services\//i);
  });

  it('renderiza empty-state real quando nao ha dados de atividade', async () => {
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/Nenhum evento na timeline|Nenhum evento registrado|Sem itens no feed|Nenhum registro de auditoria/i);
  });

  it('renderiza estado de loading', async () => {
    activityState = baseState({ loading: true, status: 'loading', source: 'empty' });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/CARREGANDO/i);
  });

  it('renderiza estado de erro com botao de atualizar', async () => {
    activityState = baseState({
      status: 'error',
      source: 'error',
      error: 'Falha ao carregar atividades.',
    });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/Falha ao carregar atividades/i);
    expect(html).toMatch(/Atualizar/i);
  });

  it('renderiza estado unauthorized', async () => {
    activityState = baseState({ status: 'unauthorized', source: 'unauthorized' });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/Autenticação necessária/i);
  });

  it('renderiza estado forbidden', async () => {
    activityState = baseState({ status: 'forbidden', source: 'forbidden' });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/Acesso negado/i);
  });

  it('renderiza estado offline', async () => {
    activityState = baseState({ status: 'offline', source: 'offline' });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/Sem conexão/i);
  });

  it('renderiza estado stale com badge', async () => {
    activityState = baseState({
      status: 'stale',
      source: 'stale',
      stale: true,
      activity: {
        timeline: [{ id: '1', domain: 'commercial', domainLabel: 'Comercial', domainIcon: 'business_center', type: 'activity', title: 'Evento stale', createdAt: null }],
        feed: [],
        audit: [],
        auditTotal: 0,
        byDomain: {},
        generatedAt: null,
      },
    });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/DADOS ANTERIORES/i);
  });

  it('renderiza timeline com eventos reais', async () => {
    activityState = baseState({
      source: 'real',
      activity: {
        timeline: [
          { id: 'ev1', domain: 'commercial', domainLabel: 'Comercial', domainIcon: 'business_center', type: 'activity', title: 'Oportunidade criada', description: null, createdAt: '2026-05-22T10:00:00.000Z', status: 'created' },
          { id: 'ev2', domain: 'operations', domainLabel: 'Operações', domainIcon: 'precision_manufacturing', type: 'event', title: 'Tarefa concluída', description: null, createdAt: '2026-05-22T09:00:00.000Z', status: 'completed' },
        ],
        timelineCursor: null,
        feed: [],
        audit: [],
        auditTotal: 0,
        byDomain: {},
        generatedAt: '2026-05-22T10:00:00.000Z',
      },
    });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).toMatch(/Oportunidade criada/i);
    expect(html).toMatch(/Tarefa concluída/i);
    expect(html).toMatch(/Comercial/i);
    expect(html).toMatch(/Operações/i);
  });

  it('renderiza auditoria com entradas reais', async () => {
    activityState = baseState({
      source: 'real',
      activity: {
        timeline: [],
        timelineCursor: null,
        feed: [],
        audit: [
          { id: 'au1', domain: 'contracts', domainLabel: 'Contratos', domainIcon: 'description', type: 'contracts.status.changed', title: 'Contrato ativado', status: 'created', createdAt: '2026-05-22T08:00:00.000Z' },
        ],
        auditTotal: 1,
        byDomain: {},
        generatedAt: null,
      },
    });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    // A aba Auditoria fica em segundo plano no SSR (tab padrão = Timeline).
    // Validamos que o badge de contagem está presente na tab.
    expect(html).toMatch(/v4p-act-tab__badge/);
    expect(html).toMatch(/Auditoria/i);
  });

  it('renderiza agrupamento por dominio quando existem dados', async () => {
    activityState = baseState({
      source: 'real',
      activity: {
        timeline: [],
        timelineCursor: null,
        feed: [],
        audit: [],
        auditTotal: 0,
        byDomain: {
          commercial: { domain: 'commercial', domainLabel: 'Comercial', domainIcon: 'business_center', count: 5, lastAt: '2026-05-22T10:00:00.000Z' },
          operations: { domain: 'operations', domainLabel: 'Operações', domainIcon: 'precision_manufacturing', count: 3, lastAt: '2026-05-22T09:00:00.000Z' },
        },
        generatedAt: null,
      },
    });
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    // DomainStatCard renderiza count e label separados, não "N eventos"
    expect(html).toMatch(/v4p-act-stat-card__count[^>]*>5</);
    expect(html).toMatch(/v4p-act-stat-card__count[^>]*>3</);
    expect(html).toMatch(/Comercial/i);
    expect(html).toMatch(/Operações/i);
  });

  it('nao renderiza ComingSoon — ActivityPage e o componente real', async () => {
    const { default: ActivityPage } = await import('./ActivityPage.jsx');
    const html = renderToString(<ActivityPage />);
    expect(html).not.toMatch(/Em desenvolvimento|será implementada/i);
  });

  it('fonte dos dados e ActivityProvider — sem useSyncResource direto', () => {
    const source = readFileSync(new URL('./ActivityPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/useSyncResource|useSyncMutation/);
    expect(source).toMatch(/useActivity/);
  });
});
