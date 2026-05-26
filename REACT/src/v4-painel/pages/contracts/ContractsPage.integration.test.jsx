import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';

let contractsState;

vi.mock('../../providers/ContractsProvider.jsx', () => ({
  default: ({ children }) => <>{children}</>,
  useContracts: () => contractsState,
}));

function baseState(overrides = {}) {
  return {
    contracts: [],
    summary: {
      total: 0,
      ativos: 0,
      vencendoEm30Dias: 0,
      renovadosEsteMes: 0,
      receitaComprometida: 0,
      ticketMedio: 0,
    },
    financialImpact: {
      receitaProtegida: 0,
      receitaEmRisco: 0,
      potencialExpansao: 0,
      previsaoProximoMes: 0,
      crescimentoEsperado: 0,
    },
    renewalOpportunities: [],
    timeline: [],
    loading: false,
    refreshing: false,
    stale: false,
    status: 'success',
    error: null,
    source: 'empty',
    refresh: vi.fn(),
    changeContractStatus: vi.fn(),
    cancelContract: vi.fn(),
    renewContract: vi.fn(),
    mutations: {
      statusChange: { loading: false },
      cancel: { loading: false },
      renew: { loading: false },
    },
    ...overrides,
  };
}

describe('ContractsPage integration surface', () => {
  beforeEach(() => {
    contractsState = baseState();
  });

  it('nao importa mock, preview, services ou API direta', () => {
    const source = readFileSync(new URL('./ContractsPage.jsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/contractsMockData|mockData|preview|apiClient|axios|fetch\s*\(|services\//i);
  });

  it('renderiza empty-state real quando nao ha contratos', async () => {
    const { default: ContractsPage } = await import('./ContractsPage.jsx');

    const html = renderToString(<ContractsPage />);

    expect(html).toContain('Nenhum contrato encontrado para este tenant.');
    expect(html).toContain('SEM DADOS');
  });

  it('renderiza error, stale e offline sem quebrar a tela', async () => {
    const { default: ContractsPage } = await import('./ContractsPage.jsx');

    contractsState = baseState({ status: 'error', source: 'error', error: 'Falha contracts V4' });
    expect(renderToString(<ContractsPage />)).toContain('Falha contracts V4');

    contractsState = baseState({ status: 'stale', source: 'stale', stale: true });
    expect(renderToString(<ContractsPage />)).toContain('DADO EM REVALIDACAO');

    contractsState = baseState({ status: 'offline', source: 'offline' });
    expect(renderToString(<ContractsPage />)).toContain('OFFLINE');
  });

  it('renderiza contratos reais e controles de filtro', async () => {
    const { default: ContractsPage } = await import('./ContractsPage.jsx');
    contractsState = baseState({
      source: 'real',
      contracts: [{
        id: 'CTR-1',
        realId: 'c1',
        cliente: 'Cliente Real',
        campanha: 'Campanha V4',
        regiao: 'Centro',
        placas: 1,
        status: 'active',
        risco: 'low',
        estado: 'healthy',
        diasRestantes: 40,
        receita: 1000,
        probabilidadeRenovacao: 0.8,
      }],
    });

    const html = renderToString(<ContractsPage />);

    expect(html).toContain('Cliente Real');
    expect(html).toContain('Cliente, campanha, regiao ou placa');
  });
});
