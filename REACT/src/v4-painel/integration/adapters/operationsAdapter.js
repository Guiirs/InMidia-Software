import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import {
  OPERATIONS_FEED,
  OPS_OVERVIEW,
  REGIONAL_OPS,
  RUNTIME_MODULES,
  SYNC_STATUS,
} from '../../pages/operations/operationsMockData.js';
import { alertsFromSources } from './alertsAdapter.js';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stateFromCounts(critical, warning) {
  if (critical > 0) return OPERATIONAL_STATE.CRITICAL;
  if (warning > 0) return OPERATIONAL_STATE.WARNING;
  return OPERATIONAL_STATE.HEALTHY;
}

export function createMockOperationsSnapshot() {
  return {
    generatedAt: null,
    overview: { ...OPS_OVERVIEW },
    health: {
      status: OPS_OVERVIEW.sincronizacao,
      score: 92,
      affectedAreas: REGIONAL_OPS.filter((r) => r.alertas > 0).map((r) => r.label),
      criticalCount: 1,
      warningCount: 4,
    },
    modules: RUNTIME_MODULES.map((item) => ({ ...item })),
    regionalOperations: REGIONAL_OPS.map((item) => ({ ...item })),
    sync: { ...SYNC_STATUS, detalhes: SYNC_STATUS.detalhes.map((item) => ({ ...item })) },
    feed: OPERATIONS_FEED.map((item) => ({ ...item })),
    recommendations: [],
  };
}

function runtimeFromSources(fallback, alertSnapshot, totals) {
  return fallback.modules.map((module) => {
    if (module.id === 'contratos') {
      return {
        ...module,
        estado: alertSnapshot.totals.critical > 0 || alertSnapshot.totals.warning > 0
          ? OPERATIONAL_STATE.WARNING
          : OPERATIONAL_STATE.HEALTHY,
        pontosSincronizados: num(totals.activeContracts, module.pontosSincronizados),
        ultimaAtividade: 'summary real',
        tendencia: alertSnapshot.totals.warning > 0 ? 'atencao' : 'estavel',
      };
    }
    if (module.id === 'ocupacao') {
      return {
        ...module,
        pontosSincronizados: num(totals.totalBoards, module.pontosSincronizados),
        ultimaAtividade: 'summary real',
      };
    }
    if (module.id === 'alertas') {
      return {
        ...module,
        estado: alertSnapshot.totals.critical > 0 ? OPERATIONAL_STATE.WARNING : OPERATIONAL_STATE.HEALTHY,
        pontosSincronizados: alertSnapshot.alerts.length,
      };
    }
    return module;
  });
}

function regionalFromInventory(inventorySummary, alertSnapshot, fallback) {
  const regions = Array.isArray(inventorySummary?.regions) ? inventorySummary.regions : [];
  if (!regions.length) return fallback.regionalOperations;

  return regions.map((region, index) => {
    const occupancy = num(region.occupancyRate);
    const alertCount = alertSnapshot.alerts.filter((alert) =>
      (alert.regioesAfetadas ?? []).includes(region.name)
    ).length;
    return {
      id: region.id ?? `region-${index}`,
      label: region.name ?? 'Sem regiao',
      sigla: region.name?.slice(0, 2).toUpperCase() ?? '--',
      total: num(region.totalBoards),
      ativos: num(region.occupiedBoards),
      disponiveis: num(region.availableBoards),
      emManutencao: num(region.maintenanceBoards),
      ocupacao: occupancy,
      receitaAtiva: num(region.activeRevenue),
      alertas: alertCount,
      estado: stateFromCounts(0, alertCount || (occupancy < 0.65 ? 1 : 0)),
      prioridade: alertCount > 0 || occupancy < 0.65 ? 'alta' : 'normal',
      tendencia: occupancy >= 0.8 ? 'crescimento' : occupancy >= 0.65 ? 'estavel' : 'queda',
      responsavel: fallback.regionalOperations[index]?.responsavel ?? 'Ops',
      ultimaSync: 'summary real',
    };
  });
}

function feedFromAlerts(alertSnapshot, fallback) {
  const derived = alertSnapshot.alerts.slice(0, 6).map((alert) => ({
    id: `feed-${alert.id}`,
    tipo: alert.category ?? alert.categoria,
    icone: alert.severity === 'critical' ? 'crisis_alert' : alert.severity === 'warning' ? 'warning' : 'info',
    label: alert.title ?? alert.titulo,
    regiao: alert.region ?? alert.regioesAfetadas?.[0] ?? 'Todos',
    tempo: 'agora',
    cor: alert.severity === 'critical' ? 'var(--v4p-danger)' : alert.severity === 'warning' ? 'var(--v4p-warning)' : 'var(--v4p-accent)',
  }));
  return derived.length ? [...derived, ...fallback.feed].slice(0, 12) : fallback.feed;
}

export function operationsFromSources({ inventorySummary, contractsPayload, boards = [], sourceErrors = [] } = {}) {
  const fallback = createMockOperationsSnapshot();
  if (!inventorySummary && !contractsPayload && !boards.length && !sourceErrors.length) return fallback;

  const alertSnapshot = alertsFromSources({ inventorySummary, contractsPayload, boards, sourceErrors });
  const totals = inventorySummary?.totals ?? {};
  const contractsTotals = contractsPayload?.rawSummary?.totals ?? {};
  const revenue = inventorySummary?.revenue ?? {};
  const criticalCount = alertSnapshot.totals.critical;
  const warningCount = alertSnapshot.totals.warning;
  const status = stateFromCounts(criticalCount, warningCount);
  const totalBoards = num(totals.totalBoards, fallback.overview.totalPontos);
  const occupied = num(totals.occupiedBoards, fallback.overview.pontosAtivos);
  const available = num(totals.availableBoards, fallback.overview.pontosDisponiveis);
  const maintenance = num(totals.maintenanceBoards, fallback.overview.emManutencao);
  const reserved = num(totals.reservedBoards, fallback.overview.reservados);

  const overview = {
    ...fallback.overview,
    totalPontos: totalBoards,
    pontosAtivos: occupied,
    pontosDisponiveis: available,
    emManutencao: maintenance,
    reservados: reserved,
    ocupacaoGlobal: num(inventorySummary?.occupancy?.rate, totalBoards > 0 ? occupied / totalBoards : 0),
    receitaAtiva: num(revenue.activeMonthlyRevenue, fallback.overview.receitaAtiva),
    alertasRegionais: alertSnapshot.alerts.filter((a) => a.categoria === 'regional').length,
    sincronizacao: status,
    ultimaAtualizacao: 'via summaries',
  };

  return {
    generatedAt: inventorySummary?.generatedAt ?? contractsPayload?.generatedAt ?? new Date().toISOString(),
    overview,
    health: {
      status,
      score: Math.max(0, 100 - criticalCount * 18 - warningCount * 7),
      affectedAreas: alertSnapshot.alerts.flatMap((a) => a.regioesAfetadas ?? []).filter((item, index, list) => list.indexOf(item) === index),
      criticalCount,
      warningCount,
    },
    modules: runtimeFromSources(fallback, alertSnapshot, { totalBoards, activeContracts: contractsTotals.activeContracts }),
    regionalOperations: regionalFromInventory(inventorySummary, alertSnapshot, fallback),
    sync: {
      ...fallback.sync,
      status: sourceErrors.length ? 'warning' : 'healthy',
      lastUpdatedAt: inventorySummary?.generatedAt ?? contractsPayload?.generatedAt ?? new Date().toISOString(),
      sources: {
        inventorySummary: Boolean(inventorySummary),
        contracts: Boolean(contractsPayload),
        boards: Array.isArray(boards) && boards.length > 0,
        partialErrors: sourceErrors,
      },
      estado: sourceErrors.length ? OPERATIONAL_STATE.WARNING : OPERATIONAL_STATE.HEALTHY,
      ultimaSyncLabel: 'via API',
      totalPontos: totalBoards,
      pontosAtualizados: Math.max(0, totalBoards - sourceErrors.length),
      divergencias: sourceErrors.length,
    },
    feed: feedFromAlerts(alertSnapshot, fallback),
    recommendations: alertSnapshot.recommendations,
  };
}
