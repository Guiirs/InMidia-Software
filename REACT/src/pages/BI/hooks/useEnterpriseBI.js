import { useQuery } from '@tanstack/react-query';
import {
  fetchBISnapshot,
  fetchExecutiveDataset,
  fetchRegionalDataset,
  fetchInventoryDataset,
  fetchQualityDataset,
  fetchGovernanceDataset,
} from '../../../services/enterpriseBIService';

const STALE_TIME = 1000 * 60 * 5; // 5 minutes

/**
 * Fetches all Enterprise BI datasets in parallel.
 * Each sub-query is independently loaded, so partial data is displayed while
 * others are still loading.
 */
export function useEnterpriseBI() {
  const snapshot = useQuery({
    queryKey: ['enterprise-bi', 'snapshot'],
    queryFn: fetchBISnapshot,
    staleTime: STALE_TIME,
    retry: 1,
  });

  const executive = useQuery({
    queryKey: ['enterprise-bi', 'executive'],
    queryFn: fetchExecutiveDataset,
    staleTime: STALE_TIME,
    retry: 1,
  });

  const regional = useQuery({
    queryKey: ['enterprise-bi', 'regional'],
    queryFn: fetchRegionalDataset,
    staleTime: STALE_TIME,
    retry: 1,
  });

  const inventory = useQuery({
    queryKey: ['enterprise-bi', 'inventory'],
    queryFn: fetchInventoryDataset,
    staleTime: STALE_TIME,
    retry: 1,
  });

  const quality = useQuery({
    queryKey: ['enterprise-bi', 'quality'],
    queryFn: fetchQualityDataset,
    staleTime: STALE_TIME,
    retry: 1,
  });

  const governance = useQuery({
    queryKey: ['enterprise-bi', 'governance'],
    queryFn: fetchGovernanceDataset,
    staleTime: STALE_TIME,
    retry: 1,
  });

  const isLoading =
    snapshot.isLoading ||
    executive.isLoading ||
    regional.isLoading ||
    inventory.isLoading ||
    quality.isLoading ||
    governance.isLoading;

  const hasError =
    snapshot.isError ||
    executive.isError ||
    regional.isError ||
    inventory.isError ||
    quality.isError ||
    governance.isError;

  const firstError =
    snapshot.error ||
    executive.error ||
    regional.error ||
    inventory.error ||
    quality.error ||
    governance.error;

  const isEmpty =
    !isLoading &&
    !hasError &&
    snapshot.data?.empty &&
    executive.data?.empty &&
    regional.data?.empty &&
    inventory.data?.empty &&
    quality.data?.empty &&
    governance.data?.empty;

  return {
    isLoading,
    hasError,
    firstError,
    isEmpty,
    snapshot: snapshot.data?.snapshot ?? null,
    executive: executive.data?.dataset ?? null,
    regional: regional.data?.dataset ?? null,
    inventory: inventory.data?.dataset ?? null,
    quality: quality.data?.dataset ?? null,
    governance: governance.data?.dataset ?? null,
    snapshotQuery: snapshot,
    executiveQuery: executive,
    regionalQuery: regional,
    inventoryQuery: inventory,
    qualityQuery: quality,
    governanceQuery: governance,
  };
}
