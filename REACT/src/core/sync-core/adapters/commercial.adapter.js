import {
  changeOpportunityStage,
  convertProposal,
  createCommercialActivity,
  createOpportunity,
  createProposal,
  getCommercialConversions,
  getCommercialPipeline,
  listCommercialActivities,
  listCommercialOpportunities,
  listCommercialProposals,
  updateOpportunity,
  updateProposal,
} from '../../../services/commercialV4Service.js';

const COMMERCIAL_TTL_MS = 60_000;
const COMMERCIAL_STALE_MS = 5 * 60_000;
const COMMERCIAL_READ = ['commercial.read'];
const COMMERCIAL_FALLBACK_POLICY = 'keep-last-valid';

function getEntityId(payload = {}) {
  return payload.id ?? payload.realId ?? payload.opportunityId ?? payload.proposalId ?? payload.activityId;
}

function stableKey(item = {}) {
  return item.id ?? item.realId ?? item.code;
}

function commercialResource({
  key,
  fetcher,
  dependencies = [],
  dependents = [],
  domainEvents = ['commercial.pipeline.updated'],
  realtimeEvents = ['commercial.pipeline.updated'],
  debugLabel,
}) {
  return {
    key,
    domain: 'commercial',
    fetcher,
    ttlMs: COMMERCIAL_TTL_MS,
    staleWhileRevalidate: COMMERCIAL_STALE_MS,
    dependencies,
    dependents,
    domainEvents,
    realtimeEvents,
    permissions: COMMERCIAL_READ,
    fallbackPolicy: COMMERCIAL_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

function upsertById(list = [], payload = {}) {
  const id = getEntityId(payload);
  if (!id) return list;
  const exists = list.some((item) => stableKey(item) === id);
  if (!exists) return [{ id, ...payload }, ...list];
  return list.map((item) => (stableKey(item) === id ? { ...item, ...payload } : item));
}

function stagePatch(list = [], payload = {}) {
  return upsertById(list, { ...payload, status: payload.stage ?? payload.status });
}

const commercialInvalidations = [
  'commercial.pipeline',
  'commercial.opportunities',
  'commercial.proposals',
  'commercial.conversions',
  'commercial.activities',
];

export const commercialAdapter = {
  domain: 'commercial',
  domainEvents: [
    'commercial.pipeline.updated',
    'commercial.opportunity.created',
    'commercial.opportunity.updated',
    'commercial.opportunity.stage.changed',
    'commercial.proposal.created',
    'commercial.proposal.updated',
    'commercial.proposal.converted',
    'commercial.activity.created',
    'commercial.region.critical',
    'commercial.occupancy.low',
    'contracts.updated',
    'contracts.status.changed',
  ],
  permissions: COMMERCIAL_READ,
  ttlMs: COMMERCIAL_TTL_MS,
  fallbackPolicy: COMMERCIAL_FALLBACK_POLICY,

  resources: [
    commercialResource({
      key: 'commercial.pipeline',
      fetcher: getCommercialPipeline,
      dependencies: ['contracts.summary'],
      dependents: ['dashboard.kpis', 'reports.summary'],
      domainEvents: ['commercial.pipeline.updated', 'contracts.updated', 'contracts.status.changed', 'commercial.opportunity.stage.changed', 'commercial.proposal.converted'],
      realtimeEvents: ['commercial.pipeline.updated', 'contracts.updated', 'contracts.status.changed', 'commercial.opportunity.stage.changed', 'commercial.proposal.converted'],
      debugLabel: 'Commercial pipeline',
    }),
    commercialResource({
      key: 'commercial.opportunities',
      fetcher: listCommercialOpportunities,
      dependencies: ['commercial.pipeline'],
      dependents: ['commercial.pipeline'],
      domainEvents: ['commercial.opportunity.created', 'commercial.opportunity.updated'],
      realtimeEvents: ['commercial.opportunity.created', 'commercial.opportunity.updated'],
      debugLabel: 'Commercial opportunities',
    }),
    commercialResource({
      key: 'commercial.proposals',
      fetcher: listCommercialProposals,
      dependencies: ['commercial.opportunities'],
      dependents: ['commercial.pipeline'],
      domainEvents: ['commercial.proposal.created', 'commercial.proposal.updated', 'commercial.proposal.converted'],
      realtimeEvents: ['commercial.proposal.created', 'commercial.proposal.updated', 'commercial.proposal.converted'],
      debugLabel: 'Commercial proposals',
    }),
    commercialResource({
      key: 'commercial.conversions',
      fetcher: getCommercialConversions,
      dependencies: ['commercial.pipeline', 'contracts.summary'],
      dependents: ['reports.summary', 'dashboard.kpis'],
      domainEvents: ['commercial.proposal.converted', 'commercial.pipeline.updated'],
      realtimeEvents: ['commercial.proposal.converted', 'commercial.pipeline.updated'],
      debugLabel: 'Commercial conversions',
    }),
    commercialResource({
      key: 'commercial.activities',
      fetcher: listCommercialActivities,
      dependencies: ['commercial.pipeline'],
      dependents: ['commercial.pipeline'],
      domainEvents: ['commercial.activity.created', 'commercial.pipeline.updated'],
      realtimeEvents: ['commercial.activity.created', 'commercial.pipeline.updated'],
      debugLabel: 'Commercial activities',
    }),
  ],

  mutations: [
    {
      key: 'commercial.opportunity.create',
      domain: 'commercial',
      mutationFn: createOpportunity,
      permissions: ['commercial.create'],
      requiresAuth: true,
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: commercialInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'commercial.opportunity.create',
      debugLabel: 'Criar oportunidade comercial',
    },
    {
      key: 'commercial.opportunity.update',
      domain: 'commercial',
      mutationFn: (payload) => updateOpportunity(getEntityId(payload), payload),
      permissions: ['commercial.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'commercial.opportunities', updater: upsertById }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'commercial.opportunities' }],
      invalidate: commercialInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `commercial.opportunity:${getEntityId(payload)}`,
      debugLabel: 'Atualizar oportunidade comercial',
    },
    {
      key: 'commercial.opportunity.stage.change',
      domain: 'commercial',
      mutationFn: (payload) => changeOpportunityStage(getEntityId(payload), payload.stage),
      permissions: ['commercial.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'commercial.opportunities', updater: stagePatch }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'commercial.opportunities' }],
      invalidate: commercialInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `commercial.opportunity:${getEntityId(payload)}`,
      debugLabel: 'Alterar etapa da oportunidade',
    },
    {
      key: 'commercial.proposal.create',
      domain: 'commercial',
      mutationFn: createProposal,
      permissions: ['commercial.create'],
      requiresAuth: true,
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: commercialInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'commercial.proposal.create',
      debugLabel: 'Criar proposta comercial',
    },
    {
      key: 'commercial.proposal.update',
      domain: 'commercial',
      mutationFn: (payload) => updateProposal(getEntityId(payload), payload),
      permissions: ['commercial.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'commercial.proposals', updater: upsertById }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'commercial.proposals' }],
      invalidate: commercialInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `commercial.proposal:${getEntityId(payload)}`,
      debugLabel: 'Atualizar proposta comercial',
    },
    {
      key: 'commercial.proposal.convert',
      domain: 'commercial',
      mutationFn: (payload) => convertProposal(getEntityId(payload), payload),
      permissions: ['commercial.convert'],
      requiresAuth: true,
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: [...commercialInvalidations, 'contracts.summary', 'dashboard.kpis', 'reports.summary'],
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `commercial.proposal:${getEntityId(payload)}`,
      debugLabel: 'Converter proposta em contrato',
    },
    {
      key: 'commercial.activity.create',
      domain: 'commercial',
      mutationFn: createCommercialActivity,
      permissions: ['commercial.create'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'commercial.activities', updater: (items = [], payload) => [{ id: payload.id ?? `tmp-${Date.now()}`, ...payload }, ...items] }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      invalidate: commercialInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'commercial.activity.create',
      debugLabel: 'Criar atividade comercial',
    },
  ],

  realtimeEvents: {
    'commercial.pipeline.updated':         [...commercialInvalidations, 'dashboard.kpis', 'reports.summary'],
    'commercial.opportunity.created':      [...commercialInvalidations, 'dashboard.kpis', 'reports.summary'],
    'commercial.opportunity.updated':      [...commercialInvalidations, 'dashboard.kpis', 'reports.summary'],
    'commercial.opportunity.stage.changed':[...commercialInvalidations, 'dashboard.kpis', 'reports.summary'],
    'commercial.proposal.created':         [...commercialInvalidations, 'dashboard.kpis', 'reports.summary'],
    'commercial.proposal.updated':         [...commercialInvalidations, 'dashboard.kpis', 'reports.summary'],
    'commercial.proposal.converted':       [...commercialInvalidations, 'contracts.summary', 'dashboard.kpis', 'reports.summary'],
    'commercial.activity.created':         [...commercialInvalidations, 'dashboard.kpis', 'reports.summary'],
    'commercial.region.critical':          ['commercial.pipeline', 'dashboard.kpis'],
    'commercial.occupancy.low':            ['commercial.pipeline', 'inventory.summary'],
    'contracts.updated':                   ['commercial.pipeline'],
    'contracts.status.changed':            ['commercial.pipeline'],
  },
};
