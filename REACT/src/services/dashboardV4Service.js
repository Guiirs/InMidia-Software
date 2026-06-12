import { ensureNoProductionMock, requestV4 } from './v4ServiceUtils.js';

const MIX_COLORS = {
  occupied: 'var(--v4p-success)',
  available: 'var(--v4p-accent)',
  maintenance: 'var(--v4p-warning)',
  critical: 'var(--v4p-danger)',
};

const KPI_META = {
  occupiedBoards: { id: 'placas-ocupadas', label: 'Placas ocupadas', icon: 'check_circle', trend: 'API real', trendUp: true },
  availableBoards: { id: 'placas-disponiveis', label: 'Placas disponiveis', icon: 'radio_button_unchecked', trend: 'API real', trendUp: true },
  activeRevenue: { id: 'receita-projetada', label: 'Receita mensal estimada', icon: 'payments', trend: 'API real', trendUp: true },
  contractsExpiring: { id: 'contratos-vencendo', label: 'Contratos ativos', icon: 'contract', trend: 'API real', trendUp: true },
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

function severityToTone(severity) {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function toKpi(meta, value, { highlight = false } = {}) {
  return {
    ...meta,
    value,
    highlight,
  };
}

function normalizeRegionRow(row, index) {
  const occupancyRate = num(row?.occupancyRate);
  return {
    id: row?.regionId || `region-${index}`,
    label: row?.name ?? 'Sem regiao',
    sigla: String(row?.name ?? '--').slice(0, 2).toUpperCase(),
    totalBoards: num(row?.total),
    occupiedBoards: num(row?.occupied),
    availableBoards: num(row?.available),
    occupancyRate: occupancyRate / 100,
    activeRevenue: 0,
    proposalsOpen: 0,
    contractsActive: 0,
    state: occupancyRate >= 70 ? 'healthy' : 'warning',
  };
}

function normalizeOverview(payload) {
  const totalBoards = num(payload?.totalBoards);
  const availableBoards = num(payload?.availableBoards);
  const occupiedBoards = num(payload?.occupiedBoards);
  const occupancyRate = num(payload?.occupancyRate);
  const activeRevenue = num(payload?.monthlyRevenue);
  const contractsActive = num(payload?.activeContracts);
  const criticalAlerts = num(payload?.criticalAlerts);
  const operations = payload?.operations ?? {};
  const maintenanceBoards = num(operations.maintenances) + num(operations.blocks);

  return {
    generatedAt: new Date().toISOString(),
    hero: {
      revenue: activeRevenue,
      revenueLabel: brl(activeRevenue),
      occupancyRate: occupancyRate / 100,
      growthLabel: '0%',
      totalBoards,
      occupiedBoards,
      expiringContracts: contractsActive,
      bars: [],
    },
    mainKpis: [
      toKpi(KPI_META.occupiedBoards, String(occupiedBoards)),
      toKpi(KPI_META.availableBoards, String(availableBoards)),
      toKpi(KPI_META.activeRevenue, brl(activeRevenue)),
      toKpi(KPI_META.contractsExpiring, String(contractsActive)),
    ],
    kpis: {
      totalBoards,
      availableBoards,
      occupiedBoards,
      occupancyRate,
      boardsWithoutCoordinates: num(payload?.boardsWithoutCoordinates),
      activeRevenue,
      contractsActive,
      regionsActive: 0,
      criticalAlerts,
    },
    executive: {
      operationalHealth: occupancyRate >= 70 ? 'healthy' : occupancyRate >= 50 ? 'warning' : 'critical',
      revenueHealth: activeRevenue > 0 ? 'healthy' : 'warning',
      occupancyHealth: occupancyRate >= 70 ? 'healthy' : 'warning',
      contractsHealth: contractsActive > 0 ? 'healthy' : 'warning',
      alertsHealth: criticalAlerts > 0 ? 'critical' : 'healthy',
    },
    operationMix: [
      { label: 'Ocupadas', value: occupiedBoards, color: MIX_COLORS.occupied },
      { label: 'Disponiveis', value: availableBoards, color: MIX_COLORS.available },
      { label: 'Manutencao', value: maintenanceBoards, color: MIX_COLORS.maintenance },
    ],
  };
}

function normalizeRegions(payload) {
  return {
    regions: arr(payload?.regions).map(normalizeRegionRow),
    domains: payload?.domains ?? null,
  };
}

function normalizeActivity(payload) {
  const items = arr(payload?.items);
  const activityTimeline = items.map((item, index) => ({
    id: item?.id ?? `dashboard-activity-${index}`,
    label: item?.label ?? 'Atividade operacional',
    regiao: item?.regionId ?? item?.domain ?? 'Sem regiao',
    tempo: item?.occurredAt ? new Date(item.occurredAt).toLocaleDateString('pt-BR') : 'agora',
    categoria: severityToTone(item?.severity),
  }));

  return {
    activityTimeline,
    timeline: activityTimeline,
    cursor: payload?.cursor ?? null,
  };
}

function normalizePerformance(payload) {
  const idleBoards = arr(payload?.idleBoards);
  const regions = arr(payload?.regions).map(normalizeRegionRow);
  const commercialRaw = payload?.commercial ?? {};
  const lowOccupancyRegions = regions.filter((region) => region.occupancyRate < 0.5).length;
  const availableInventoryPotential = num(commercialRaw.opportunities?.totalValue) + num(commercialRaw.proposals?.totalValue);

  return {
    idleBoards,
    regions,
    activityTimeline: idleBoards.map((board, index) => ({
      id: board?.id ?? `idle-board-${index}`,
      label: board?.numeroPlaca ? `Placa ${board.numeroPlaca} ociosa` : 'Placa ociosa',
      regiao: board?.regionId ?? 'Sem regiao',
      tempo: board?.since ? new Date(board.since).toLocaleDateString('pt-BR') : 'sem historico',
      categoria: 'warning',
    })),
    operations: {
      maintenanceBoards: 0,
      score: null,
      dataQualityIssues: 0,
    },
    commercial: {
      availableInventoryPotential,
      lowOccupancyRegions,
    },
    expiringContracts: arr(payload?.expiringContracts),
  };
}

function normalizeAlerts(payload) {
  const total = num(payload?.total);
  const critical = num(payload?.critical);
  const unread = num(payload?.unread);
  const byDomain = arr(payload?.byDomain);

  return {
    alerts: {
      total,
      critical,
      warning: Math.max(unread - critical, 0),
      info: Math.max(total - unread, 0),
      topAlerts: byDomain.slice(0, 5).map((domainRow) => ({
        id: domainRow?.domain,
        title: `${num(domainRow?.open)} alerta(s) em aberto`,
        severity: num(domainRow?.open) > 0 ? 'warning' : 'info',
        region: 'Todos',
      })),
    },
    priorityActions: [],
    recommendations: [],
  };
}

async function dashboardGet(path, operation, normalize) {
  const payload = await requestV4('get', path, { operation });
  return ensureNoProductionMock(normalize(payload), operation);
}

export async function getDashboardOverview() {
  return dashboardGet('/dashboard/overview', 'dashboard.overview.read', normalizeRegions);
}

export async function getDashboardKpis() {
  return dashboardGet('/dashboard/kpis', 'dashboard.kpis.read', normalizeOverview);
}

export async function getDashboardPerformance() {
  return dashboardGet('/dashboard/performance', 'dashboard.performance.read', normalizePerformance);
}

export async function getDashboardActivity() {
  return dashboardGet('/dashboard/activity', 'dashboard.activity.read', normalizeActivity);
}

export async function getDashboardAlertsSummary() {
  return dashboardGet('/dashboard/alerts-summary', 'dashboard.alerts-summary.read', normalizeAlerts);
}
