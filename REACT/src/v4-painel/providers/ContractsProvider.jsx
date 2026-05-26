import { createContext, memo, useCallback, useContext, useMemo } from 'react';
import { useSyncMutation } from '../../core/sync-core/hooks/useSyncMutation.js';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';
import {
  EMPTY_CONTRACTS_SUMMARY,
  EMPTY_FINANCIAL_IMPACT,
  toBoardContracts,
} from '../integration/adapters/contractAdapter.js';

const ContractsContext = createContext(null);

const RESOURCE_KEYS = [
  'contracts.summary',
  'contracts.list',
  'contracts.active',
  'contracts.expiring',
  'contracts.timeline',
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

function ContractsProvider({ children }) {
  const summaryResource = useSyncResource('contracts.summary');
  const listResource = useSyncResource('contracts.list');
  const activeResource = useSyncResource('contracts.active');
  const expiringResource = useSyncResource('contracts.expiring');
  const timelineResource = useSyncResource('contracts.timeline');

  const createMutation = useSyncMutation('contracts.create');
  const updateMutation = useSyncMutation('contracts.update');
  const statusMutation = useSyncMutation('contracts.status.change');
  const cancelMutation = useSyncMutation('contracts.cancel');
  const renewMutation = useSyncMutation('contracts.renew');

  const resources = useMemo(() => [
    summaryResource,
    listResource,
    activeResource,
    expiringResource,
    timelineResource,
  ], [activeResource, expiringResource, listResource, summaryResource, timelineResource]);

  const refresh = useCallback(() => (
    Promise.all(RESOURCE_KEYS.map((resourceKey) => {
      const resource = {
        'contracts.summary': summaryResource,
        'contracts.list': listResource,
        'contracts.active': activeResource,
        'contracts.expiring': expiringResource,
        'contracts.timeline': timelineResource,
      }[resourceKey];
      return resource.refresh({ reason: 'contracts.manual-refresh' });
    }))
  ), [activeResource, expiringResource, listResource, summaryResource, timelineResource]);

  const getByBoard = useCallback(async (boardId) => {
    const contracts = listResource.data ?? [];
    const boardContracts = contracts.filter((contract) => String(contract.boardId) === String(boardId));
    return toBoardContracts(boardContracts);
  }, [listResource.data]);

  const value = useMemo(() => {
    const status = statusFrom(resources);
    const hasRealData = resources.some((resource) => Boolean(resource.data));
    const summaryData = summaryResource.data ?? {};

    return {
      contracts: listResource.data ?? [],
      activeContracts: activeResource.data ?? [],
      expiringContracts: expiringResource.data ?? [],
      summary: summaryData.summary ?? EMPTY_CONTRACTS_SUMMARY,
      financialImpact: summaryData.financialImpact ?? EMPTY_FINANCIAL_IMPACT,
      renewalOpportunities: summaryData.renewalOpportunities ?? [],
      timeline: timelineResource.data ?? [],
      rawSummary: summaryData.rawSummary ?? null,
      generatedAt: summaryData.generatedAt ?? null,
      loading: status === 'loading',
      refreshing: status === 'refreshing',
      stale: status === 'stale',
      status,
      error: firstError(resources),
      source: sourceFrom(status, hasRealData),
      refresh,
      getByBoard,
      createContract: createMutation.mutateAsync,
      updateContract: updateMutation.mutateAsync,
      changeContractStatus: statusMutation.mutateAsync,
      cancelContract: cancelMutation.mutateAsync,
      renewContract: renewMutation.mutateAsync,
      mutations: {
        create: createMutation,
        update: updateMutation,
        statusChange: statusMutation,
        cancel: cancelMutation,
        renew: renewMutation,
      },
    };
  }, [
    activeResource.data,
    cancelMutation,
    createMutation,
    expiringResource.data,
    getByBoard,
    listResource.data,
    refresh,
    renewMutation,
    resources,
    statusMutation,
    summaryResource.data,
    timelineResource.data,
    updateMutation,
  ]);

  return (
    <ContractsContext.Provider value={value}>
      {children}
    </ContractsContext.Provider>
  );
}

export function useContracts() {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error('[v4-painel] useContracts deve ser usado dentro de <ContractsProvider>');
  return ctx;
}

export default memo(ContractsProvider);
