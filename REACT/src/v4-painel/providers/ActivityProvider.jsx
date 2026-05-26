import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';
import { createEmptyActivitySnapshot } from '../integration/adapters/activityAdapter.js';

const ActivityContext = createContext(null);

const RESOURCE_KEYS = [
  'activity.timeline',
  'activity.feed',
  'activity.audit',
  'activity.byDomain',
];

const BLOCKING_STATUSES = new Set(['error', 'unauthorized', 'forbidden', 'offline']);

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

function ActivityProvider({ children }) {
  const timeline = useSyncResource('activity.timeline');
  const feed = useSyncResource('activity.feed');
  const audit = useSyncResource('activity.audit');
  const byDomain = useSyncResource('activity.byDomain');

  const resources = useMemo(
    () => [timeline, feed, audit, byDomain],
    [audit, byDomain, feed, timeline],
  );

  const refresh = useCallback(() => (
    Promise.all(RESOURCE_KEYS.map((key) => {
      const resource = {
        'activity.timeline': timeline,
        'activity.feed':     feed,
        'activity.audit':    audit,
        'activity.byDomain': byDomain,
      }[key];
      return resource.refresh({ reason: 'activity.manual-refresh' });
    }))
  ), [audit, byDomain, feed, timeline]);

  const value = useMemo(() => {
    const empty = createEmptyActivitySnapshot();
    const status = statusFrom(resources);
    const hasRealData = resources.some((r) => Boolean(r.data));
    const timelineData = timeline.data ?? {};
    const auditData = audit.data ?? {};

    return {
      activity: {
        ...empty,
        timeline: timelineData.events ?? empty.timeline,
        timelineCursor: timelineData.cursor ?? null,
        feed: Array.isArray(feed.data) ? feed.data : empty.feed,
        audit: auditData.entries ?? empty.audit,
        auditTotal: auditData.total ?? 0,
        byDomain: byDomain.data ?? empty.byDomain,
        generatedAt: timelineData.generatedAt ?? auditData.generatedAt ?? null,
      },
      loading: status === 'loading',
      refreshing: status === 'refreshing',
      stale: status === 'stale',
      status,
      error: firstError(resources),
      source: sourceFrom(status, hasRealData),
      refresh,
    };
  }, [
    audit.data,
    byDomain.data,
    feed.data,
    refresh,
    resources,
    timeline.data,
  ]);

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('[v4-painel] useActivity deve ser usado dentro de <ActivityProvider>');
  return ctx;
}

export default memo(ActivityProvider);
