import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';

const DashboardContext = createContext(null);

const DASHBOARD_RESOURCE_KEYS = [
  'dashboard.kpis',
  'dashboard.overview',
  'dashboard.activity',
  'dashboard.performance',
  'dashboard.alertsSummary',
];

const BLOCKING_STATUSES = new Set(['error', 'unauthorized', 'forbidden', 'offline']);

function firstError(resources) {
  const failed = resources.find((resource) => resource.error);
  if (!failed) return null;
  return failed.error?.message ?? 'Nao foi possivel carregar o Dashboard executivo.';
}

function statusFrom(resources) {
  if (resources.some((resource) => resource.status === 'unauthorized')) return 'unauthorized';
  if (resources.some((resource) => resource.status === 'offline')) return 'offline';
  if (resources.some((resource) => resource.status === 'forbidden')) return 'forbidden';
  if (resources.some((resource) => resource.status === 'error')) return 'error';
  if (resources.some((resource) => resource.status === 'stale' || resource.isStale)) return 'stale';
  if (resources.some((resource) => resource.status === 'refreshing' || resource.isRefreshing)) return 'refreshing';
  if (resources.some((resource) => resource.status === 'loading' || resource.status === 'idle')) return 'loading';
  return 'success';
}

function sourceFrom(status, hasRealData) {
  if (BLOCKING_STATUSES.has(status)) return status;
  if (status === 'stale' || status === 'refreshing') return 'stale';
  if (!hasRealData) return 'empty';
  return 'real';
}

function createEmptyDashboardSnapshot() {
  return {
    generatedAt: null,
    hero: {
      revenue: 0,
      revenueLabel: 'R$ 0',
      occupancyRate: 0,
      growthLabel: '0%',
      totalBoards: 0,
      occupiedBoards: 0,
      expiringContracts: 0,
      bars: [],
    },
    mainKpis: [],
    kpis: {
      totalBoards: 0,
      availableBoards: 0,
      occupiedBoards: 0,
      occupancyRate: 0,
      activeRevenue: 0,
      contractsActive: 0,
      regionsActive: 0,
      criticalAlerts: 0,
    },
    executive: {
      operationalHealth: 'warning',
      revenueHealth: 'warning',
      occupancyHealth: 'warning',
      contractsHealth: 'warning',
      alertsHealth: 'warning',
    },
    activityTimeline: [],
    timeline: [],
    operationMix: [],
    featuredBoards: [],
    revenueProjection: null,
    operations: null,
    commercial: null,
    regions: [],
    alerts: { total: 0, critical: 0, warning: 0, info: 0, topAlerts: [] },
    priorityActions: [],
    recommendations: [],
  };
}

function mergeDashboardResources({ fallback, kpis, overview, activity, performance, alertsSummary }) {
  // overview.data pode ser truthy mas não ter todos os campos do snapshot —
  // por isso cada campo cai no fallback explicitamente, não via spread do base.
  const base = overview.data ?? fallback;

  return {
    ...fallback,
    ...base,
    hero:             kpis.data?.hero             ?? base.hero             ?? fallback.hero,
    mainKpis:         kpis.data?.mainKpis         ?? base.mainKpis         ?? fallback.mainKpis         ?? [],
    kpis:             kpis.data?.kpis             ?? base.kpis             ?? fallback.kpis,
    executive:        kpis.data?.executive        ?? base.executive        ?? fallback.executive,
    activityTimeline: activity.data?.activityTimeline ?? base.activityTimeline ?? fallback.activityTimeline ?? [],
    timeline:         activity.data?.timeline     ?? base.timeline         ?? fallback.timeline          ?? [],
    operationMix:     performance.data?.operationMix   ?? kpis.data?.operationMix ?? base.operationMix   ?? fallback.operationMix   ?? [],
    featuredBoards:   activity.data?.featuredBoards ?? performance.data?.featuredBoards ?? base.featuredBoards ?? fallback.featuredBoards  ?? [],
    revenueProjection:performance.data?.revenueProjection ?? base.revenueProjection ?? fallback.revenueProjection,
    operations:       performance.data?.operations ?? base.operations      ?? fallback.operations,
    commercial:       performance.data?.commercial ?? base.commercial      ?? fallback.commercial,
    regions:          overview.data?.regions       ?? performance.data?.regions ?? base.regions         ?? fallback.regions           ?? [],
    alerts:           alertsSummary.data?.alerts   ?? base.alerts          ?? fallback.alerts,
    priorityActions:  alertsSummary.data?.priorityActions ?? base.priorityActions ?? fallback.priorityActions ?? [],
    recommendations:  alertsSummary.data?.recommendations ?? base.recommendations ?? fallback.recommendations ?? [],
  };
}

function DashboardProvider({ children }) {
  const kpis = useSyncResource('dashboard.kpis');
  const overview = useSyncResource('dashboard.overview');
  const activity = useSyncResource('dashboard.activity');
  const performance = useSyncResource('dashboard.performance');
  const alertsSummary = useSyncResource('dashboard.alertsSummary');

  const resources = useMemo(() => [kpis, overview, activity, performance, alertsSummary], [
    activity,
    alertsSummary,
    kpis,
    overview,
    performance,
  ]);

  const refresh = useCallback(() => (
    Promise.all(DASHBOARD_RESOURCE_KEYS.map((resourceKey) => {
      const resource = {
        'dashboard.kpis': kpis,
        'dashboard.overview': overview,
        'dashboard.activity': activity,
        'dashboard.performance': performance,
        'dashboard.alertsSummary': alertsSummary,
      }[resourceKey];
      return resource.refresh({ reason: 'dashboard.manual-refresh' });
    }))
  ), [activity, alertsSummary, kpis, overview, performance]);

  const value = useMemo(() => {
    const fallback = createEmptyDashboardSnapshot();
    const status = statusFrom(resources);
    const hasRealData = resources.some((resource) => Boolean(resource.data));
    const dashboard = mergeDashboardResources({ fallback, kpis, overview, activity, performance, alertsSummary });
    const error = firstError(resources);

    return {
      dashboard,
      loading: status === 'loading',
      refreshing: status === 'refreshing',
      stale: status === 'stale',
      status,
      error,
      source: sourceFrom(status, hasRealData),
      refresh,
    };
  }, [activity, alertsSummary, kpis, overview, performance, refresh, resources]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('[v4-painel] useDashboard deve ser usado dentro de <DashboardProvider>');
  return ctx;
}

export default memo(DashboardProvider);
