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

function statusFromBoardStatus(status) {
  return status === 'ocupada' ? 'occupied' : 'available';
}

function severityToTone(severity) {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function toBoard(row, index) {
  const placa = row?.placa ?? row?.numero_placa ?? row?.codigo ?? `PL-${index + 1}`;
  const revenue = num(row?.receitaGerada ?? row?.receitaEstimada);
  return {
    id: row?.placaId ?? placa,
    codigo: placa,
    nome: row?.localizacao ?? placa,
    localizacao: row?.localizacao ?? 'Sem localizacao',
    regiao: row?.regiao ?? 'Sem regiao',
    siglaRegiao: String(row?.regiao ?? '--').slice(0, 2).toUpperCase(),
    status: statusFromBoardStatus(row?.statusAtual ?? row?.status),
    cliente: null,
    campanha: row?.quantidadeAlugueisContratos ? `${row.quantidadeAlugueisContratos} contratos/alugueis` : null,
    vencimento: null,
    receita: revenue,
    receitaFormatada: revenue > 0 ? brl(revenue) : 'R$ 0',
  };
}

function toActivity(row, index) {
  return {
    id: row?.placaId ?? row?.id ?? `dashboard-activity-${index}`,
    label: row?.titulo ?? row?.placa ?? row?.localizacao ?? 'Atividade operacional',
    regiao: row?.regiao ?? row?.meta?.regiao ?? 'Sem regiao',
    tempo: row?.ultimaLocacao ? new Date(row.ultimaLocacao).toLocaleDateString('pt-BR') : 'agora',
    categoria: severityToTone(row?.severidade ?? row?.severity),
  };
}

function toKpi(meta, value, { highlight = false } = {}) {
  return {
    ...meta,
    value,
    highlight,
  };
}

function normalizeOverview(payload) {
  const totalBoards = num(payload?.totalPlacas);
  const availableBoards = num(payload?.placasDisponiveis);
  const occupiedBoards = num(payload?.placasAlugadasOcupadas);
  const occupancyRate = num(payload?.taxaOcupacao);
  const activeRevenue = num(payload?.receitaEstimadaMensal);
  const contractsActive = num(payload?.contratosAtivos);
  const regionsActive = num(payload?.regioesAtivas);
  const maintenanceBoards = Math.max(totalBoards - availableBoards - occupiedBoards, 0);

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
      activeRevenue,
      contractsActive,
      regionsActive,
      criticalAlerts: 0,
    },
    executive: {
      operationalHealth: occupancyRate >= 70 ? 'healthy' : occupancyRate >= 50 ? 'warning' : 'critical',
      revenueHealth: activeRevenue > 0 ? 'healthy' : 'warning',
      occupancyHealth: occupancyRate >= 70 ? 'healthy' : 'warning',
      contractsHealth: contractsActive > 0 ? 'healthy' : 'warning',
      alertsHealth: 'healthy',
    },
    operationMix: [
      { label: 'Ocupadas', value: occupiedBoards, color: MIX_COLORS.occupied },
      { label: 'Disponiveis', value: availableBoards, color: MIX_COLORS.available },
      { label: 'Manutencao', value: maintenanceBoards, color: MIX_COLORS.maintenance },
    ],
  };
}

function normalizeRegions(payload) {
  const regions = arr(payload).map((row, index) => ({
    id: row?.regiaoId ?? `region-${index}`,
    label: row?.regiao ?? 'Sem regiao',
    sigla: String(row?.regiao ?? '--').slice(0, 2).toUpperCase(),
    totalBoards: num(row?.totalPlacas),
    occupiedBoards: num(row?.placasAlugadas),
    availableBoards: Math.max(num(row?.totalPlacas) - num(row?.placasAlugadas), 0),
    occupancyRate: num(row?.taxaOcupacao) / 100,
    activeRevenue: num(row?.receitaEstimada),
    proposalsOpen: num(row?.propostasAbertas),
    contractsActive: num(row?.contratosAtivos),
    state: num(row?.taxaOcupacao) >= 70 ? 'healthy' : 'warning',
  }));

  return { regions };
}

function normalizeActivity(payload) {
  const mostRentedBoards = arr(payload);
  return {
    mostRentedBoards,
    featuredBoards: mostRentedBoards.map(toBoard),
    activityTimeline: mostRentedBoards.map(toActivity),
    timeline: mostRentedBoards.map(toActivity),
  };
}

function normalizePerformance(payload) {
  const idleBoards = arr(payload);
  return {
    idleBoards,
    activityTimeline: idleBoards.map((row, index) => ({
      ...toActivity(row, index),
      label: row?.placa ? `Placa ${row.placa} ociosa` : 'Placa ociosa',
      tempo: row?.diasSemAluguel == null ? 'sem historico' : `${row.diasSemAluguel} dias`,
      categoria: row?.nuncaAlugada || num(row?.diasSemAluguel) >= 120 ? 'danger' : 'warning',
    })),
  };
}

function normalizeAlerts(payload) {
  const alerts = arr(payload);
  const totals = alerts.reduce((acc, alert) => {
    const severity = alert?.severidade ?? 'info';
    acc[severity] = (acc[severity] ?? 0) + 1;
    acc.total += 1;
    return acc;
  }, { total: 0, critical: 0, warning: 0, info: 0 });

  return {
    alerts: {
      ...totals,
      topAlerts: alerts.slice(0, 5).map((alert) => ({
        id: alert.id,
        title: alert.titulo,
        severity: alert.severidade,
        region: alert.meta?.regiao ?? 'Todos',
      })),
    },
    priorityActions: alerts.slice(0, 4).map((alert) => ({
      label: alert.titulo,
      value: alert.severidade === 'critical' ? 'critico' : alert.severidade,
      detail: alert.acaoSugerida ?? alert.descricao,
      tone: severityToTone(alert.severidade),
    })),
    recommendations: alerts.slice(0, 5).map((alert) => ({
      id: alert.id,
      title: alert.titulo,
      detail: alert.acaoSugerida ?? alert.descricao,
      priority: alert.severidade,
    })),
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
