import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncMutation } from '../../core/sync-core/hooks/useSyncMutation.js';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';

const CampaignsContext = createContext(null);

const RESOURCE_KEYS = [
  'campaigns.summary',
  'campaigns.list',
  'campaigns.active',
  'campaigns.scheduled',
  'campaigns.performance',
];

const BLOCKING_STATUSES = new Set(['error', 'unauthorized', 'forbidden', 'offline']);

const EMPTY_SUMMARY = {
  total:       0,
  active:      0,
  scheduled:   0,
  paused:      0,
  draft:       0,
  completed:   0,
  generatedAt: null,
};

const EMPTY_PERFORMANCE = {
  totalTracked: 0,
  byStatus:     {},
  activeBudget: 0,
  generatedAt:  null,
};

function statusFrom(resources) {
  if (resources.some((r) => r.status === 'unauthorized')) return 'unauthorized';
  if (resources.some((r) => r.status === 'forbidden')) return 'forbidden';
  if (resources.some((r) => r.status === 'offline')) return 'offline';
  if (resources.some((r) => r.status === 'error')) return 'error';
  if (resources.some((r) => r.status === 'stale' || r.isStale)) return 'stale';
  if (resources.some((r) => r.status === 'refreshing' || r.isRefreshing)) return 'refreshing';
  if (resources.some((r) => r.status === 'loading' || r.status === 'idle')) return 'loading';
  return 'success';
}

function sourceFrom(status, hasRealData) {
  if (BLOCKING_STATUSES.has(status)) return status;
  if (status === 'stale' || status === 'refreshing') return 'stale';
  if (!hasRealData) return 'empty';
  return 'real';
}

function firstError(resources) {
  const failed = resources.find((r) => r.error);
  return failed?.error?.message ?? null;
}

function CampaignsProvider({ children }) {
  const summaryRes    = useSyncResource('campaigns.summary');
  const listRes       = useSyncResource('campaigns.list');
  const activeRes     = useSyncResource('campaigns.active');
  const scheduledRes  = useSyncResource('campaigns.scheduled');
  const performanceRes = useSyncResource('campaigns.performance');

  const createMut   = useSyncMutation('campaigns.create');
  const updateMut   = useSyncMutation('campaigns.update');
  const pauseMut    = useSyncMutation('campaigns.pause');
  const activateMut = useSyncMutation('campaigns.activate');
  const deleteMut   = useSyncMutation('campaigns.delete');

  const resources = useMemo(
    () => [summaryRes, listRes, activeRes, scheduledRes, performanceRes],
    [summaryRes, listRes, activeRes, scheduledRes, performanceRes],
  );

  const refresh = useCallback(() => (
    Promise.all(RESOURCE_KEYS.map((key) => {
      const resource = {
        'campaigns.summary':     summaryRes,
        'campaigns.list':        listRes,
        'campaigns.active':      activeRes,
        'campaigns.scheduled':   scheduledRes,
        'campaigns.performance': performanceRes,
      }[key];
      return resource.refresh({ reason: 'campaigns.manual-refresh' });
    }))
  ), [activeRes, listRes, performanceRes, scheduledRes, summaryRes]);

  const value = useMemo(() => {
    const status = statusFrom(resources);
    const hasRealData = resources.some((r) => Boolean(r.data));
    const listData = listRes.data ?? {};

    return {
      campaigns: {
        summary:     summaryRes.data ?? EMPTY_SUMMARY,
        list:        listData.campaigns ?? [],
        total:       listData.total ?? 0,
        active:      activeRes.data?.campaigns ?? [],
        activeCount: activeRes.data?.count ?? 0,
        scheduled:   scheduledRes.data?.campaigns ?? [],
        scheduledCount: scheduledRes.data?.count ?? 0,
        performance: performanceRes.data ?? EMPTY_PERFORMANCE,
        generatedAt: summaryRes.data?.generatedAt ?? null,
      },
      loading:    status === 'loading',
      refreshing: status === 'refreshing',
      stale:      status === 'stale',
      status,
      error:      firstError(resources),
      source:     sourceFrom(status, hasRealData),
      refresh,
      createCampaign:   createMut.mutateAsync,
      updateCampaign:   updateMut.mutateAsync,
      pauseCampaign:    pauseMut.mutateAsync,
      activateCampaign: activateMut.mutateAsync,
      deleteCampaign:   deleteMut.mutateAsync,
      mutations: {
        createMut,
        updateMut,
        pauseMut,
        activateMut,
        deleteMut,
      },
    };
  }, [
    activeRes.data,
    createMut,
    deleteMut,
    activateMut,
    listRes.data,
    pauseMut,
    performanceRes.data,
    refresh,
    resources,
    scheduledRes.data,
    summaryRes.data,
    updateMut,
  ]);

  return (
    <CampaignsContext.Provider value={value}>
      {children}
    </CampaignsContext.Provider>
  );
}

export function useCampaigns() {
  const ctx = useContext(CampaignsContext);
  if (!ctx) throw new Error('[v4-painel] useCampaigns deve ser usado dentro de <CampaignsProvider>');
  return ctx;
}

export default memo(CampaignsProvider);
