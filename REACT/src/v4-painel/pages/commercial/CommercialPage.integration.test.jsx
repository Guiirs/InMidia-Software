import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';

let commercialState;

vi.mock('../../providers/CommercialProvider.jsx', () => ({
  default: ({ children }) => <>{children}</>,
  useCommercial: () => commercialState,
}));

function mutation() {
  return { loading: false };
}

function baseState(overrides = {}) {
  return {
    commercial: {
      hero: { pipelineLabel: 'R$ 0', conversionLabel: '0%', slaLabel: '0h' },
      pipeline: {
        stages: [],
        summary: {
          taxaConversaoGlobal: 0,
          cicloMedioVendas: 0,
          ticketMedioFechado: 0,
          receitaNoMes: 0,
          metaMensal: 0,
          crescimentoMoM: 0,
        },
      },
      opportunities: [],
      proposals: [],
      conversions: [],
      activities: [],
      revenueForecast: {
        metaAnual: 0,
        realizadoAnual: 0,
        projetadoAnual: 0,
        percentMeta: 0,
        receitaRecorrente: 0,
        crescimentoMoM: 0,
        trimestres: [],
        meses: [],
      },
      regionalPerformance: [],
      sellersPerformance: [],
      salesTargets: {
        metaMensal: 0,
        realizado: 0,
        percentual: 0,
        faltaParaMeta: 0,
        diasRestantes: 0,
        projecaoFinal: 0,
      },
      insights: [],
    },
    loading: false,
    refreshing: false,
    stale: false,
    status: 'success',
    error: null,
    source: 'empty',
    refresh: vi.fn(),
    createOpportunity: vi.fn(),
    updateOpportunity: vi.fn(),
    changeOpportunityStage: vi.fn(),
    createProposal: vi.fn(),
    updateProposal: vi.fn(),
    convertProposal: vi.fn(),
    createActivity: vi.fn(),
    mutations: {
      opportunityCreate: mutation(),
      opportunityUpdate: mutation(),
      opportunityStageChange: mutation(),
      proposalCreate: mutation(),
      proposalUpdate: mutation(),
      proposalConvert: mutation(),
      activityCreate: mutation(),
    },
    ...overrides,
  };
}

describe('CommercialPage integration surface', () => {
  beforeEach(() => {
    commercialState = baseState();
  });

  it('nao importa mock, preview, services ou API direta', () => {
    const source = readFileSync(new URL('./CommercialPage.jsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/commercialMockData|mockData|preview|apiClient|axios|fetch\s*\(|services\//i);
  });

  it('renderiza empty-state real quando nao ha dados comerciais', async () => {
    const { default: CommercialPage } = await import('./CommercialPage.jsx');

    const html = renderToString(<CommercialPage />);

    expect(html).toContain('SEM DADOS');
    expect(html).toContain('Nenhuma oportunidade ou proposta comercial encontrada para este tenant.');
    expect(html).toContain('Nenhuma oportunidade encontrada.');
  });

  it('renderiza error, stale e offline sem quebrar a tela', async () => {
    const { default: CommercialPage } = await import('./CommercialPage.jsx');

    commercialState = baseState({ status: 'error', source: 'error', error: 'Falha commercial V4' });
    expect(renderToString(<CommercialPage />)).toContain('Falha commercial V4');

    commercialState = baseState({ status: 'stale', source: 'stale', stale: true });
    expect(renderToString(<CommercialPage />)).toContain('DADO EM REVALIDACAO');

    commercialState = baseState({ status: 'offline', source: 'offline' });
    expect(renderToString(<CommercialPage />)).toContain('OFFLINE');
  });

  it('renderiza pipeline, oportunidade real e acoes de mutation', async () => {
    const { default: CommercialPage } = await import('./CommercialPage.jsx');
    commercialState = baseState({
      source: 'real',
      commercial: {
        ...baseState().commercial,
        hero: { pipelineLabel: 'R$ 12.000', conversionLabel: '25%', slaLabel: '0h' },
        pipeline: {
          stages: [{ id: 'lead', label: 'lead', count: 1, valor: 'R$ 12.000', cor: 'var(--v4p-accent)' }],
          summary: { taxaConversaoGlobal: 0.25, cicloMedioVendas: 0, ticketMedioFechado: 12000, receitaNoMes: 12000, metaMensal: 0, crescimentoMoM: 0 },
        },
        opportunities: [{
          id: 'o1',
          cliente: 'Cliente Real',
          regiao: 'Centro',
          potencial: 12000,
          potencialFmt: 'R$ 12.000/mes',
          prioridade: 'normal',
          status: 'lead',
          stage: 'lead',
          chance: 0.25,
          tags: ['real'],
          recomendacao: 'Acompanhar',
          estado: 'healthy',
        }],
        proposals: [{ id: 'p1', status: 'draft', opportunityId: 'o1' }],
        conversions: [],
      },
    });

    const html = renderToString(<CommercialPage />);

    expect(html).toContain('Cliente Real');
    expect(html).toContain('Criar oportunidade');
    expect(html).toContain('Converter proposta');
  });
});
