import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncMutation } from '../../core/sync-core/hooks/useSyncMutation.js';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';

const OperationsContext = createContext(null);

const RESOURCE_KEYS = [
  'operations.timeline',
  'operations.summary',
  'operations.tasks',
  'operations.pending',
  'operations.byDomain',
];

const BLOCKING_STATUSES = new Set(['error', 'unauthorized', 'forbidden', 'offline']);

const EMPTY_SYNC = {
  estado: 'healthy',
  modo: '—',
  intervalo: '—',
  ultimaSyncLabel: '—',
  proximaSync: '—',
  totalPontos: 0,
  pontosAtualizados: 0,
  divergencias: 0,
  regioesSincronizadas: 0,
  regioesPendentes: 0,
  detalhes: [],
};

const EMPTY_OVERVIEW = {
  totalPontos: 0,
  pontosAtivos: 0,
  pontosDisponiveis: 0,
  emManutencao: 0,
  reservados: 0,
  ocupacaoGlobal: 0,
  receitaAtiva: 0,
  alertasRegionais: 0,
  sincronizacao: 'healthy',
  ultimaAtualizacao: '—',
};

const EMPTY_HEALTH = {
  status: 'operational',
  score: 100,
  pendingCount: 0,
  completedToday: 0,
  warningCount: 0,
  criticalCount: 0,
  affectedAreas: [],
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

function OperationsProvider({ children }) {
  const timeline = useSyncResource('operations.timeline');
  const summary = useSyncResource('operations.summary');
  const tasks = useSyncResource('operations.tasks');
  const pending = useSyncResource('operations.pending');
  const byDomain = useSyncResource('operations.byDomain');

  const taskCreate = useSyncMutation('operations.task.create');
  const taskUpdate = useSyncMutation('operations.task.update');
  const taskStart = useSyncMutation('operations.task.start');
  const taskComplete = useSyncMutation('operations.task.complete');
  const taskCancel = useSyncMutation('operations.task.cancel');
  const taskAssign = useSyncMutation('operations.task.assign');
  const eventCreate = useSyncMutation('operations.event.create');

  const resources = useMemo(() => [timeline, summary, tasks, pending, byDomain], [
    byDomain, pending, summary, tasks, timeline,
  ]);

  const refresh = useCallback(() => (
    Promise.all(RESOURCE_KEYS.map((resourceKey) => {
      const resource = {
        'operations.timeline': timeline,
        'operations.summary': summary,
        'operations.tasks': tasks,
        'operations.pending': pending,
        'operations.byDomain': byDomain,
      }[resourceKey];
      return resource.refresh({ reason: 'operations.manual-refresh' });
    }))
  ), [byDomain, pending, summary, tasks, timeline]);

  const value = useMemo(() => {
    const status = statusFrom(resources);
    const hasRealData = resources.some((resource) => Boolean(resource.data));
    const summaryData = summary.data ?? {};

    const health = summaryData.healthDetail ?? {
      status: summaryData.health ?? 'operational',
      score: typeof summaryData.health === 'string' && summaryData.health === 'attention' ? 60 : 100,
      pendingCount: summaryData.pendingCount ?? 0,
      completedToday: summaryData.completedToday ?? 0,
      warningCount: 0,
      criticalCount: 0,
      affectedAreas: [],
    };
    const sla = summaryData.sla ?? {
      overdueOperations: 0,
      dueSoonOperations: 0,
      resolvedOperations: 0,
      averageResolutionMinutes: null,
      criticalBacklog: 0,
      highPriorityBacklog: 0,
      operationsSlaHealth: 'HEALTHY',
      backlogByPriority: { critical: 0, high: 0, medium: 0, low: 0 },
    };

    const overview = {
      ...EMPTY_OVERVIEW,
      sincronizacao: health.status === 'attention' ? 'warning' : 'healthy',
      ultimaAtualizacao: summaryData.generatedAt ? 'agora' : '—',
    };

    return {
      operations: {
        overview,
        health: { ...health, sla },
        sla,
        modules: [],
        sync: { ...EMPTY_SYNC },
        regionalOperations: [],
        feed: timeline.data ?? [],
        tasks: tasks.data ?? [],
        pending: pending.data ?? [],
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
      createTask: taskCreate.mutateAsync,
      updateTask: taskUpdate.mutateAsync,
      startTask: taskStart.mutateAsync,
      completeTask: taskComplete.mutateAsync,
      cancelTask: taskCancel.mutateAsync,
      assignTask: taskAssign.mutateAsync,
      createEvent: eventCreate.mutateAsync,
      mutations: {
        taskCreate,
        taskUpdate,
        taskStart,
        taskComplete,
        taskCancel,
        taskAssign,
        eventCreate,
      },
    };
  }, [
    byDomain.data,
    eventCreate,
    pending.data,
    refresh,
    resources,
    summary.data,
    taskAssign,
    taskCancel,
    taskComplete,
    taskCreate,
    taskStart,
    taskUpdate,
    tasks.data,
    timeline.data,
  ]);

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations() {
  const ctx = useContext(OperationsContext);
  if (!ctx) throw new Error('[v4-painel] useOperations deve ser usado dentro de <OperationsProvider>');
  return ctx;
}

export default memo(OperationsProvider);
