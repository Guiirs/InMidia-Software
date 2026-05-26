import { activityAdapter }   from './activity.adapter.js';
import { alertsAdapter }     from './alerts.adapter.js';
import { campaignsAdapter }  from './campaigns.adapter.js';
import { commercialAdapter } from './commercial.adapter.js';
import { contractsAdapter }  from './contracts.adapter.js';
import { dashboardAdapter }  from './dashboard.adapter.js';
import { featuresAdapter }   from './features.adapter.js';
import { inventoryAdapter }  from './inventory.adapter.js';
import { operationsAdapter } from './operations.adapter.js';
import { reportsAdapter }    from './reports.adapter.js';
import { systemAdapter }     from './system.adapter.js';
import { getAuthSession }    from '../../../services/authV4Service.js';

export const authAdapter = {
  domain: 'auth',
  domainEvents: ['auth.session.updated', 'auth.profile.updated'],
  resources: [
    {
      key: 'users.session',
      fetcher: getAuthSession,
      ttlMs: 5 * 60_000,
      staleWhileRevalidate: 0,
      dependencies: [],
      dependents: ['auth.profile'],
      domainEvents: ['auth.session.updated'],
      permissions: [],
      fallbackPolicy: 'none',
      debugLabel: 'User session',
      requiresTenant: false,
    },
    {
      key: 'auth.profile',
      fetcher: getAuthSession,
      ttlMs: 5 * 60_000,
      staleWhileRevalidate: 0,
      dependencies: ['users.session'],
      dependents: [],
      domainEvents: ['auth.profile.updated'],
      permissions: [],
      fallbackPolicy: 'none',
      debugLabel: 'Auth profile',
      requiresTenant: false,
    },
  ],
  mutations: [],
  realtimeEvents: {},
};

export const syncDomainAdapters = [
  featuresAdapter,   // carrega primeiro — outros domínios podem depender das flags
  systemAdapter,
  inventoryAdapter,
  dashboardAdapter,
  contractsAdapter,
  commercialAdapter,
  alertsAdapter,
  reportsAdapter,
  operationsAdapter,
  activityAdapter,
  campaignsAdapter,
  authAdapter,
];

export function buildResourceRegistryFromAdapters(adapters = syncDomainAdapters) {
  return Object.fromEntries(adapters.flatMap((adapter) => (
    (adapter.resources ?? []).map((resource) => [
      resource.key,
      {
        domain: adapter.domain,
        ttlMs: adapter.ttlMs ?? 60_000,
        staleWhileRevalidate: resource.staleWhileRevalidate ?? 5 * 60_000,
        requiresAuth: true,
        requiresTenant: resource.requiresTenant ?? true,
        permissions: adapter.permissions ?? [],
        dependencies: adapter.dependencies ?? [],
        dependents: [],
        domainEvents: adapter.domainEvents ?? [],
        realtimeEvents: [],
        fallbackPolicy: adapter.fallbackPolicy ?? 'keep-last-good',
        productionMockAllowed: false,
        ...resource,
      },
    ])
  )));
}

export function buildMutationRegistryFromAdapters(adapters = syncDomainAdapters) {
  return Object.fromEntries(adapters.flatMap((adapter) => (
    (adapter.mutations ?? []).map((mutation) => [
      mutation.key,
      {
        domain: adapter.domain,
        permissions: adapter.permissions ?? [],
        requiresAuth: true,
        requiresTenant: true,
        rollbackPolicy: 'snapshot',
        reconcilePolicy: 'server-wins',
        conflictPolicy: 'server-wins',
        invalidateDependents: true,
        ...mutation,
      },
    ])
  )));
}

export function buildRealtimeMapFromAdapters(adapters = syncDomainAdapters) {
  return adapters.reduce((acc, adapter) => {
    Object.entries(adapter.realtimeEvents ?? {}).forEach(([eventType, resources]) => {
      acc[eventType] = Array.from(new Set([...(acc[eventType] ?? []), ...resources]));
    });
    return acc;
  }, {});
}
