import {
  cancelReportExport,
  createReportExport,
  createReportSchedule,
  deleteReportSchedule,
  getReportsAnalytics,
  getReportsByDomain,
  getReportsByPeriod,
  getReportsSummary,
  listReportExports,
  updateReportSchedule,
} from '../../../services/reportsV4Service.js';

const REPORTS_TTL_MS = 90_000;
const REPORTS_STALE_MS = 5 * 60_000;
const REPORTS_READ = ['reports.read'];
const REPORTS_FALLBACK_POLICY = 'keep-last-valid';

function getEntityId(payload = {}) {
  return payload.id ?? payload.exportId ?? payload.scheduleId ?? payload.realId;
}

function stableKey(item = {}) {
  return item.realId ?? item.id;
}

function reportsResource({
  key,
  fetcher,
  dependencies = [],
  dependents = [],
  domainEvents = ['reports.updated'],
  realtimeEvents = ['reports.updated'],
  debugLabel,
}) {
  return {
    key,
    domain: 'reports',
    fetcher,
    ttlMs: REPORTS_TTL_MS,
    staleWhileRevalidate: REPORTS_STALE_MS,
    dependencies,
    dependents,
    domainEvents,
    realtimeEvents,
    permissions: REPORTS_READ,
    fallbackPolicy: REPORTS_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

function upsertById(items = [], payload = {}) {
  const id = getEntityId(payload);
  if (!id) return items;
  const exists = items.some((item) => stableKey(item) === id);
  if (!exists) return [{ id, ...payload }, ...items];
  return items.map((item) => (stableKey(item) === id ? { ...item, ...payload } : item));
}

function cancelExport(items = [], payload = {}) {
  return upsertById(items, { ...payload, status: 'cancelled' });
}

function removeById(items = [], payload = {}) {
  const id = getEntityId(payload);
  return items.filter((item) => stableKey(item) !== id);
}

const reportInvalidations = [
  'reports.summary',
  'reports.analytics',
  'reports.exports',
  'reports.byPeriod',
  'reports.byDomain',
];

export const reportsAdapter = {
  domain: 'reports',
  domainEvents: [
    'reports.updated',
    'reports.export.created',
    'reports.export.completed',
    'commercial.proposal.converted',
    'contracts.updated',
    'inventory.board.updated',
    'inventory.board.availability.changed',
  ],
  permissions: REPORTS_READ,
  ttlMs: REPORTS_TTL_MS,
  fallbackPolicy: REPORTS_FALLBACK_POLICY,

  resources: [
    reportsResource({
      key: 'reports.summary',
      fetcher: getReportsSummary,
      dependencies: ['inventory.summary', 'contracts.summary', 'commercial.conversions', 'operations.summary'],
      dependents: ['dashboard.performance'],
      domainEvents: ['reports.updated', 'reports.export.completed', 'commercial.proposal.converted', 'contracts.updated', 'inventory.board.updated', 'inventory.board.availability.changed'],
      realtimeEvents: ['reports.updated', 'reports.export.completed', 'commercial.proposal.converted', 'contracts.updated', 'inventory.board.updated', 'inventory.board.availability.changed'],
      debugLabel: 'Reports summary',
    }),
    reportsResource({
      key: 'reports.analytics',
      fetcher: getReportsAnalytics,
      dependencies: ['reports.summary'],
      dependents: ['reports.byPeriod', 'reports.byDomain'],
      domainEvents: ['reports.updated'],
      realtimeEvents: ['reports.updated'],
      debugLabel: 'Reports analytics',
    }),
    reportsResource({
      key: 'reports.exports',
      fetcher: listReportExports,
      dependencies: ['reports.summary'],
      domainEvents: ['reports.export.created', 'reports.export.completed'],
      realtimeEvents: ['reports.export.created', 'reports.export.completed'],
      debugLabel: 'Reports exports',
    }),
    reportsResource({
      key: 'reports.byPeriod',
      fetcher: getReportsByPeriod,
      dependencies: ['reports.analytics'],
      domainEvents: ['reports.updated'],
      realtimeEvents: ['reports.updated'],
      debugLabel: 'Reports by period',
    }),
    reportsResource({
      key: 'reports.byDomain',
      fetcher: getReportsByDomain,
      dependencies: ['reports.summary', 'reports.analytics'],
      domainEvents: ['reports.updated', 'commercial.proposal.converted', 'contracts.updated', 'inventory.board.updated'],
      realtimeEvents: ['reports.updated', 'commercial.proposal.converted', 'contracts.updated', 'inventory.board.updated'],
      debugLabel: 'Reports by domain',
    }),
  ],

  mutations: [
    {
      key: 'reports.export.create',
      domain: 'reports',
      mutationFn: createReportExport,
      permissions: ['reports.export'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'reports.exports', updater: upsertById }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'reports.exports' }],
      invalidate: ['reports.exports'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'reports.export.create',
      debugLabel: 'Criar exportacao de relatorio',
    },
    {
      key: 'reports.export.cancel',
      domain: 'reports',
      mutationFn: (payload) => cancelReportExport(getEntityId(payload), payload),
      permissions: ['reports.export'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'reports.exports', updater: cancelExport }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'reports.exports' }],
      invalidate: ['reports.exports'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `reports.export:${getEntityId(payload)}`,
      debugLabel: 'Cancelar exportacao de relatorio',
    },
    {
      key: 'reports.schedule.create',
      domain: 'reports',
      mutationFn: createReportSchedule,
      permissions: ['reports.schedule'],
      requiresAuth: true,
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: reportInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'reports.schedule.create',
      debugLabel: 'Criar agenda de relatorio',
    },
    {
      key: 'reports.schedule.update',
      domain: 'reports',
      mutationFn: (payload) => updateReportSchedule(getEntityId(payload), payload),
      permissions: ['reports.schedule'],
      requiresAuth: true,
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: reportInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `reports.schedule:${getEntityId(payload)}`,
      debugLabel: 'Atualizar agenda de relatorio',
    },
    {
      key: 'reports.schedule.delete',
      domain: 'reports',
      mutationFn: (payload) => deleteReportSchedule(getEntityId(payload), payload),
      permissions: ['reports.schedule'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'reports.exports', updater: removeById }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: reportInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `reports.schedule:${getEntityId(payload)}`,
      debugLabel: 'Remover agenda de relatorio',
    },
  ],

  realtimeEvents: {
    'reports.updated':            ['reports.summary', 'reports.analytics', 'dashboard.performance'],
    'reports.export.created':     ['reports.exports'],
    'reports.export.completed':   ['reports.exports', 'reports.summary'],
    'commercial.proposal.converted': ['reports.summary'],
    'contracts.updated':          ['reports.summary'],
    'inventory.board.updated':    ['reports.summary'],
    'inventory.board.availability.changed': ['reports.summary'],
  },
};
