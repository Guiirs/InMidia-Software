import {
  getActivityTimeline,
  getActivityFeed,
  getActivityAudit,
  getActivityByDomain,
} from '../../../services/activityV4Service.js';

const ACTIVITY_TTL_MS = 60_000;
const ACTIVITY_STALE_MS = 5 * 60_000;
const ACTIVITY_READ = ['activity.read'];
const ACTIVITY_FALLBACK_POLICY = 'keep-last-valid';

function activityResource({
  key,
  fetcher,
  dependencies = [],
  dependents = [],
  domainEvents = [],
  realtimeEvents = [],
  debugLabel,
}) {
  return {
    key,
    domain: 'activity',
    fetcher,
    ttlMs: ACTIVITY_TTL_MS,
    staleWhileRevalidate: ACTIVITY_STALE_MS,
    dependencies,
    dependents,
    domainEvents,
    realtimeEvents,
    permissions: ACTIVITY_READ,
    fallbackPolicy: ACTIVITY_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

const ALL_ACTIVITY_INVALIDATIONS = [
  'activity.timeline',
  'activity.feed',
  'activity.audit',
  'activity.byDomain',
];

const CROSS_DOMAIN_EVENTS = [
  'contracts.created',
  'contracts.updated',
  'contracts.status.changed',
  'commercial.activity.created',
  'commercial.opportunity.created',
  'commercial.proposal.converted',
  'operations.event.created',
  'operations.task.created',
  'operations.task.completed',
  'alerts.created',
  'alerts.resolved',
  'reports.updated',
  'reports.export.completed',
  'activity.audit.created',
];

export const activityAdapter = {
  domain: 'activity',
  domainEvents: CROSS_DOMAIN_EVENTS,
  permissions: ACTIVITY_READ,
  ttlMs: ACTIVITY_TTL_MS,
  fallbackPolicy: ACTIVITY_FALLBACK_POLICY,

  resources: [
    activityResource({
      key: 'activity.timeline',
      fetcher: getActivityTimeline,
      dependencies: [
        'commercial.activities',
        'operations.timeline',
      ],
      dependents: ['dashboard.activity'],
      domainEvents: CROSS_DOMAIN_EVENTS,
      realtimeEvents: CROSS_DOMAIN_EVENTS,
      debugLabel: 'Activity global timeline',
    }),
    activityResource({
      key: 'activity.feed',
      fetcher: getActivityFeed,
      dependencies: ['activity.timeline'],
      dependents: [],
      domainEvents: ['activity.audit.created', 'operations.event.created', 'commercial.activity.created'],
      realtimeEvents: ['activity.audit.created', 'operations.event.created', 'commercial.activity.created'],
      debugLabel: 'Activity operational feed',
    }),
    activityResource({
      key: 'activity.audit',
      fetcher: getActivityAudit,
      dependencies: [],
      dependents: [],
      domainEvents: ['activity.audit.created', 'contracts.status.changed', 'commercial.proposal.converted'],
      realtimeEvents: ['activity.audit.created', 'contracts.status.changed', 'commercial.proposal.converted'],
      debugLabel: 'Activity audit log',
    }),
    activityResource({
      key: 'activity.byDomain',
      fetcher: getActivityByDomain,
      dependencies: ['activity.timeline'],
      dependents: [],
      domainEvents: CROSS_DOMAIN_EVENTS,
      realtimeEvents: CROSS_DOMAIN_EVENTS,
      debugLabel: 'Activity by domain',
    }),
  ],

  mutations: [],

  realtimeEvents: Object.fromEntries(
    CROSS_DOMAIN_EVENTS.map((event) => [event, ALL_ACTIVITY_INVALIDATIONS]),
  ),
};
