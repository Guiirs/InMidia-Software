import {
  activateCampaign,
  createCampaign,
  deleteCampaign,
  getActiveCampaigns,
  getCampaignsPerformance,
  getCampaignsSummary,
  getScheduledCampaigns,
  listCampaigns,
  pauseCampaign,
  updateCampaign,
} from '../../../services/campaignsV4Service.js';

const CAMPAIGNS_TTL_MS = 60_000;
const CAMPAIGNS_STALE_MS = 5 * 60_000;
const CAMPAIGNS_READ = ['campaigns.read'];
const CAMPAIGNS_FALLBACK_POLICY = 'keep-last-valid';

function getEntityId(payload = {}) {
  return payload.id ?? payload.campaignId ?? payload.realId;
}

function stableKey(item = {}) {
  return item.realId ?? item.id;
}

function upsertCampaign(campaigns = [], payload = {}) {
  const id = getEntityId(payload);
  if (!id) return campaigns;
  const exists = campaigns.some((c) => stableKey(c) === id);
  if (!exists) return [{ id, ...payload }, ...campaigns];
  return campaigns.map((c) => (stableKey(c) === id ? { ...c, ...payload } : c));
}

function removeCampaign(campaigns = [], payload = {}) {
  const id = getEntityId(payload);
  if (!id) return campaigns;
  return campaigns.filter((c) => stableKey(c) !== id);
}

function campaignsResource({ key, fetcher, dependencies = [], dependents = [], debugLabel }) {
  return {
    key,
    domain: 'campaigns',
    fetcher,
    ttlMs: CAMPAIGNS_TTL_MS,
    staleWhileRevalidate: CAMPAIGNS_STALE_MS,
    dependencies,
    dependents,
    domainEvents: ['campaigns.created', 'campaigns.updated', 'campaigns.paused', 'campaigns.activated', 'campaigns.deleted'],
    realtimeEvents: ['campaigns.created', 'campaigns.updated', 'campaigns.paused', 'campaigns.activated', 'campaigns.deleted'],
    permissions: CAMPAIGNS_READ,
    fallbackPolicy: CAMPAIGNS_FALLBACK_POLICY,
    productionMockAllowed: false,
    debugLabel,
  };
}

const allCampaignInvalidations = [
  'campaigns.summary',
  'campaigns.list',
  'campaigns.active',
  'campaigns.scheduled',
  'campaigns.performance',
];

export const campaignsAdapter = {
  domain: 'campaigns',
  domainEvents: [
    'campaigns.created',
    'campaigns.updated',
    'campaigns.paused',
    'campaigns.activated',
    'campaigns.deleted',
  ],
  permissions: CAMPAIGNS_READ,
  ttlMs: CAMPAIGNS_TTL_MS,
  fallbackPolicy: CAMPAIGNS_FALLBACK_POLICY,

  resources: [
    campaignsResource({
      key: 'campaigns.summary',
      fetcher: getCampaignsSummary,
      dependents: ['dashboard.kpis', 'activity.timeline'],
      debugLabel: 'Campaigns summary',
    }),
    campaignsResource({
      key: 'campaigns.list',
      fetcher: listCampaigns,
      dependencies: ['campaigns.summary'],
      dependents: ['campaigns.active', 'campaigns.scheduled'],
      debugLabel: 'Campaigns list',
    }),
    campaignsResource({
      key: 'campaigns.active',
      fetcher: getActiveCampaigns,
      dependencies: ['campaigns.list'],
      debugLabel: 'Active campaigns',
    }),
    campaignsResource({
      key: 'campaigns.scheduled',
      fetcher: getScheduledCampaigns,
      dependencies: ['campaigns.list'],
      debugLabel: 'Scheduled campaigns',
    }),
    campaignsResource({
      key: 'campaigns.performance',
      fetcher: getCampaignsPerformance,
      dependencies: ['campaigns.list'],
      dependents: ['reports.summary'],
      debugLabel: 'Campaigns performance',
    }),
  ],

  mutations: [
    {
      key: 'campaigns.create',
      domain: 'campaigns',
      mutationFn: createCampaign,
      permissions: ['campaigns.create'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'campaigns.list', updater: (list = {}, payload = {}) => ({ ...list, campaigns: [{ id: `optimistic-${Date.now()}`, ...payload }, ...(list.campaigns ?? [])], total: (list.total ?? 0) + 1 }) }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'campaigns.list' }],
      invalidate: allCampaignInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: () => 'campaigns.create',
      debugLabel: 'Criar campanha',
    },
    {
      key: 'campaigns.update',
      domain: 'campaigns',
      mutationFn: (payload) => updateCampaign(getEntityId(payload), payload),
      permissions: ['campaigns.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'campaigns.list', updater: (list = {}, payload = {}) => ({ ...list, campaigns: upsertCampaign(list.campaigns ?? [], payload) }) }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'campaigns.list' }],
      invalidate: allCampaignInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `campaigns:${getEntityId(payload)}`,
      debugLabel: 'Atualizar campanha',
    },
    {
      key: 'campaigns.pause',
      domain: 'campaigns',
      mutationFn: (payload) => pauseCampaign(getEntityId(payload)),
      permissions: ['campaigns.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'campaigns.list', updater: (list = {}, payload = {}) => ({ ...list, campaigns: upsertCampaign(list.campaigns ?? [], { ...payload, status: 'paused' }) }) }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'campaigns.list' }],
      invalidate: allCampaignInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `campaigns:${getEntityId(payload)}`,
      debugLabel: 'Pausar campanha',
    },
    {
      key: 'campaigns.activate',
      domain: 'campaigns',
      mutationFn: (payload) => activateCampaign(getEntityId(payload)),
      permissions: ['campaigns.update'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'campaigns.list', updater: (list = {}, payload = {}) => ({ ...list, campaigns: upsertCampaign(list.campaigns ?? [], { ...payload, status: 'active' }) }) }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'campaigns.list' }],
      invalidate: allCampaignInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `campaigns:${getEntityId(payload)}`,
      debugLabel: 'Ativar campanha',
    },
    {
      key: 'campaigns.delete',
      domain: 'campaigns',
      mutationFn: (payload) => deleteCampaign(getEntityId(payload)),
      permissions: ['campaigns.delete'],
      requiresAuth: true,
      optimistic: true,
      optimisticUpdates: [{ resourceKey: 'campaigns.list', updater: (list = {}, payload = {}) => ({ ...list, campaigns: removeCampaign(list.campaigns ?? [], payload), total: Math.max(0, (list.total ?? 1) - 1) }) }],
      rollbackPolicy: 'snapshot',
      reconcilePolicy: 'server-wins',
      reconcile: [{ resourceKey: 'campaigns.list' }],
      invalidate: allCampaignInvalidations,
      invalidateDependents: true,
      conflictPolicy: 'server-wins',
      queueKey: (payload) => `campaigns:${getEntityId(payload)}`,
      debugLabel: 'Excluir campanha',
    },
  ],

  realtimeEvents: {
    'campaigns.created':   allCampaignInvalidations,
    'campaigns.updated':   allCampaignInvalidations,
    'campaigns.paused':    allCampaignInvalidations,
    'campaigns.activated': allCampaignInvalidations,
    'campaigns.deleted':   allCampaignInvalidations,
  },
};
