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

function brl(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR')}`;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function cloneKpis() {
  return DASHBOARD_KPIS.map((item) => ({ ...item }));
}

export function createMockDashboardPayload() {
  return {
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
        detail: 'Renovação comercial hoje',
        tone: 'warning',
      },
      {
        label: 'Placas ociosas',
        value: `${IDLE_BOARDS.length} pontos`,
        detail: 'Potencial premium disponível',
        tone: 'info',
      },
      {
        label: 'Alertas críticos',
        value: `${CRITICAL_BOARDS.length} ativos`,
        detail: 'Campo e manutenção acionados',
        tone: 'danger',
      },
      {
        label: 'Sync pendente',
        value: '42s',
        detail: 'Último ciclo concluído',
        tone: 'success',
      },
    ],
    operationMix: [
      { label: 'Ocupadas', value: 661, color: MIX_COLORS.occupied },
      { label: 'Disponíveis', value: 186, color: MIX_COLORS.available },
      { label: 'Manutenção', value: 21, color: MIX_COLORS.maintenance },
      { label: 'Reservadas', value: 38, color: MIX_COLORS.reserved },
      { label: 'Críticas', value: 3, color: MIX_COLORS.critical },
    ],
    featuredBoards: INVENTORY_BOARDS.slice(0, 7),
    activityTimeline: ACTIVITY_TIMELINE,
    revenueProjection: REVENUE_PROJECTION,
  };
}

export function dashboardFromInventorySummary(summary, contractsSummary = null) {
  const fallback = createMockDashboardPayload();
  if (!summary) return fallback;

  const totals = summary.totals ?? {};
  const occupancy = summary.occupancy ?? {};
  const revenue = summary.revenue ?? {};
  const expiring = summary.expiringContracts ?? {};
  const highlights = summary.highlights ?? {};
  const allKpis = cloneKpis();

  const totalBoards = Number(totals.totalBoards ?? fallback.hero.totalBoards);
  const occupiedBoards = Number(totals.occupiedBoards ?? fallback.hero.occupiedBoards);
  const availableBoards = Number(totals.availableBoards ?? 0);
  const criticalCount = Number(totals.criticalBoards ?? 0);
  const expiring30 = Number(contractsSummary?.summary?.vencendoEm30Dias ?? expiring.next30Days ?? fallback.hero.expiringContracts);
  const revenueAtRisk = Number(contractsSummary?.summary?.receitaEmRisco ?? 0);
  const projectedRevenue = Number(revenue.projectedMonthlyRevenue || revenue.activeMonthlyRevenue || fallback.hero.revenue);
  const occupancyRate = Number(occupancy.rate ?? fallback.hero.occupancyRate);
  const statusDistribution = Array.isArray(summary.statusDistribution) ? summary.statusDistribution : [];
  const operationMix = statusDistribution.length > 0
    ? statusDistribution.map((item) => ({
        label: item.label,
        value: Number(item.count ?? 0),
        color: MIX_COLORS[item.status] ?? item.cor ?? 'var(--v4p-text-4)',
      }))
    : fallback.operationMix;

  const setKpi = (id, patch) => {
    const item = allKpis.find((kpi) => kpi.id === id);
    if (item) Object.assign(item, patch);
  };

  setKpi('total-placas', { value: String(totalBoards), raw: totalBoards });
  setKpi('placas-ocupadas', { value: String(occupiedBoards), raw: occupiedBoards });
  setKpi('placas-disponiveis', { value: String(availableBoards), raw: availableBoards });
  setKpi('taxa-ocupacao', { value: pct(occupancyRate), raw: occupancyRate });
  setKpi('receita-projetada', { value: brl(projectedRevenue), raw: projectedRevenue });
  setKpi('contratos-vencendo', { value: String(expiring30), raw: expiring30 });
  setKpi('alertas-criticos', { value: String(criticalCount), raw: criticalCount });

  return {
    ...fallback,
    hero: {
      ...fallback.hero,
      revenue: projectedRevenue,
      revenueLabel: brl(projectedRevenue),
      occupancyRate,
      totalBoards,
      occupiedBoards,
      expiringContracts: expiring30,
    },
    mainKpis: [
      allKpis.find((item) => item.id === 'placas-ocupadas'),
      allKpis.find((item) => item.id === 'placas-disponiveis'),
      allKpis.find((item) => item.id === 'receita-projetada'),
      allKpis.find((item) => item.id === 'contratos-vencendo'),
    ].filter(Boolean),
    priorityActions: [
      {
        label: 'Contratos vencendo',
        value: `${expiring30} contas`,
        detail: revenueAtRisk > 0 ? `${brl(revenueAtRisk)}/mes em risco` : 'Próximos 30 dias',
        tone: expiring30 > 0 ? 'warning' : 'success',
      },
      {
        label: 'Placas ociosas',
        value: `${(highlights.idleBoards ?? []).length} pontos`,
        detail: 'Potencial disponível',
        tone: 'info',
      },
      {
        label: 'Alertas críticos',
        value: `${criticalCount} ativos`,
        detail: 'Campo e manutenção',
        tone: criticalCount > 0 ? 'danger' : 'success',
      },
      fallback.priorityActions[3],
    ],
    operationMix,
    regions: summary.regions ?? [],
    generatedAt: summary.generatedAt ?? null,
    state: occupancyRate >= 0.7 ? OPERATIONAL_STATE.HEALTHY : OPERATIONAL_STATE.WARNING,
  };
}
