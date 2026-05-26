import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncMutation } from '../../core/sync-core/hooks/useSyncMutation.js';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';
import { createEmptyCommercialSnapshot } from '../integration/adapters/commercialAdapter.js';

const CommercialContext = createContext(null);

const RESOURCE_KEYS = [
  'commercial.pipeline',
  'commercial.opportunities',
  'commercial.proposals',
  'commercial.conversions',
  'commercial.activities',
];

const BLOCKING_STATUSES = new Set(['error', 'unauthorized', 'forbidden', 'offline']);

function statusFrom(resources) {
  if (resources.some((resource) => resource.status === 'unauthorized')) return 'unauthorized';
  if (resources.some((resource) => resource.status === 'forbidden')) return 'forbidden';
  if (resources.some((resource) => resource.status === 'offline')) return 'offline';
  if (resources.some((resource) => resource.status === 'error')) return 'error';
  if (resources.some((resource) => resource.status === 'stale' || resource.isStale)) return 'stale';
  if (resources.some((resource) => resource.status === 'refreshing' || resource.isRefreshing)) return 'refreshing';
  if (resources.some((resource) => resource.status === 'loading' || resource.status === 'idle')) return 'loading';
  return 'success';
}

function sourceFrom(status, hasRealData) {
  if (BLOCKING_STATUSES.has(status)) return status;
  if (status === 'stale' || status === 'refreshing') return 'stale';
  if (!hasRealData) return 'empty';
  return 'real';
}

function firstError(resources) {
  const failed = resources.find((resource) => resource.error);
  return failed?.error?.message ?? null;
}

function CommercialProvider({ children }) {
  const pipeline = useSyncResource('commercial.pipeline');
  const opportunities = useSyncResource('commercial.opportunities');
  const proposals = useSyncResource('commercial.proposals');
  const conversions = useSyncResource('commercial.conversions');
  const activities = useSyncResource('commercial.activities');

  const opportunityCreate = useSyncMutation('commercial.opportunity.create');
  const opportunityUpdate = useSyncMutation('commercial.opportunity.update');
  const opportunityStageChange = useSyncMutation('commercial.opportunity.stage.change');
  const proposalCreate = useSyncMutation('commercial.proposal.create');
  const proposalUpdate = useSyncMutation('commercial.proposal.update');
  const proposalConvert = useSyncMutation('commercial.proposal.convert');
  const activityCreate = useSyncMutation('commercial.activity.create');

  const resources = useMemo(() => [pipeline, opportunities, proposals, conversions, activities], [
    activities,
    conversions,
    opportunities,
    pipeline,
    proposals,
  ]);

  const refresh = useCallback(() => (
    Promise.all(RESOURCE_KEYS.map((resourceKey) => {
      const resource = {
        'commercial.pipeline': pipeline,
        'commercial.opportunities': opportunities,
        'commercial.proposals': proposals,
        'commercial.conversions': conversions,
        'commercial.activities': activities,
      }[resourceKey];
      return resource.refresh({ reason: 'commercial.manual-refresh' });
    }))
  ), [activities, conversions, opportunities, pipeline, proposals]);

  const value = useMemo(() => {
    const empty = createEmptyCommercialSnapshot();
    const status = statusFrom(resources);
    const hasRealData = resources.some((resource) => Boolean(resource.data));
    const pipelineData = pipeline.data ?? {};
    const conversionsData = conversions.data ?? {};

    return {
      commercial: {
        ...empty,
        hero: pipelineData.hero ?? empty.hero,
        pipeline: pipelineData.pipeline ?? empty.pipeline,
        kpis: pipelineData.kpis ?? empty.kpis,
        opportunities: opportunities.data ?? empty.opportunities,
        proposals: proposals.data ?? [],
        conversions: conversionsData.conversions ?? [],
        activities: activities.data ?? [],
        revenueForecast: conversionsData.revenueForecast ?? empty.revenueForecast,
        regionalPerformance: conversionsData.regionalPerformance ?? empty.regionalPerformance,
        sellersPerformance: conversionsData.sellersPerformance ?? empty.sellersPerformance,
        salesTargets: conversionsData.salesTargets ?? empty.salesTargets,
        insights: activities.data ?? empty.insights,
      },
      loading: status === 'loading',
      refreshing: status === 'refreshing',
      stale: status === 'stale',
      status,
      error: firstError(resources),
      source: sourceFrom(status, hasRealData),
      refresh,
      createOpportunity: opportunityCreate.mutateAsync,
      updateOpportunity: opportunityUpdate.mutateAsync,
      changeOpportunityStage: opportunityStageChange.mutateAsync,
      createProposal: proposalCreate.mutateAsync,
      updateProposal: proposalUpdate.mutateAsync,
      convertProposal: proposalConvert.mutateAsync,
      createActivity: activityCreate.mutateAsync,
      mutations: {
        opportunityCreate,
        opportunityUpdate,
        opportunityStageChange,
        proposalCreate,
        proposalUpdate,
        proposalConvert,
        activityCreate,
      },
    };
  }, [
    activities.data,
    activityCreate,
    conversions.data,
    opportunityCreate,
    opportunityStageChange,
    opportunityUpdate,
    opportunities.data,
    pipeline.data,
    proposalConvert,
    proposalCreate,
    proposalUpdate,
    proposals.data,
    refresh,
    resources,
  ]);

  return (
    <CommercialContext.Provider value={value}>
      {children}
    </CommercialContext.Provider>
  );
}

export function useCommercial() {
  const ctx = useContext(CommercialContext);
  if (!ctx) throw new Error('[v4-painel] useCommercial deve ser usado dentro de <CommercialProvider>');
  return ctx;
}

export default memo(CommercialProvider);
