import {
  assignOperationTask,
  cancelOperationTask,
  completeOperationTask,
  createOperationEvent,
  createOperationTask,
  getOperationsByDomain,
  getOperationsSummary,
  getOperationsTimeline,
  listOperationTasks,
  listPendingOperationTasks,
  startOperationTask,
  updateOperationTask,
} from '../../../services/operationsV4Service.js';

const OPERATIONS_TTL_MS = 45_000;
const OPERATIONS_STALE_MS = 3 * 60_000;
const OPERATIONS_READ = ['operations.read'];
const OPERATIONS_FALLBACK_POLICY = 'keep-last-valid';

function getEntityId(payload = {}) {
  return payload.id ?? payload.taskId ?? payload.eventId ?? payload.realId;
}

function stableKey(item = {}) {
  return item.realId ?? item.id;
}

function operationsResource({
  key,
  fetcher,
  dependencies = [],
  dependents = [],
  domainEvents = ['operations.task.updated'],
  realtimeEvents = ['operations.task.updated'],
  debugLabel,
}) {
  return {
    key,
    domain: 'operations',
    fetcher,
    ttlMs: OPERATIONS_TTL_MS,
    staleWhileRevalidate: OPERATIONS_STALE_MS,
    dependencies,
    dependents,
    domainEvents,
    realtimeEvents,
    permissions: OPERATIONS_READ,
    fallbackPolicy: OPERATIONS_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

function upsertTask(tasks = [], payload = {}) {
  const id = getEntityId(payload);
  if (!id) return tasks;
  const exists = tasks.some((task) => stableKey(task) === id);
  if (!exists) return [{ id, ...payload }, ...tasks];
  return tasks.map((task) => (stableKey(task) === id ? { ...task, ...payload } : task));
}

function completeTask(tasks = [], payload = {}) {
  return upsertTask(tasks, { ...payload, status: 'completed', completedAt: payload.completedAt ?? new Date().toISOString() });
}

function assignTask(tasks = [], payload = {}) {
  return upsertTask(tasks, { ...payload, owner: payload.owner ?? payload.assignee });
}

function startTask(tasks = [], payload = {}) {
  return upsertTask(tasks, { ...payload, status: 'IN_PROGRESS', startedAt: payload.startedAt ?? new Date().toISOString() });
}

function cancelTask(tasks = [], payload = {}) {
  return upsertTask(tasks, { ...payload, status: 'CANCELLED' });
}

function prependEvent(timeline = [], payload = {}) {
  const id = getEntityId(payload) ?? `event-${Date.now()}`;
  return [{ id, ...payload }, ...timeline].slice(0, 100);
}

const allOperationInvalidations = [
  'operations.timeline',
  'operations.summary',
  'operations.tasks',
  'operations.pending',
  'operations.byDomain',
];

export const operationsAdapter = {
  domain: 'operations',
  domainEvents: [
    'operations.task.created',
    'operations.task.updated',
    'operations.task.completed',
    'operations.event.created',
    'operations.health.changed',
    'operations.inconsistency.detected',
    'alerts.created',
  ],
  permissions: OPERATIONS_READ,
  ttlMs: OPERATIONS_TTL_MS,
  fallbackPolicy: OPERATIONS_FALLBACK_POLICY,

  resources: [
    operationsResource({
      key: 'operations.timeline',
      fetcher: getOperationsTimeline,
      dependencies: ['inventory.summary', 'alerts.summary'],
      dependents: ['operations.summary', 'operations.byDomain', 'dashboard.activity'],
      domainEvents: ['operations.event.created', 'operations.health.changed', 'operations.inconsistency.detected', 'alerts.created'],
      realtimeEvents: ['operations.event.created', 'operations.health.changed', 'operations.inconsistency.detected', 'alerts.created'],
      debugLabel: 'Operations timeline',
    }),
    operationsResource({
      key: 'operations.summary',
      fetcher: getOperationsSummary,
      dependencies: ['operations.timeline', 'alerts.summary'],
      dependents: ['dashboard.activity', 'reports.summary'],
      domainEvents: ['operations.task.created', 'operations.task.updated', 'operations.task.completed', 'operations.health.changed', 'alerts.created'],
      realtimeEvents: ['operations.task.created', 'operations.task.updated', 'operations.task.completed', 'operations.health.changed', 'alerts.created'],
      debugLabel: 'Operations summary',
    }),
    operationsResource({
      key: 'operations.tasks',
      fetcher: listOperationTasks,
      dependencies: ['operations.summary'],
      dependents: ['operations.pending', 'operations.summary'],
      domainEvents: ['operations.task.updated'],
      realtimeEvents: ['operations.task.updated'],
      debugLabel: 'Operations tasks',
    }),
    operationsResource({
      key: 'operations.pending',
      fetcher: listPendingOperationTasks,
      dependencies: ['operations.tasks'],
      dependents: ['operations.summary'],
      domainEvents: ['operations.task.updated'],
      realtimeEvents: ['operations.task.updated'],
      debugLabel: 'Pending operation tasks',
    }),
    operationsResource({
      key: 'operations.byDomain',
      fetcher: getOperationsByDomain,
      dependencies: ['operations.timeline', 'operations.tasks'],
      domainEvents: ['operations.updated', 'operations.event.created', 'operations.task.updated'],
      realtimeEvents: ['operations.updated', 'operations.event.created', 'operations.task.updated'],
      debugLabel: 'Operations by domain',
    }),
  ],

  mutations: [
    {
      key: 'operations.task.create',
      domain: 'operations',
      mutationFn: createOperationTask,
      permissions: ['operations.create'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'operations.tasks', updater: upsertTask }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'operations.tasks' }],
      invalidate: ['operations.tasks', 'operations.pending', 'operations.summary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'operations.task.create',
      debugLabel: 'Criar tarefa operacional',
    },
    {
      key: 'operations.task.update',
      domain: 'operations',
      mutationFn: (payload) => updateOperationTask(getEntityId(payload), payload),
      permissions: ['operations.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'operations.tasks', updater: upsertTask }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'operations.tasks' }],
      invalidate: ['operations.tasks', 'operations.pending', 'operations.summary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `operations.task:${getEntityId(payload)}`,
      debugLabel: 'Atualizar tarefa operacional',
    },
    {
      key: 'operations.task.complete',
      domain: 'operations',
      mutationFn: (payload) => completeOperationTask(getEntityId(payload), payload),
      permissions: ['operations.complete'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [
        { resourceKey: 'operations.tasks', updater: completeTask },
        { resourceKey: 'operations.pending', updater: (tasks = [], payload) => tasks.filter((task) => stableKey(task) !== getEntityId(payload)) },
      ],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'operations.tasks' }],
      invalidate: ['operations.tasks', 'operations.pending', 'operations.summary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `operations.task:${getEntityId(payload)}`,
      debugLabel: 'Concluir tarefa operacional',
    },
    {
      key: 'operations.task.assign',
      domain: 'operations',
      mutationFn: (payload) => assignOperationTask(getEntityId(payload), payload),
      permissions: ['operations.assign'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'operations.tasks', updater: assignTask }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'operations.tasks' }],
      invalidate: ['operations.tasks', 'operations.summary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `operations.task:${getEntityId(payload)}`,
      debugLabel: 'Atribuir tarefa operacional',
    },
    {
      key: 'operations.task.start',
      domain: 'operations',
      mutationFn: (payload) => startOperationTask(getEntityId(payload), payload),
      permissions: ['operations.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [
        { resourceKey: 'operations.tasks', updater: startTask },
        { resourceKey: 'operations.pending', updater: (tasks = [], payload) => tasks.filter((task) => stableKey(task) !== getEntityId(payload)) },
      ],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'operations.tasks' }],
      invalidate: ['operations.tasks', 'operations.pending', 'operations.summary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `operations.task:${getEntityId(payload)}`,
      debugLabel: 'Iniciar tarefa operacional',
    },
    {
      key: 'operations.task.cancel',
      domain: 'operations',
      mutationFn: (payload) => cancelOperationTask(getEntityId(payload), payload),
      permissions: ['operations.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [
        { resourceKey: 'operations.tasks', updater: cancelTask },
        { resourceKey: 'operations.pending', updater: (tasks = [], payload) => tasks.filter((task) => stableKey(task) !== getEntityId(payload)) },
      ],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'operations.tasks' }],
      invalidate: ['operations.tasks', 'operations.pending', 'operations.summary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `operations.task:${getEntityId(payload)}`,
      debugLabel: 'Cancelar tarefa operacional',
    },
    {
      key: 'operations.event.create',
      domain: 'operations',
      mutationFn: createOperationEvent,
      permissions: ['operations.create'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'operations.timeline', updater: prependEvent }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'operations.timeline' }],
      invalidate: allOperationInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'operations.event.create',
      debugLabel: 'Criar evento operacional',
    },
  ],

  realtimeEvents: {
    'operations.task.created':           ['operations.tasks', 'operations.pending', 'operations.summary'],
    'operations.task.updated':           ['operations.tasks', 'operations.pending', 'operations.summary'],
    'operations.task.started':           ['operations.tasks', 'operations.pending', 'operations.summary'],
    'operations.task.cancelled':         ['operations.tasks', 'operations.pending', 'operations.summary'],
    'operations.task.completed':         ['operations.tasks', 'operations.pending', 'operations.summary'],
    'operations.event.created':          ['operations.timeline', 'dashboard.activity'],
    'operations.health.changed':         ['operations.timeline', 'operations.summary', 'dashboard.activity'],
    'operations.inconsistency.detected': ['operations.timeline', 'operations.summary', 'alerts.byDomain'],
    'operations.summary.refreshed':      ['operations.summary', 'dashboard.activity'],
    'alerts.created':                    ['operations.timeline', 'operations.summary'],
  },
};
