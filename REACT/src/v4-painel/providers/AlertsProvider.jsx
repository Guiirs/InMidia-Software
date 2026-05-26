import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncMutation } from '../../core/sync-core/hooks/useSyncMutation.js';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';

const AlertsContext = createContext(null);

const RESOURCE_KEYS = [
  'alerts.list',
  'alerts.summary',
  'alerts.critical',
  'alerts.unread',
  'alerts.byDomain',
];

const BLOCKING_STATUSES = new Set(['error', 'unauthorized', 'forbidden', 'offline']);

const EMPTY_TOTALS = { open: 0, critical: 0, warning: 0, info: 0, resolved: 0, dismissed: 0 };

const EMPTY_SEVERITY_OVERVIEW = {
  critical: { count: 0, cor: 'var(--v4p-danger)',  label: 'Critico' },
  high:     { count: 0, cor: 'var(--v4p-warning)', label: 'Alto' },
  medium:   { count: 0, cor: 'var(--v4p-warning)', label: 'Medio' },
  low:      { count: 0, cor: 'var(--v4p-text-4)',  label: 'Baixo' },
  info:     { count: 0, cor: 'var(--v4p-info)',    label: 'Informativo' },
};

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

function buildTimeline(alerts = []) {
  return alerts.slice(0, 10).map((alert) => ({
    id: alert.id,
    tempo: 'agora',
    evento: alert.title ?? alert.titulo ?? alert.message ?? '—',
    tipo: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info',
  }));
}

function buildRecommendations(alerts = []) {
  return alerts.slice(0, 4).map((alert) => ({
    id: `rec-${alert.id}`,
    icone: alert.severity === 'critical' ? 'crisis_alert' : 'task_alt',
    titulo: alert.recommendation ?? alert.acao ?? alert.title ?? alert.titulo ?? '—',
    descricao: alert.description ?? alert.descricao ?? '—',
    prazo: alert.sla ?? 'Hoje',
    cor: alert.severity === 'critical' ? 'var(--v4p-danger)'
       : alert.severity === 'warning' ? 'var(--v4p-warning)'
       : 'var(--v4p-info)',
  }));
}

function AlertsProvider({ children }) {
  const list = useSyncResource('alerts.list');
  const summary = useSyncResource('alerts.summary');
  const critical = useSyncResource('alerts.critical');
  const unread = useSyncResource('alerts.unread');
  const byDomain = useSyncResource('alerts.byDomain');

  const markReadMutation = useSyncMutation('alerts.markRead');
  const markAllReadMutation = useSyncMutation('alerts.markAllRead');
  const dismissMutation = useSyncMutation('alerts.dismiss');
  const resolveMutation = useSyncMutation('alerts.resolve');
  const createManualMutation = useSyncMutation('alerts.createManual');

  const resources = useMemo(() => [list, summary, critical, unread, byDomain], [
    byDomain,
    critical,
    list,
    summary,
    unread,
  ]);

  const refresh = useCallback(() => (
    Promise.all(RESOURCE_KEYS.map((resourceKey) => {
      const resource = {
        'alerts.list': list,
        'alerts.summary': summary,
        'alerts.critical': critical,
        'alerts.unread': unread,
        'alerts.byDomain': byDomain,
      }[resourceKey];
      return resource.refresh({ reason: 'alerts.manual-refresh' });
    }))
  ), [byDomain, critical, list, summary, unread]);

  const dismissAlert = useCallback((id) => dismissMutation.mutateAsync({ id }), [dismissMutation]);
  const dismissAll = useCallback(() => markAllReadMutation.mutateAsync({}), [markAllReadMutation]);

  const value = useMemo(() => {
    const status = statusFrom(resources);
    const hasRealData = resources.some((resource) => Boolean(resource.data));
    const summaryData = summary.data ?? {};
    const alertsList = list.data ?? [];

    return {
      alerts: {
        alerts: alertsList,
        totals: summaryData.totals ?? EMPTY_TOTALS,
        severityOverview: summaryData.severityOverview ?? EMPTY_SEVERITY_OVERVIEW,
        recommendations: buildRecommendations(alertsList),
        timeline: buildTimeline(alertsList),
        critical: critical.data ?? [],
        unread: unread.data ?? [],
        byDomain: byDomain.data ?? {},
        generatedAt: summaryData.generatedAt ?? null,
      },
      loading: status === 'loading',
      refreshing: status === 'refreshing',
      stale: status === 'stale',
      status,
      error: firstError(resources),
      source: sourceFrom(status, hasRealData),
      refresh,
      markRead: markReadMutation.mutateAsync,
      dismissAlert,
      dismissAll,
      resolveAlert: resolveMutation.mutateAsync,
      createManualAlert: createManualMutation.mutateAsync,
      mutations: {
        markRead: markReadMutation,
        markAllRead: markAllReadMutation,
        dismiss: dismissMutation,
        resolve: resolveMutation,
        createManual: createManualMutation,
      },
    };
  }, [
    byDomain.data,
    createManualMutation,
    critical.data,
    dismissAlert,
    dismissAll,
    dismissMutation,
    list.data,
    markAllReadMutation,
    markReadMutation,
    refresh,
    resolveMutation,
    resources,
    summary.data,
    unread.data,
  ]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('[v4-painel] useAlerts deve ser usado dentro de <AlertsProvider>');
  return ctx;
}

export default memo(AlertsProvider);
