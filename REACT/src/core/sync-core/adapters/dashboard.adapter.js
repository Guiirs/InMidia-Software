import {
  getDashboardActivity,
  getDashboardAlertsSummary,
  getDashboardKpis,
  getDashboardOverview,
  getDashboardPerformance,
} from '../../../services/dashboardV4Service.js';

const DASHBOARD_TTL_MS = 45_000;
const DASHBOARD_STALE_MS = 3 * 60_000;
const DASHBOARD_PERMISSIONS = ['dashboard.read'];
const DASHBOARD_FALLBACK_POLICY = 'keep-last-valid';

function dashboardResource({
  key,
  fetcher,
  dependencies = [],
  domainEvents = ['dashboard.updated'],
  realtimeEvents = ['dashboard.updated'],
  debugLabel,
}) {
  return {
    key,
    domain: 'dashboard',
    fetcher,
    ttlMs: DASHBOARD_TTL_MS,
    staleWhileRevalidate: DASHBOARD_STALE_MS,
    dependencies,
    dependents: [],
    domainEvents,
    realtimeEvents,
    permissions: DASHBOARD_PERMISSIONS,
    fallbackPolicy: DASHBOARD_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

export const dashboardAdapter = {
  domain: 'dashboard',
  domainEvents: [
    'dashboard.updated',
    'system.dashboard.invalidated',
    'inventory.board.updated',
    'inventory.board.availability.changed',
    'contracts.updated',
    'contracts.status.changed',
    'commercial.pipeline.updated',
    'commercial.proposal.converted',
    'alerts.updated',
    'alerts.created',
    'alerts.severity.changed',
    'reports.updated',
  ],
  permissions: DASHBOARD_PERMISSIONS,
  ttlMs: DASHBOARD_TTL_MS,
  fallbackPolicy: DASHBOARD_FALLBACK_POLICY,

  resources: [
    dashboardResource({
      key: 'dashboard.kpis',
      fetcher: getDashboardKpis,
      dependencies: ['inventory.summary', 'contracts.summary', 'commercial.pipeline'],
      domainEvents: ['dashboard.updated', 'inventory.board.updated', 'inventory.board.availability.changed', 'contracts.updated', 'contracts.status.changed', 'commercial.pipeline.updated', 'commercial.proposal.converted'],
      realtimeEvents: ['dashboard.updated', 'inventory.board.updated', 'inventory.board.availability.changed', 'contracts.updated', 'contracts.status.changed', 'commercial.pipeline.updated', 'commercial.proposal.converted'],
      debugLabel: 'Dashboard KPIs',
    }),
    dashboardResource({
      key: 'dashboard.overview',
      fetcher: getDashboardOverview,
      dependencies: ['inventory.summary', 'contracts.summary', 'commercial.pipeline', 'alerts.summary'],
      domainEvents: ['dashboard.updated', 'inventory.board.updated', 'inventory.board.availability.changed', 'contracts.updated', 'commercial.pipeline.updated', 'alerts.updated', 'alerts.created'],
      realtimeEvents: ['dashboard.updated', 'inventory.board.updated', 'inventory.board.availability.changed', 'contracts.updated', 'commercial.pipeline.updated', 'alerts.updated', 'alerts.created'],
      debugLabel: 'Dashboard overview',
    }),
    dashboardResource({
      key: 'dashboard.activity',
      fetcher: getDashboardActivity,
      dependencies: ['inventory.summary', 'contracts.summary', 'alerts.summary', 'operations.timeline'],
      domainEvents: ['dashboard.updated', 'inventory.board.updated', 'contracts.updated', 'alerts.updated', 'alerts.created', 'operations.event.created', 'operations.health.changed'],
      realtimeEvents: ['dashboard.updated', 'inventory.board.updated', 'contracts.updated', 'alerts.updated', 'alerts.created', 'operations.event.created', 'operations.health.changed'],
      debugLabel: 'Dashboard activity',
    }),
    dashboardResource({
      key: 'dashboard.performance',
      fetcher: getDashboardPerformance,
      dependencies: ['reports.summary'],
      domainEvents: ['dashboard.updated', 'reports.updated'],
      realtimeEvents: ['dashboard.updated', 'reports.updated'],
      debugLabel: 'Dashboard performance',
    }),
    dashboardResource({
      key: 'dashboard.alertsSummary',
      fetcher: getDashboardAlertsSummary,
      dependencies: ['alerts.summary'],
      domainEvents: ['dashboard.updated', 'alerts.updated', 'alerts.created', 'alerts.severity.changed'],
      realtimeEvents: ['dashboard.updated', 'alerts.updated', 'alerts.created', 'alerts.severity.changed'],
      debugLabel: 'Dashboard alerts summary',
    }),
  ],

  mutations: [],

  realtimeEvents: {
    'dashboard.updated':                  ['dashboard.kpis', 'dashboard.overview', 'dashboard.activity', 'dashboard.performance', 'dashboard.alertsSummary'],
    'system.dashboard.invalidated':       ['dashboard.kpis', 'dashboard.overview', 'dashboard.activity', 'dashboard.performance', 'dashboard.alertsSummary'],
    'inventory.board.updated':            ['dashboard.kpis'],
    'inventory.board.availability.changed':['dashboard.kpis'],
    'contracts.updated':                  ['dashboard.kpis', 'dashboard.activity'],
    'contracts.status.changed':           ['dashboard.kpis'],
    'commercial.pipeline.updated':        ['dashboard.kpis'],
    'commercial.proposal.converted':      ['dashboard.kpis'],
    'alerts.created':                     ['dashboard.alertsSummary', 'dashboard.activity'],
    'alerts.updated':                     ['dashboard.alertsSummary'],
    'alerts.severity.changed':            ['dashboard.alertsSummary'],
    'reports.updated':                    ['dashboard.performance'],
    'operations.event.created':           ['dashboard.activity'],
    'operations.health.changed':          ['dashboard.activity'],
  },
};
