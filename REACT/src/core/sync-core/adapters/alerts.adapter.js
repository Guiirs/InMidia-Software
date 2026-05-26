import {
  createManualAlert,
  dismissAlert,
  getAlertsByDomain,
  getAlertsSummary,
  getCriticalAlerts,
  getUnreadAlerts,
  listAlerts,
  markAlertRead,
  markAllAlertsRead,
  resolveAlert,
} from '../../../services/alertsV4Service.js';

const ALERTS_TTL_MS = 45_000;
const ALERTS_STALE_MS = 3 * 60_000;
const ALERTS_READ = ['alerts.read'];
const ALERTS_FALLBACK_POLICY = 'keep-last-valid';

function getAlertId(payload = {}) {
  return payload.id ?? payload.alertId ?? payload.realId;
}

function getStableAlertKey(alert = {}) {
  return alert.realId ?? alert.id;
}

function alertsResource({
  key,
  fetcher,
  dependencies = [],
  dependents = [],
  domainEvents = ['alerts.updated'],
  realtimeEvents = ['alerts.updated'],
  debugLabel,
}) {
  return {
    key,
    domain: 'alerts',
    fetcher,
    ttlMs: ALERTS_TTL_MS,
    staleWhileRevalidate: ALERTS_STALE_MS,
    dependencies,
    dependents,
    domainEvents,
    realtimeEvents,
    permissions: ALERTS_READ,
    fallbackPolicy: ALERTS_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

function updateAlertInList(alerts = [], payload = {}) {
  const id = getAlertId(payload);
  if (!id) return alerts;
  return alerts.map((alert) => (
    getStableAlertKey(alert) === id ? { ...alert, ...payload } : alert
  ));
}

function markReadPatch(alerts = [], payload = {}) {
  return updateAlertInList(alerts, { ...payload, lido: true, read: true });
}

function markAllReadPatch(alerts = []) {
  return alerts.map((alert) => ({ ...alert, lido: true, read: true }));
}

function dismissPatch(alerts = [], payload = {}) {
  return updateAlertInList(alerts, { ...payload, lido: true, read: true, status: 'dismissed' });
}

function resolvePatch(alerts = [], payload = {}) {
  return updateAlertInList(alerts, { ...payload, lido: true, read: true, status: 'resolved' });
}

function prependAlert(alerts = [], payload = {}) {
  const id = getAlertId(payload) ?? `manual-${Date.now()}`;
  return [{ id, ...payload, lido: false, read: false, status: payload.status ?? 'open' }, ...alerts].slice(0, 100);
}

const alertInvalidations = [
  'alerts.list',
  'alerts.summary',
  'alerts.critical',
  'alerts.unread',
  'alerts.byDomain',
];

export const alertsAdapter = {
  domain: 'alerts',
  domainEvents: [
    'alerts.created',
    'alerts.updated',
    'alerts.resolved',
    'alerts.dismissed',
    'alerts.severity.changed',
    'inventory.board.updated',
    'inventory.board.availability.changed',
    'contracts.updated',
    'commercial.pipeline.updated',
    'operations.health.changed',
    'operations.inconsistency.detected',
  ],
  permissions: ALERTS_READ,
  ttlMs: ALERTS_TTL_MS,
  fallbackPolicy: ALERTS_FALLBACK_POLICY,

  resources: [
    alertsResource({
      key: 'alerts.list',
      fetcher: listAlerts,
      dependencies: ['inventory.summary', 'contracts.summary'],
      dependents: ['alerts.summary', 'alerts.critical', 'alerts.unread', 'alerts.byDomain'],
      domainEvents: ['alerts.created', 'alerts.updated', 'alerts.resolved', 'alerts.dismissed', 'alerts.severity.changed'],
      realtimeEvents: ['alerts.created', 'alerts.updated', 'alerts.resolved', 'alerts.dismissed', 'alerts.severity.changed'],
      debugLabel: 'Alerts list',
    }),
    alertsResource({
      key: 'alerts.summary',
      fetcher: getAlertsSummary,
      dependencies: ['alerts.list'],
      dependents: ['dashboard.alertsSummary', 'reports.summary'],
      domainEvents: ['alerts.created', 'alerts.updated', 'alerts.resolved', 'alerts.dismissed', 'alerts.severity.changed'],
      realtimeEvents: ['alerts.created', 'alerts.updated', 'alerts.resolved', 'alerts.dismissed', 'alerts.severity.changed'],
      debugLabel: 'Alerts summary',
    }),
    alertsResource({
      key: 'alerts.critical',
      fetcher: getCriticalAlerts,
      dependencies: ['alerts.list'],
      domainEvents: ['alerts.resolved', 'alerts.updated', 'alerts.severity.changed'],
      realtimeEvents: ['alerts.resolved', 'alerts.updated', 'alerts.severity.changed'],
      debugLabel: 'Critical alerts',
    }),
    alertsResource({
      key: 'alerts.unread',
      fetcher: getUnreadAlerts,
      dependencies: ['alerts.list'],
      domainEvents: ['alerts.created', 'alerts.dismissed', 'alerts.updated'],
      realtimeEvents: ['alerts.created', 'alerts.dismissed', 'alerts.updated'],
      debugLabel: 'Unread alerts',
    }),
    alertsResource({
      key: 'alerts.byDomain',
      fetcher: getAlertsByDomain,
      dependencies: ['alerts.list', 'inventory.summary', 'contracts.summary', 'commercial.pipeline', 'operations.timeline'],
      domainEvents: ['inventory.board.updated', 'inventory.board.availability.changed', 'contracts.updated', 'commercial.pipeline.updated', 'operations.health.changed', 'operations.inconsistency.detected', 'alerts.updated'],
      realtimeEvents: ['inventory.board.updated', 'inventory.board.availability.changed', 'contracts.updated', 'commercial.pipeline.updated', 'operations.health.changed', 'operations.inconsistency.detected'],
      debugLabel: 'Alerts by domain',
    }),
  ],

  mutations: [
    {
      key: 'alerts.markRead',
      domain: 'alerts',
      mutationFn: (payload) => markAlertRead(getAlertId(payload), payload),
      permissions: ['alerts.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'alerts.list', updater: markReadPatch }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'alerts.list' }],
      invalidate: ['alerts.summary', 'alerts.unread'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `alerts:${getAlertId(payload)}`,
      debugLabel: 'Marcar alerta como lido',
    },
    {
      key: 'alerts.markAllRead',
      domain: 'alerts',
      mutationFn: markAllAlertsRead,
      permissions: ['alerts.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'alerts.list', updater: markAllReadPatch }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: ['alerts.summary', 'alerts.unread'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'alerts.markAllRead',
      debugLabel: 'Marcar todos alertas como lidos',
    },
    {
      key: 'alerts.dismiss',
      domain: 'alerts',
      mutationFn: (payload) => dismissAlert(getAlertId(payload), payload),
      permissions: ['alerts.dismiss'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'alerts.list', updater: dismissPatch }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'alerts.list' }],
      invalidate: ['alerts.list', 'alerts.summary', 'alerts.unread'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `alerts:${getAlertId(payload)}`,
      debugLabel: 'Descartar alerta',
    },
    {
      key: 'alerts.resolve',
      domain: 'alerts',
      mutationFn: (payload) => resolveAlert(getAlertId(payload), payload),
      permissions: ['alerts.resolve'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'alerts.list', updater: resolvePatch }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'alerts.list' }],
      invalidate: ['alerts.list', 'alerts.summary', 'alerts.critical', 'dashboard.alertsSummary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `alerts:${getAlertId(payload)}`,
      debugLabel: 'Resolver alerta',
    },
    {
      key: 'alerts.createManual',
      domain: 'alerts',
      mutationFn: createManualAlert,
      permissions: ['alerts.create'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'alerts.list', updater: prependAlert }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'alerts.list' }],
      invalidate: alertInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'alerts.createManual',
      debugLabel: 'Criar alerta manual',
    },
  ],

  realtimeEvents: {
    'alerts.created':         ['alerts.list', 'alerts.summary', 'alerts.unread', 'dashboard.alertsSummary'],
    'alerts.updated':         ['alerts.list', 'alerts.summary', 'dashboard.alertsSummary'],
    'alerts.resolved':        ['alerts.list', 'alerts.summary', 'alerts.critical', 'dashboard.alertsSummary'],
    'alerts.dismissed':       ['alerts.list', 'alerts.summary', 'alerts.unread'],
    'alerts.severity.changed':['alerts.list', 'alerts.summary', 'alerts.critical', 'dashboard.alertsSummary'],
    'inventory.board.updated':             ['alerts.byDomain'],
    'inventory.board.availability.changed':['alerts.byDomain'],
    'contracts.updated':      ['alerts.byDomain'],
    'commercial.pipeline.updated':['alerts.byDomain'],
    'operations.health.changed':  ['alerts.byDomain'],
    'operations.inconsistency.detected': ['alerts.byDomain'],
  },
};
