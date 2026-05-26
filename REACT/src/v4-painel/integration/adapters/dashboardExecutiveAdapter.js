// @deprecated — orphaned preview adapter; not imported by any production component.
// Mock data removed. Functions return empty/safe results.
import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';

const INVENTORY_BOARDS = [];
const ACTIVITY_TIMELINE = [];
const CONTRACTS_AT_RISK = [];
const CRITICAL_BOARDS = [];
const DASHBOARD_KPIS = [];
const IDLE_BOARDS = [];
const REVENUE_PROJECTION = { atual: 0, projetado: 0, meta: 0, percentMeta: 0, meses: [] };

const MIX_COLORS = {
  occupied: 'var(--v4p-success)',
  available: 'var(--v4p-accent)',
  maintenance: 'var(--v4p-warning)',
  reserved: 'var(--v4p-info)',
  critical: 'var(--v4p-danger)',
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function brl(value) {
  return `R$ ${num(value).toLocaleString('pt-BR')}`;
}

function pct(value) {
  return `${(num(value) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function toTone(priority) {
  if (priority === 'critical') return 'danger';
  if (priority === 'warning') return 'warning';
  return 'info';
}

function unique(list) {
  return list.filter((item, index) => list.indexOf(item) === index);
}

function cloneKpis() {
  return DASHBOARD_KPIS.map((item) => ({ ...item }));
}

function buildExecutiveHealth({ occupancyRate, revenueAtRisk, expiring7Days, operationsScore, criticalAlerts }) {
  return {
    operationalHealth: operationsScore >= 85 ? 'healthy' : operationsScore >= 65 ? 'warning' : 'critical',
    revenueHealth: revenueAtRisk > 50000 ? 'critical' : revenueAtRisk > 0 ? 'warning' : 'healthy',
    occupancyHealth: occupancyRate >= 0.75 ? 'healthy' : occupancyRate >= 0.65 ? 'warning' : 'critical',
    contractsHealth: expiring7Days > 0 ? 'critical' : 'warning',
    alertsHealth: criticalAlerts > 0 ? 'critical' : 'healthy',
  };
}

function buildRegionCards(inventorySummary, operationsSnapshot, alertsSnapshot) {
  const regions = arr(inventorySummary?.regions);
  if (!regions.length) return [];

  return regions.map((region, index) => {
    const occupancy = num(region.occupancyRate);
    const regionAlerts = alertsSnapshot.alerts.filter((alert) =>
      (alert.region ?? alert.regioesAfetadas?.[0]) === region.name
    ).length;
    const opRegion = operationsSnapshot.regionalOperations[index];

    return {
      id: region.id ?? `region-${index}`,
      label: region.name ?? 'Sem regiao',
      sigla: (region.name ?? '--').slice(0, 2).toUpperCase(),
      totalBoards: num(region.totalBoards),
      occupiedBoards: num(region.occupiedBoards),
      availableBoards: num(region.availableBoards),
      maintenanceBoards: num(region.maintenanceBoards),
      occupancyRate: occupancy,
      activeRevenue: num(region.activeRevenue),
      state: opRegion?.estado ?? (occupancy < 0.65 ? OPERATIONAL_STATE.WARNING : OPERATIONAL_STATE.HEALTHY),
      alerts: regionAlerts,
    };
  });
}

function buildHighlights({ kpis, operations, contracts, alerts, commercial }) {
  const items = [];

  if (alerts.critical > 0) {
    items.push({
      id: 'hl-critical-alerts',
      title: 'Alertas criticos ativos',
      detail: `${alerts.critical} alertas exigem acao imediata.`,
      value: String(alerts.critical),
      priority: 'critical',
    });
  }

  if (contracts.expiring7Days > 0) {
    items.push({
      id: 'hl-contracts-7',
      title: 'Contratos vencendo em 7 dias',
      detail: `${contracts.expiring7Days} contratos em janela critica.`,
      value: brl(contracts.atRiskRevenue),
      priority: 'critical',
    });
  }

  if (operations.criticalRegions > 0) {
    items.push({
      id: 'hl-critical-regions',
      title: 'Regioes em atencao operacional',
      detail: `${operations.criticalRegions} regioes com baixa ocupacao/alerta.`,
      value: String(operations.criticalRegions),
      priority: 'warning',
    });
  }

  if (operations.dataQualityIssues > 0) {
    items.push({
      id: 'hl-data-quality',
      title: 'Pendencias de dados de placas',
      detail: `${operations.dataQualityIssues} inconsistencias cadastrais detectadas.`,
      value: String(operations.dataQualityIssues),
      priority: 'warning',
    });
  }

  if (commercial.lowOccupancyRegions > 0) {
    items.push({
      id: 'hl-low-occupancy',
      title: 'Baixa ocupacao regional',
      detail: `${commercial.lowOccupancyRegions} regioes abaixo da meta.`,
      value: pct(kpis.occupancyRate),
      priority: 'warning',
    });
  }

  if (commercial.availableInventoryPotential > 0) {
    items.push({
      id: 'hl-opportunity',
      title: 'Oportunidade comercial imediata',
      detail: 'Inventario livre com potencial para ativacao.',
      value: brl(commercial.availableInventoryPotential),
      priority: 'info',
    });
  }

  return items.slice(0, 6);
}

function buildRecommendations({ alertsSnapshot, contracts, operations, commercial }) {
  const recommendations = [];

  if (contracts.expiring7Days > 0) {
    recommendations.push({
      id: 'rec-renew-critical',
      title: 'Renovar contratos criticos',
      detail: `${contracts.expiring7Days} contratos vencem em ate 7 dias.`,
      priority: 'critical',
    });
  }

  if (operations.dataQualityIssues > 0) {
    recommendations.push({
      id: 'rec-data-image',
      title: 'Revisar placas sem imagem/dados',
      detail: 'Corrigir pendencias de cadastro para melhorar operacao e comercial.',
      priority: 'warning',
    });
  }

  if (commercial.lowOccupancyRegions > 0) {
    recommendations.push({
      id: 'rec-regions',
      title: 'Revisar regioes abaixo da meta',
      detail: 'Ativar campanha comercial regional com foco em ocupacao.',
      priority: 'warning',
    });
  }

  if (commercial.availableInventoryPotential > 0) {
    recommendations.push({
      id: 'rec-increase-occupancy',
      title: 'Aumentar ocupacao regional',
      detail: `Potencial de ${brl(commercial.availableInventoryPotential)} em inventario disponivel.`,
      priority: 'info',
    });
  }

  if (alertsSnapshot.alerts.some((alert) => (alert.category ?? alert.categoria) === 'contrato')) {
    recommendations.push({
      id: 'rec-contract-pi',
      title: 'Revisar contratos sem PI',
      detail: 'Validar formalizacao contratual e lastro operacional da carteira.',
      priority: 'warning',
    });
  }

  return recommendations.slice(0, 5);
}

function buildTimeline({ alertsSnapshot, contractsPayload, operationsSnapshot }) {
  const items = [];

  arr(contractsPayload?.contracts)
    .filter((item) => num(item.diasRestantes, 999) <= 30)
    .slice(0, 3)
    .forEach((item, index) => {
      items.push({
        id: `tl-contract-${item.id ?? index}`,
        label: `${item.id ?? 'CTR'} - vencimento em ${Math.max(num(item.diasRestantes), 0)} dias`,
        regiao: item.regiao ?? 'Sem regiao',
        tempo: 'hoje',
        categoria: num(item.diasRestantes) <= 7 ? 'danger' : 'warning',
      });
    });

  alertsSnapshot.alerts.slice(0, 3).forEach((alert, index) => {
    items.push({
      id: `tl-alert-${alert.id ?? index}`,
      label: alert.title ?? alert.titulo,
      regiao: alert.region ?? alert.regioesAfetadas?.[0] ?? 'Todos',
      tempo: 'agora',
      categoria: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info',
    });
  });

  operationsSnapshot.regionalOperations
    .filter((item) => item.ocupacao < 0.65 || item.alertas > 0)
    .slice(0, 2)
    .forEach((item) => {
      items.push({
        id: `tl-region-${item.id}`,
        label: `Regiao ${item.label} em atencao operacional`,
        regiao: item.sigla,
        tempo: 'hoje',
        categoria: 'warning',
      });
    });

  return items.length ? items.slice(0, 8) : ACTIVITY_TIMELINE.slice(0, 8);
}

function buildUiPayload(snapshot, fallback) {
  const allKpis = cloneKpis();
  const setKpi = (id, patch) => {
    const item = allKpis.find((kpi) => kpi.id === id);
    if (item) Object.assign(item, patch);
  };

  setKpi('total-placas', { value: String(snapshot.kpis.totalBoards), raw: snapshot.kpis.totalBoards });
  setKpi('placas-ocupadas', { value: String(snapshot.kpis.occupiedBoards), raw: snapshot.kpis.occupiedBoards });
  setKpi('placas-disponiveis', { value: String(Math.max(snapshot.kpis.totalBoards - snapshot.kpis.occupiedBoards, 0)) });
  setKpi('taxa-ocupacao', { value: pct(snapshot.kpis.occupancyRate), raw: snapshot.kpis.occupancyRate });
  setKpi('receita-projetada', { value: brl(snapshot.kpis.activeRevenue), raw: snapshot.kpis.activeRevenue });
  setKpi('contratos-vencendo', { value: String(snapshot.kpis.contractsExpiring), raw: snapshot.kpis.contractsExpiring });
  setKpi('alertas-criticos', { value: String(snapshot.kpis.criticalAlerts), raw: snapshot.kpis.criticalAlerts });

  return {
    hero: {
      revenue: snapshot.kpis.activeRevenue,
      revenueLabel: brl(snapshot.kpis.activeRevenue),
      occupancyRate: snapshot.kpis.occupancyRate,
      growthLabel: fallback.hero.growthLabel,
      totalBoards: snapshot.kpis.totalBoards,
      occupiedBoards: snapshot.kpis.occupiedBoards,
      expiringContracts: snapshot.kpis.contractsExpiring,
      bars: fallback.hero.bars,
    },
    mainKpis: [
      allKpis.find((item) => item.id === 'placas-ocupadas'),
      allKpis.find((item) => item.id === 'placas-disponiveis'),
      allKpis.find((item) => item.id === 'receita-projetada'),
      allKpis.find((item) => item.id === 'contratos-vencendo'),
    ].filter(Boolean),
    priorityActions: snapshot.highlights.map((item) => ({
      label: item.title,
      value: item.value,
      detail: item.detail,
      tone: toTone(item.priority),
    })),
    operationMix: [
      { label: 'Ocupadas', value: snapshot.kpis.occupiedBoards, color: MIX_COLORS.occupied },
      { label: 'Disponiveis', value: Math.max(snapshot.kpis.totalBoards - snapshot.kpis.occupiedBoards, 0), color: MIX_COLORS.available },
      { label: 'Manutencao', value: snapshot.operations.maintenanceBoards, color: MIX_COLORS.maintenance },
      { label: 'Alertas criticos', value: snapshot.alerts.critical, color: MIX_COLORS.critical },
    ],
    featuredBoards: fallback.featuredBoards,
    activityTimeline: snapshot.timeline,
    revenueProjection: fallback.revenueProjection,
  };
}

export function createMockExecutiveDashboardSnapshot() {
  const fallback = {
    hero: {
      revenue: REVENUE_PROJECTION.atual,
      revenueLabel: brl(REVENUE_PROJECTION.atual),
      occupancyRate: 0.781,
      growthLabel: '12%',
      totalBoards: 847,
      occupiedBoards: 661,
      expiringContracts: CONTRACTS_AT_RISK.length,
      bars: REVENUE_PROJECTION.meses.slice(4, 12),
    },
    mainKpis: [
      DASHBOARD_KPIS.find((item) => item.id === 'placas-ocupadas'),
      DASHBOARD_KPIS.find((item) => item.id === 'placas-disponiveis'),
      DASHBOARD_KPIS.find((item) => item.id === 'receita-projetada'),
      DASHBOARD_KPIS.find((item) => item.id === 'contratos-vencendo'),
    ].filter(Boolean).map((item) => ({ ...item })),
    priorityActions: [
      {
        label: 'Contratos vencendo',
        value: `${CONTRACTS_AT_RISK.length} contas`,
        detail: 'Renovacao comercial hoje',
        tone: 'warning',
      },
      {
        label: 'Placas ociosas',
        value: `${IDLE_BOARDS.length} pontos`,
        detail: 'Potencial premium disponivel',
        tone: 'info',
      },
      {
        label: 'Alertas criticos',
        value: `${CRITICAL_BOARDS.length} ativos`,
        detail: 'Campo e manutencao acionados',
        tone: 'danger',
      },
      {
        label: 'Sync pendente',
        value: '42s',
        detail: 'Ultimo ciclo concluido',
        tone: 'success',
      },
    ],
    operationMix: [
      { label: 'Ocupadas', value: 661, color: MIX_COLORS.occupied },
      { label: 'Disponiveis', value: 186, color: MIX_COLORS.available },
      { label: 'Manutencao', value: 21, color: MIX_COLORS.maintenance },
      { label: 'Reservadas', value: 38, color: MIX_COLORS.reserved },
      { label: 'Criticas', value: 3, color: MIX_COLORS.critical },
    ],
    featuredBoards: INVENTORY_BOARDS.slice(0, 7),
    activityTimeline: ACTIVITY_TIMELINE,
    revenueProjection: REVENUE_PROJECTION,
  };

  const snapshot = {
    generatedAt: null,
    executive: {
      operationalHealth: 'healthy',
      revenueHealth: 'warning',
      occupancyHealth: 'healthy',
      contractsHealth: 'warning',
      alertsHealth: 'critical',
    },
    kpis: {
      totalBoards: 847,
      occupiedBoards: 661,
      occupancyRate: 0.781,
      activeRevenue: REVENUE_PROJECTION.atual,
      revenueAtRisk: 34400,
      contractsExpiring: CONTRACTS_AT_RISK.length,
      criticalAlerts: CRITICAL_BOARDS.length,
    },
    operations: {
      score: 92,
      criticalRegions: 1,
      maintenanceBoards: 21,
      dataQualityIssues: 0,
    },
    commercial: {
      renewalPotential: 512000,
      availableInventoryPotential: 0,
      lowOccupancyRegions: 1,
      revenueProjection: REVENUE_PROJECTION.atual,
    },
    alerts: {
      critical: 3,
      warning: 4,
      info: 1,
      topAlerts: CRITICAL_BOARDS.slice(0, 3).map((item, index) => ({
        id: `mock-alert-${index}`,
        title: item.codigo,
        severity: 'critical',
        region: item.regiao ?? 'SP',
      })),
    },
    contracts: {
      expiring7Days: 3,
      expiring15Days: 5,
      expiring30Days: CONTRACTS_AT_RISK.length,
      atRiskRevenue: 34400,
    },
    regions: [],
    highlights: [
      { id: 'mock-hl-1', title: 'Contratos vencendo', detail: 'Renovacao comercial hoje', value: '3', priority: 'critical' },
      { id: 'mock-hl-2', title: 'Alertas criticos', detail: 'Campo e manutencao acionados', value: '3', priority: 'critical' },
      { id: 'mock-hl-3', title: 'Baixa ocupacao regional', detail: 'Ativar plano comercial regional', value: '67,4%', priority: 'warning' },
    ],
    recommendations: [
      { id: 'mock-rec-1', title: 'Renovar contratos criticos', detail: 'Priorizar carteira que vence em ate 7 dias.', priority: 'critical' },
      { id: 'mock-rec-2', title: 'Revisar regioes abaixo da meta', detail: 'Ativar prospeccao nas regioes de baixa ocupacao.', priority: 'warning' },
    ],
    timeline: ACTIVITY_TIMELINE.slice(0, 8),
  };

  return {
    ...fallback,
    ...snapshot,
    state: OPERATIONAL_STATE.HEALTHY,
    ui: fallback,
  };
}

export function dashboardExecutiveFromSources({
  inventorySummary,
  contractsPayload,
  commercialSnapshot,
  operationsSnapshot,
  alertsSnapshot,
  boards = [],
  sourceErrors = [],
} = {}) {
  const fallback = createMockExecutiveDashboardSnapshot();
  const noSource = !inventorySummary && !contractsPayload && !commercialSnapshot && !operationsSnapshot && !alertsSnapshot;
  if (noSource) return fallback;

  const totals = inventorySummary?.totals ?? {};
  const occupancy = inventorySummary?.occupancy ?? {};
  const revenue = inventorySummary?.revenue ?? {};
  const expiringFromInventory = inventorySummary?.expiringContracts ?? {};
  const contractsTotals = contractsPayload?.rawSummary?.totals ?? {};
  const contractsSummary = contractsPayload?.summary ?? {};
  const alertList = arr(alertsSnapshot?.alerts);

  const kpis = {
    totalBoards: num(totals.totalBoards, fallback.kpis.totalBoards),
    occupiedBoards: num(totals.occupiedBoards, fallback.kpis.occupiedBoards),
    occupancyRate: num(occupancy.rate, fallback.kpis.occupancyRate),
    activeRevenue: num(contractsSummary.receitaComprometida, num(revenue.activeMonthlyRevenue, fallback.kpis.activeRevenue)),
    revenueAtRisk: num(contractsSummary.receitaEmRisco, fallback.kpis.revenueAtRisk),
    contractsExpiring: num(contractsSummary.vencendoEm30Dias, num(expiringFromInventory.next30Days, fallback.kpis.contractsExpiring)),
    criticalAlerts: num(alertsSnapshot?.totals?.critical, fallback.kpis.criticalAlerts),
  };

  const operations = {
    score: num(operationsSnapshot?.health?.score, fallback.operations.score),
    criticalRegions: arr(operationsSnapshot?.regionalOperations).filter((item) => item.ocupacao < 0.65 || num(item.alertas) > 0).length,
    maintenanceBoards: num(totals.maintenanceBoards, fallback.operations.maintenanceBoards),
    dataQualityIssues: alertList.filter((alert) =>
      (alert.category ?? alert.categoria) === 'operacional' &&
      /pendencias|sem imagem|sem regiao|sem coordenadas/i.test(alert.title ?? alert.titulo ?? '')
    ).length,
  };

  const commercial = {
    renewalPotential: num(commercialSnapshot?.kpis?.renewalPotential, fallback.commercial.renewalPotential),
    availableInventoryPotential: num(commercialSnapshot?.kpis?.availableInventoryPotential, fallback.commercial.availableInventoryPotential),
    lowOccupancyRegions: arr(inventorySummary?.highlights?.lowOccupancyRegions).length,
    revenueProjection: num(commercialSnapshot?.revenueForecast?.receitaRecorrente, kpis.activeRevenue),
  };

  const contracts = {
    expiring7Days: num(contractsTotals.expiring7Days, num(expiringFromInventory.next7Days, fallback.contracts.expiring7Days)),
    expiring15Days: num(contractsTotals.expiring15Days, num(expiringFromInventory.next15Days, fallback.contracts.expiring15Days)),
    expiring30Days: num(contractsTotals.expiring30Days, num(expiringFromInventory.next30Days, fallback.contracts.expiring30Days)),
    atRiskRevenue: kpis.revenueAtRisk,
  };

  const alerts = {
    critical: num(alertsSnapshot?.totals?.critical),
    warning: num(alertsSnapshot?.totals?.warning),
    info: num(alertsSnapshot?.totals?.info),
    topAlerts: alertList.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title ?? item.titulo,
      severity: item.severity,
      region: item.region ?? item.regioesAfetadas?.[0] ?? 'Todos',
    })),
  };

  const executive = buildExecutiveHealth({
    occupancyRate: kpis.occupancyRate,
    revenueAtRisk: contracts.atRiskRevenue,
    expiring7Days: contracts.expiring7Days,
    operationsScore: operations.score,
    criticalAlerts: alerts.critical,
  });

  const regions = buildRegionCards(inventorySummary, operationsSnapshot, alertsSnapshot);
  const highlights = buildHighlights({ kpis, operations, contracts, alerts, commercial });
  const recommendations = buildRecommendations({ alertsSnapshot, contracts, operations, commercial });
  const timeline = buildTimeline({ alertsSnapshot, contractsPayload, operationsSnapshot });

  const snapshot = {
    generatedAt: inventorySummary?.generatedAt ?? contractsPayload?.generatedAt ?? new Date().toISOString(),
    executive,
    kpis,
    operations,
    commercial,
    alerts,
    contracts,
    regions,
    highlights,
    recommendations,
    timeline,
  };

  const ui = buildUiPayload(snapshot, fallback);
  const affectedState = executive.operationalHealth === 'critical' ? OPERATIONAL_STATE.CRITICAL : executive.operationalHealth === 'warning' ? OPERATIONAL_STATE.WARNING : OPERATIONAL_STATE.HEALTHY;

  return {
    ...ui,
    ...snapshot,
    state: affectedState,
    ui,
    sourceErrors: unique(sourceErrors),
    metadata: {
      partial: sourceErrors.length > 0,
      usedBoards: boards.length,
    },
  };
}
