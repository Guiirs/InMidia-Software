import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncMutation } from '../../core/sync-core/hooks/useSyncMutation.js';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';

const ReportsContext = createContext(null);

const RESOURCE_KEYS = [
  'reports.summary',
  'reports.analytics',
  'reports.exports',
  'reports.byPeriod',
  'reports.byDomain',
];

const BLOCKING_STATUSES = new Set(['error', 'unauthorized', 'forbidden', 'offline']);

function statusFrom(resources) {
  if (resources.some((resource) => resource.status === 'unauthorized')) return 'unauthorized';
  if (resources.some((resource) => resource.status === 'forbidden')) return 'forbidden';
  if (resources.some((resource) => resource.status === 'offline')) return 'offline';
  if (resources.some((resource) => resource.status === 'error')) return 'error';
  if (resources.some((resource) => resource.status === 'stale' || resource.isStale)) return 'stale';
  if (resources.some((resource) => resource.status === 'refreshing' || resource.isRefreshing)) return 'refreshing';
  if (resources.some((resource) => resource.status === 'loading' || resource.status === 'idle')) return 'loading';
  return 'success';
}

function sourceFrom(status, hasRealData) {
  if (BLOCKING_STATUSES.has(status)) return status;
  if (status === 'stale' || status === 'refreshing') return 'stale';
  if (!hasRealData) return import.meta.env.PROD ? 'error' : 'mock';
  return 'real';
}

function firstError(resources) {
  const failed = resources.find((resource) => resource.error);
  return failed?.error?.message ?? null;
}

function ReportsProvider({ children }) {
  const summary = useSyncResource('reports.summary');
  const analytics = useSyncResource('reports.analytics');
  const exportsResource = useSyncResource('reports.exports');
  const byPeriod = useSyncResource('reports.byPeriod');
  const byDomain = useSyncResource('reports.byDomain');

  const exportCreate = useSyncMutation('reports.export.create');
  const exportCancel = useSyncMutation('reports.export.cancel');
  const scheduleCreate = useSyncMutation('reports.schedule.create');
  const scheduleUpdate = useSyncMutation('reports.schedule.update');
  const scheduleDelete = useSyncMutation('reports.schedule.delete');

  const resources = useMemo(() => [summary, analytics, exportsResource, byPeriod, byDomain], [
    analytics,
    byDomain,
    byPeriod,
    exportsResource,
    summary,
  ]);

  const refresh = useCallback(() => (
    Promise.all(RESOURCE_KEYS.map((resourceKey) => {
      const resource = {
        'reports.summary': summary,
        'reports.analytics': analytics,
        'reports.exports': exportsResource,
        'reports.byPeriod': byPeriod,
        'reports.byDomain': byDomain,
      }[resourceKey];
      return resource.refresh({ reason: 'reports.manual-refresh' });
    }))
  ), [analytics, byDomain, byPeriod, exportsResource, summary]);

  const value = useMemo(() => {
    const status = statusFrom(resources);
    const hasRealData = resources.some((resource) => Boolean(resource.data));
    const analyticsData = analytics.data ?? {};
    const summaryData = summary.data ?? {};

    return {
      reports: {
        executiveReports: summaryData.executiveReports ?? [],
        performance: analyticsData.performance ?? null,
        revenue: analyticsData.revenue ?? null,
        regional: analyticsData.regional ?? null,
        occupancy: analyticsData.occupancy ?? null,
        exports: exportsResource.data ?? [],
        byPeriod: byPeriod.data ?? {},
        byDomain: byDomain.data ?? {},
        generatedAt: summaryData.generatedAt ?? null,
        source: sourceFrom(status, hasRealData),
      },
      loading: status === 'loading',
      refreshing: status === 'refreshing',
      stale: status === 'stale',
      status,
      error: firstError(resources),
      source: sourceFrom(status, hasRealData),
      refresh,
      createExport: exportCreate.mutateAsync,
      cancelExport: exportCancel.mutateAsync,
      createSchedule: scheduleCreate.mutateAsync,
      updateSchedule: scheduleUpdate.mutateAsync,
      deleteSchedule: scheduleDelete.mutateAsync,
      mutations: {
        exportCreate,
        exportCancel,
        scheduleCreate,
        scheduleUpdate,
        scheduleDelete,
      },
    };
  }, [
    analytics.data,
    byDomain.data,
    byPeriod.data,
    exportCancel,
    exportCreate,
    exportsResource.data,
    refresh,
    resources,
    scheduleCreate,
    scheduleDelete,
    scheduleUpdate,
    summary.data,
  ]);

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('[v4-painel] useReports deve ser usado dentro de <ReportsProvider>');
  return ctx;
}

export default memo(ReportsProvider);
