const BOARD_STATUS = {
  OCCUPIED: 'occupied',
  AVAILABLE: 'available',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
  CRITICAL: 'critical',
};

const EMPTY_INVENTORY_SUMMARY = {
  total: 0,
  ocupadas: 0,
  disponiveis: 0,
  manutencao: 0,
  reservadas: 0,
  criticas: 0,
  taxaOcupacao: 0,
  receitaTotal: 0,
};

const STATUS_META = {
  occupied:    { label: 'Ocupadas',      icon: 'check_circle', color: 'var(--v4p-success)' },
  available:   { label: 'Disponíveis',   icon: 'radio_button_unchecked', color: 'var(--v4p-accent)' },
  maintenance: { label: 'Em manutenção', icon: 'build', color: 'var(--v4p-warning)' },
  reserved:    { label: 'Reservadas',    icon: 'bookmark', color: 'var(--v4p-info)' },
  critical:    { label: 'Críticas',      icon: 'crisis_alert', color: 'var(--v4p-danger)' },
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function pct(count, total) {
  return total > 0 ? count / total : 0;
}

function compactSummary(apiSummary) {
  const totals = apiSummary?.totals ?? {};
  const occupancy = apiSummary?.occupancy ?? {};
  const revenue = apiSummary?.revenue ?? {};

  return {
    total: num(totals.totalBoards),
    ocupadas: num(totals.occupiedBoards),
    disponiveis: num(totals.availableBoards),
    manutencao: num(totals.maintenanceBoards),
    reservadas: num(totals.reservedBoards),
    criticas: num(totals.criticalBoards),
    taxaOcupacao: num(occupancy.rate),
    receitaTotal: num(revenue.activeMonthlyRevenue),
  };
}

export function normalizeInventorySummary(payload, fallback = EMPTY_INVENTORY_SUMMARY) {
  const raw = payload?.data ?? payload ?? {};
  const compact = compactSummary(raw);
  const total = compact.total || fallback.total || 0;

  const statusDistribution = arr(raw.statusDistribution).length > 0
    ? raw.statusDistribution.map((item) => {
        const meta = STATUS_META[item.status] ?? {};
        return {
          status: item.status,
          label: item.label ?? meta.label ?? item.status,
          count: num(item.count),
          percentage: num(item.percentage),
          pct: num(item.percentage),
          cor: meta.color ?? 'var(--v4p-text-4)',
          icone: meta.icon ?? 'radio_button_unchecked',
        };
      })
    : [
        ['occupied', compact.ocupadas],
        ['available', compact.disponiveis],
        ['maintenance', compact.manutencao],
        ['reserved', compact.reservadas],
        ['critical', compact.criticas],
      ].map(([status, count]) => ({
        status,
        label: STATUS_META[status].label,
        count,
        percentage: pct(count, total),
        pct: pct(count, total),
        cor: STATUS_META[status].color,
        icone: STATUS_META[status].icon,
      }));

  return {
    generatedAt: raw.generatedAt ?? null,
    totals: {
      totalBoards: compact.total,
      occupiedBoards: compact.ocupadas,
      availableBoards: compact.disponiveis,
      reservedBoards: compact.reservadas,
      maintenanceBoards: compact.manutencao,
      criticalBoards: compact.criticas,
    },
    occupancy: {
      rate: compact.taxaOcupacao,
      availableRate: num(raw.occupancy?.availableRate, pct(compact.disponiveis, total)),
      reservedRate: num(raw.occupancy?.reservedRate, pct(compact.reservadas, total)),
      maintenanceRate: num(raw.occupancy?.maintenanceRate, pct(compact.manutencao, total)),
    },
    revenue: {
      activeMonthlyRevenue: compact.receitaTotal,
      estimatedAvailableRevenue: num(raw.revenue?.estimatedAvailableRevenue),
      projectedMonthlyRevenue: num(raw.revenue?.projectedMonthlyRevenue),
    },
    regions: arr(raw.regions),
    statusDistribution,
    expiringContracts: {
      next7Days: num(raw.expiringContracts?.next7Days),
      next15Days: num(raw.expiringContracts?.next15Days),
      next30Days: num(raw.expiringContracts?.next30Days),
    },
    highlights: {
      topRegions: arr(raw.highlights?.topRegions),
      lowOccupancyRegions: arr(raw.highlights?.lowOccupancyRegions),
      criticalBoards: arr(raw.highlights?.criticalBoards),
      idleBoards: arr(raw.highlights?.idleBoards),
    },
    compact: {
      ...fallback,
      ...compact,
      total: compact.total || fallback.total || 0,
      taxaOcupacao: compact.taxaOcupacao || pct(compact.ocupadas, total),
    },
  };
}

export function deriveInventorySummary(boards = [], fallback = EMPTY_INVENTORY_SUMMARY) {
  const list = Array.isArray(boards) ? boards : [];
  const total = list.length;
  const count = (status) => list.filter((board) => board.status === status).length;
  const compact = {
    ...fallback,
    total,
    ocupadas: count(BOARD_STATUS.OCCUPIED),
    disponiveis: count(BOARD_STATUS.AVAILABLE),
    manutencao: count(BOARD_STATUS.MAINTENANCE),
    reservadas: count(BOARD_STATUS.RESERVED),
    criticas: count(BOARD_STATUS.CRITICAL),
    receitaTotal: list
      .filter((board) => board.status === BOARD_STATUS.OCCUPIED)
      .reduce((sum, board) => sum + num(board.receitaEstimada), 0),
  };
  compact.taxaOcupacao = pct(compact.ocupadas, total);

  return normalizeInventorySummary({
    generatedAt: new Date().toISOString(),
    totals: {
      totalBoards: compact.total,
      occupiedBoards: compact.ocupadas,
      availableBoards: compact.disponiveis,
      reservedBoards: compact.reservadas,
      maintenanceBoards: compact.manutencao,
      criticalBoards: compact.criticas,
    },
    occupancy: { rate: compact.taxaOcupacao },
    revenue: { activeMonthlyRevenue: compact.receitaTotal },
  }, compact);
}
