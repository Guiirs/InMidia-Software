import {
  cancelContract,
  changeContractStatus,
  createContract,
  getActiveContracts,
  getContractsSummary,
  getContractsTimeline,
  getExpiringContracts,
  listContracts,
  renewContract,
  updateContract,
} from '../../../services/contractsV4Service.js';

const CONTRACTS_TTL_MS = 60_000;
const CONTRACTS_STALE_MS = 5 * 60_000;
const CONTRACTS_READ = ['contracts.read'];
const CONTRACTS_FALLBACK_POLICY = 'keep-last-valid';

function getContractId(payload = {}) {
  return payload.id ?? payload.realId ?? payload.contractId;
}

function getStableContractKey(contract = {}) {
  return contract.realId ?? contract.id ?? contract.code;
}

function contractsResource({
  key,
  fetcher,
  dependencies = [],
  dependents = [],
  domainEvents = ['contracts.updated'],
  realtimeEvents = ['contracts.updated'],
  debugLabel,
}) {
  return {
    key,
    domain: 'contracts',
    fetcher,
    ttlMs: CONTRACTS_TTL_MS,
    staleWhileRevalidate: CONTRACTS_STALE_MS,
    dependencies,
    dependents,
    domainEvents,
    realtimeEvents,
    permissions: CONTRACTS_READ,
    fallbackPolicy: CONTRACTS_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

function updateContractInList(contracts = [], payload = {}) {
  const id = getContractId(payload);
  return contracts.map((contract) => (
    getStableContractKey(contract) === id ? { ...contract, ...payload } : contract
  ));
}

function removeContractFromActive(contracts = [], payload = {}) {
  const id = getContractId(payload);
  return contracts.filter((contract) => getStableContractKey(contract) !== id);
}

const contractInvalidations = [
  'contracts.list',
  'contracts.summary',
  'contracts.active',
  'contracts.expiring',
  'contracts.timeline',
];

export const contractsAdapter = {
  domain: 'contracts',
  domainEvents: [
    'contracts.created',
    'contracts.updated',
    'contracts.status.changed',
    'contracts.cancelled',
    'contracts.renewed',
    'contracts.expiring',
  ],
  permissions: CONTRACTS_READ,
  ttlMs: CONTRACTS_TTL_MS,
  fallbackPolicy: CONTRACTS_FALLBACK_POLICY,

  resources: [
    contractsResource({
      key: 'contracts.summary',
      fetcher: () => getContractsSummary(),
      dependencies: ['contracts.list'],
      dependents: ['dashboard.kpis', 'commercial.pipeline', 'alerts.list', 'reports.summary'],
      domainEvents: ['contracts.created', 'contracts.updated', 'contracts.status.changed', 'contracts.cancelled', 'contracts.renewed', 'contracts.expiring'],
      realtimeEvents: ['contracts.created', 'contracts.updated', 'contracts.status.changed', 'contracts.cancelled', 'contracts.renewed', 'contracts.expiring'],
      debugLabel: 'Contracts summary',
    }),
    contractsResource({
      key: 'contracts.list',
      fetcher: () => listContracts({ limit: 200 }),
      dependencies: [],
      dependents: ['contracts.summary', 'contracts.active', 'contracts.expiring', 'contracts.timeline'],
      domainEvents: ['contracts.created', 'contracts.updated', 'contracts.cancelled', 'contracts.renewed'],
      realtimeEvents: ['contracts.created', 'contracts.updated', 'contracts.cancelled', 'contracts.renewed'],
      debugLabel: 'Contracts list',
    }),
    contractsResource({
      key: 'contracts.active',
      fetcher: () => getActiveContracts({ limit: 200 }),
      dependencies: ['contracts.list'],
      domainEvents: ['contracts.status.changed', 'contracts.cancelled', 'contracts.renewed'],
      realtimeEvents: ['contracts.status.changed', 'contracts.cancelled', 'contracts.renewed'],
      debugLabel: 'Active contracts',
    }),
    contractsResource({
      key: 'contracts.expiring',
      fetcher: () => getExpiringContracts({ days: 30, limit: 200 }),
      dependencies: ['contracts.list'],
      domainEvents: ['contracts.updated', 'contracts.renewed', 'contracts.expiring'],
      realtimeEvents: ['contracts.updated', 'contracts.renewed', 'contracts.expiring'],
      debugLabel: 'Expiring contracts',
    }),
    contractsResource({
      key: 'contracts.timeline',
      fetcher: () => getContractsTimeline({ limit: 100 }),
      dependencies: ['contracts.list'],
      domainEvents: ['contracts.created', 'contracts.updated', 'contracts.status.changed', 'contracts.cancelled', 'contracts.renewed'],
      realtimeEvents: ['contracts.created', 'contracts.updated', 'contracts.status.changed', 'contracts.cancelled', 'contracts.renewed'],
      debugLabel: 'Contracts timeline',
    }),
  ],

  mutations: [
    {
      key: 'contracts.create',
      domain: 'contracts',
      mutationFn: createContract,
      permissions: ['contracts.create'],
      requiresAuth: true,
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: contractInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'contracts.create',
      debugLabel: 'Criar contrato',
    },
    {
      key: 'contracts.update',
      domain: 'contracts',
      mutationFn: (payload) => updateContract(getContractId(payload), payload),
      permissions: ['contracts.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{
        resourceKey: 'contracts.list',
        updater: updateContractInList,
      }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'contracts.list' }],
      invalidate: contractInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `contracts:${getContractId(payload)}`,
      debugLabel: 'Atualizar contrato',
    },
    {
      key: 'contracts.status.change',
      domain: 'contracts',
      mutationFn: (payload) => changeContractStatus(getContractId(payload), payload.status),
      permissions: ['contracts.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{
        resourceKey: 'contracts.list',
        updater: updateContractInList,
      }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'contracts.list' }],
      invalidate: contractInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `contracts:${getContractId(payload)}`,
      debugLabel: 'Alterar status do contrato',
    },
    {
      key: 'contracts.cancel',
      domain: 'contracts',
      mutationFn: (payload) => cancelContract(getContractId(payload), payload),
      permissions: ['contracts.cancel'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [
        {
          resourceKey: 'contracts.list',
          updater: (contracts, payload) => updateContractInList(contracts, { ...payload, status: 'paused', operationalStatus: 'cancelled' }),
        },
        {
          resourceKey: 'contracts.active',
          updater: removeContractFromActive,
        },
      ],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'contracts.list' }],
      invalidate: contractInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `contracts:${getContractId(payload)}`,
      debugLabel: 'Cancelar contrato',
    },
    {
      key: 'contracts.renew',
      domain: 'contracts',
      mutationFn: (payload) => renewContract(getContractId(payload), payload),
      permissions: ['contracts.renew'],
      requiresAuth: true,
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: contractInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `contracts:${getContractId(payload)}`,
      debugLabel: 'Renovar contrato',
    },
  ],

  realtimeEvents: {
    'contracts.created':       [...contractInvalidations, 'dashboard.kpis', 'commercial.pipeline'],
    'contracts.updated':       [...contractInvalidations, 'dashboard.kpis', 'commercial.pipeline'],
    'contracts.status.changed':[...contractInvalidations, 'dashboard.kpis', 'commercial.pipeline'],
    'contracts.cancelled':     [...contractInvalidations, 'dashboard.kpis', 'commercial.pipeline'],
    'contracts.renewed':       [...contractInvalidations, 'dashboard.kpis', 'commercial.pipeline'],
    'contracts.expiring':      ['contracts.expiring', 'contracts.summary', 'contracts.timeline', 'alerts.list', 'dashboard.kpis'],
  },
};
