import { getSystemReadiness } from '../../../services/systemReadinessService.js';

const SYSTEM_TTL_MS = 60_000;

export const systemAdapter = {
  domain: 'system',
  domainEvents: ['system.status.changed'],
  permissions: [],
  ttlMs: SYSTEM_TTL_MS,
  fallbackPolicy: 'none',
  resources: [
    {
      key: 'system.readiness',
      fetcher: getSystemReadiness,
      ttlMs: SYSTEM_TTL_MS,
      staleWhileRevalidate: 0,
      dependencies: [],
      dependents: [],
      domainEvents: ['system.status.changed'],
      realtimeEvents: [],
      permissions: [],
      fallbackPolicy: 'none',
      productionMockAllowed: false,
      debugLabel: 'System readiness',
      requiresTenant: false,
    },
  ],
  mutations: [],
  realtimeEvents: {
    'system.status.changed': ['system.readiness'],
  },
};
