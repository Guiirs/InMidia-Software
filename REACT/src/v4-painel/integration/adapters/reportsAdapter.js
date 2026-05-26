import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { createEmptyCommercialSnapshot } from './commercialAdapter.js';
import { createMockOperationsSnapshot } from './operationsAdapter.js';
import { createMockAlertsSnapshot } from './alertsAdapter.js';
import {
  EXPORT_FORMATS,
  OCCUPANCY_ANALYTICS,
  PERFORMANCE_DATA,
  REGIONAL_ANALYTICS,
  REPORT_CARDS,
  REVENUE_ANALYTICS,
} from '../../pages/reports/reportsMockData.js';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(num(value));
}

function pct(value) {
  return `${(num(value) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function clonePerformance() {
  return PERFORMANCE_DATA.map((item) => ({ ...item }));
}

function cloneRegional() {
  return REGIONAL_ANALYTICS.map((item) => ({ ...item }));
}

function cloneOccupancy() {
  return {
    historico: OCCUPANCY_ANALYTICS.historico.map((item) => ({ ...item })),
    sazonalidade: OCCUPANCY_ANALYTICS.sazonalidade.map((item) => ({ ...item })),
  };
}

function cloneExports() {
  return EXPORT_FORMATS.map((item) => ({ ...item }));
}

function cloneReportsCards() {
  return REPORT_CARDS.map((item) => ({ ...item, insights: [...item.insights] }));
}

export function createMockReportsSnapshot() {
  const reports = cloneReportsCards();

  return {
    generatedAt: null,
    executiveReports: reports,
    performance: {
      history: clonePerformance(),
      growthLabel: '+43,8%',
      peakRevenueLabel: 'R$ 285k',
      averageRevenueLabel: 'R$ 242k',
      occupancyLabel: '78,1%',
    },
    revenue: {
      ...REVENUE_ANALYTICS,
      totalAnoLabel: brl(REVENUE_ANALYTICS.totalAno),
      mediasMensalLabel: brl(REVENUE_ANALYTICS.mediasMensal),
      receitaRecorrenteLabel: brl(REVENUE_ANALYTICS.receitaRecorrente),
      receitaNovaLabel: brl(REVENUE_ANALYTICS.receitaNova),
      churnEstimadoLabel: brl(REVENUE_ANALYTICS.churnEstimado),
      maiorMesLabel: brl(REVENUE_ANALYTICS.maiorMes.valor),
      menorMesLabel: brl(REVENUE_ANALYTICS.menorMes.valor),
    },
    regional: {
      ranking: cloneRegional(),
      bestRegion: REGIONAL_ANALYTICS[0]?.regiao ?? 'São Paulo',
      worstRegion: REGIONAL_ANALYTICS[4]?.regiao ?? 'Rio Grande do Sul',
      opportunitiesLabel: 'R$ 0',
    },
    occupancy: cloneOccupancy(),
    exports: cloneExports(),
    source: 'mock',
  };
}

function deriveExecutiveReports({ kpis, operationsSnapshot, alertsSnapshot, contractsPayload, source }) {
  const expiring30 = num(contractsPayload?.summary?.vencendoEm30Dias ?? contractsPayload?.rawSummary?.totals?.expiring30Days);
  const activeRevenue = num(kpis.activeRevenue);
  const criticalAlerts = num(alertsSnapshot?.totals?.critical);
  const operationsScore = num(operationsSnapshot?.health?.score, 90);

  return [
    {
      id: 'rep-occ',
      label: 'Relatorio de Ocupacao',
      icone: 'donut_large',
      periodo: 'Ciclo atual',
      estado: kpis.occupancyRate >= 0.75 ? OPERATIONAL_STATE.HEALTHY : OPERATIONAL_STATE.WARNING,
      ultimaGeracao: source === 'real' ? 'agora' : 'via fallback',
      tamanho: '1,2 MB',
      insights: [
        `${pct(kpis.occupancyRate)} ocupacao global`,
        `${kpis.occupiedBoards}/${kpis.totalBoards} placas ocupadas`,
        `${operationsSnapshot?.regionalOperations?.filter((r) => r.ocupacao < 0.65).length ?? 0} regioes abaixo da meta`,
      ],
    },
    {
      id: 'rep-rev',
      label: 'Relatorio de Receita',
      icone: 'attach_money',
      periodo: 'Ciclo atual',
      estado: OPERATIONAL_STATE.HEALTHY,
      ultimaGeracao: source === 'real' ? 'agora' : 'via fallback',
      tamanho: '0,8 MB',
      insights: [
        `${brl(activeRevenue)} receita ativa`,
        `${brl(kpis.revenueAtRisk)} em risco`,
        `${brl(num(kpis.activeRevenue) - num(kpis.revenueAtRisk))} protegidos`,
      ],
    },
    {
      id: 'rep-reg',
      label: 'Analise Regional',
      icone: 'map',
      periodo: 'Ciclo atual',
      estado: operationsSnapshot?.health?.status ?? OPERATIONAL_STATE.WARNING,
      ultimaGeracao: source === 'real' ? 'agora' : 'via fallback',
      tamanho: '2,0 MB',
      insights: [
        `${operationsSnapshot?.regionalOperations?.length ?? 0} regioes monitoradas`,
        `${operationsSnapshot?.health?.affectedAreas?.length ?? 0} areas afetadas`,
        `score operacional ${operationsScore}%`,
      ],
    },
    {
      id: 'rep-cont',
      label: 'Vencimentos de Contratos',
      icone: 'event_busy',
      periodo: '7/15/30 dias',
      estado: expiring30 > 0 ? OPERATIONAL_STATE.WARNING : OPERATIONAL_STATE.HEALTHY,
      ultimaGeracao: source === 'real' ? 'agora' : 'via fallback',
      tamanho: '0,6 MB',
      insights: [
        `${num(contractsPayload?.rawSummary?.totals?.expiring7Days)} vencem em 7 dias`,
        `${num(contractsPayload?.rawSummary?.totals?.expiring15Days)} vencem em 15 dias`,
        `${expiring30} vencem em 30 dias`,
      ],
    },
    {
      id: 'rep-alerts',
      label: 'Riscos e Alertas',
      icone: 'crisis_alert',
      periodo: 'Atual',
      estado: criticalAlerts > 0 ? OPERATIONAL_STATE.CRITICAL : OPERATIONAL_STATE.HEALTHY,
      ultimaGeracao: source === 'real' ? 'agora' : 'via fallback',
      tamanho: '0,5 MB',
      insights: [
        `${criticalAlerts} alertas criticos`,
        `${num(alertsSnapshot?.totals?.warning)} alertas de atencao`,
        `${num(alertsSnapshot?.totals?.info)} informativos`,
      ],
    },
  ];
}

function derivePerformance(history, kpis) {
  const maxRevenue = Math.max(...history.map((item) => num(item.receita)), 1);
  const avgRevenue = history.reduce((sum, item) => sum + num(item.receita), 0) / Math.max(history.length, 1);
  const firstRevenue = num(history[0]?.receita);
  const growth = firstRevenue > 0 ? ((num(kpis.activeRevenue) - firstRevenue) / firstRevenue) * 100 : 0;

  return {
    history,
    growthLabel: `${growth >= 0 ? '+' : ''}${growth.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
    peakRevenueLabel: brl(maxRevenue),
    averageRevenueLabel: brl(avgRevenue),
    occupancyLabel: pct(kpis.occupancyRate),
  };
}

function deriveRevenue(history, kpis, contractsPayload) {
  const values = history.map((item) => num(item.receita));
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const maxEntry = history.find((item) => num(item.receita) === max) ?? { mes: 'Atual', receita: max };
  const minEntry = history.find((item) => num(item.receita) === min) ?? { mes: 'Atual', receita: min };

  const recurring = Math.max(num(kpis.activeRevenue) - num(contractsPayload?.summary?.receitaEmRisco), 0);
  const newRevenue = Math.max(num(kpis.activeRevenue) - recurring, 0);

  return {
    totalAno: values.reduce((sum, value) => sum + value, 0),
    mediasMensal: values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1),
    maiorMes: { mes: maxEntry.mes, valor: max },
    menorMes: { mes: minEntry.mes, valor: min },
    crescimentoTotal: `${values.length > 1 ? (((values[values.length - 1] - values[0]) / Math.max(values[0], 1)) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0}%`,
    receitaRecorrente: recurring,
    receitaNova: newRevenue,
    churnEstimado: num(kpis.revenueAtRisk),
    totalAnoLabel: brl(values.reduce((sum, value) => sum + value, 0)),
    mediasMensalLabel: brl(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)),
    receitaRecorrenteLabel: brl(recurring),
    receitaNovaLabel: brl(newRevenue),
    churnEstimadoLabel: brl(num(kpis.revenueAtRisk)),
    maiorMesLabel: brl(max),
    menorMesLabel: brl(min),
  };
}

function deriveRegional(inventorySummary, commercialSnapshot) {
  const regions = arr(inventorySummary?.regions);
  const ranking = regions.length
    ? regions.map((region) => ({
        regiao: region.name ?? 'Sem regiao',
        receita: num(region.activeRevenue),
        ocupacao: num(region.occupancyRate),
        crescimento: num(region.occupancyRate) >= 0.8 ? 0.08 : num(region.occupancyRate) >= 0.65 ? 0.03 : -0.04,
        meta: Math.max(num(region.activeRevenue), 1),
        pontos: num(region.totalBoards),
        campanhas: Math.max(Math.round(num(region.occupiedBoards) / 10), 0),
      }))
    : cloneRegional();

  const sorted = [...ranking].sort((a, b) => b.ocupacao - a.ocupacao);
  return {
    ranking,
    bestRegion: sorted[0]?.regiao ?? 'Sem dados',
    worstRegion: sorted[sorted.length - 1]?.regiao ?? 'Sem dados',
    opportunitiesLabel: brl(num(commercialSnapshot?.kpis?.availableInventoryPotential)),
  };
}

function deriveOccupancy(inventorySummary, occupancyRate) {
  const history = cloneOccupancy().historico;
  const last = history[history.length - 1];
  last.global = num(occupancyRate, last.global);

  const lowRegions = arr(inventorySummary?.highlights?.lowOccupancyRegions);
  if (lowRegions.length) {
    last.standardB = Math.max(0.55, num(lowRegions[0]?.occupancyRate, last.standardB));
  }

  return {
    historico: history,
    sazonalidade: cloneOccupancy().sazonalidade,
  };
}

export function reportsFromSources({
  inventorySummary,
  contractsPayload,
  commercialSnapshot,
  operationsSnapshot,
  alertsSnapshot,
  source = 'real',
} = {}) {
  const fallback = createMockReportsSnapshot();
  if (!inventorySummary && !contractsPayload && !commercialSnapshot && !operationsSnapshot && !alertsSnapshot) {
    return fallback;
  }

  const safeCommercial = commercialSnapshot ?? createEmptyCommercialSnapshot();
  const safeOperations = operationsSnapshot ?? createMockOperationsSnapshot();
  const safeAlerts = alertsSnapshot ?? createMockAlertsSnapshot();

  const totals = inventorySummary?.totals ?? {};
  const occupancy = inventorySummary?.occupancy ?? {};
  const revenue = inventorySummary?.revenue ?? {};
  const contractsSummary = contractsPayload?.summary ?? {};

  const kpis = {
    totalBoards: num(totals.totalBoards, 0),
    occupiedBoards: num(totals.occupiedBoards, 0),
    occupancyRate: num(occupancy.rate, 0),
    activeRevenue: num(contractsSummary.receitaComprometida, num(revenue.activeMonthlyRevenue, 0)),
    revenueAtRisk: num(contractsSummary.receitaEmRisco, 0),
    contractsExpiring: num(contractsSummary.vencendoEm30Dias, num(contractsPayload?.rawSummary?.totals?.expiring30Days, 0)),
    criticalAlerts: num(safeAlerts.totals?.critical, 0),
  };

  const perfHistory = clonePerformance();
  if (perfHistory.length) {
    const last = perfHistory[perfHistory.length - 1];
    last.receita = Math.max(num(kpis.activeRevenue, last.receita), 1);
    last.ocupacao = num(kpis.occupancyRate, last.ocupacao);
    last.contratos = num(contractsPayload?.rawSummary?.totals?.activeContracts, last.contratos);
  }

  return {
    generatedAt: inventorySummary?.generatedAt ?? contractsPayload?.generatedAt ?? new Date().toISOString(),
    executiveReports: deriveExecutiveReports({
      kpis,
      operationsSnapshot: safeOperations,
      alertsSnapshot: safeAlerts,
      contractsPayload,
      source,
    }),
    performance: derivePerformance(perfHistory, kpis),
    revenue: deriveRevenue(perfHistory, kpis, contractsPayload),
    regional: deriveRegional(inventorySummary, safeCommercial),
    occupancy: deriveOccupancy(inventorySummary, kpis.occupancyRate),
    exports: cloneExports(),
    source,
  };
}
