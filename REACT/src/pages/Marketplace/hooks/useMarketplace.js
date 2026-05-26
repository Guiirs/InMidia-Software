import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateMarketplaceCapability,
  deactivateMarketplaceCapability,
  fetchMarketplaceCapabilities,
  fetchMarketplaceModules,
} from '../../../services/marketplaceService';

export function useMarketplace() {
  const queryClient = useQueryClient();

  const modulesQuery = useQuery({
    queryKey: ['marketplace-modules'],
    queryFn: fetchMarketplaceModules,
    staleTime: 1000 * 60 * 5,
  });

  const capabilitiesQuery = useQuery({
    queryKey: ['marketplace-capabilities'],
    queryFn: fetchMarketplaceCapabilities,
    staleTime: 1000 * 60 * 5,
  });

  const invalidateCatalog = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['marketplace-modules'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace-capabilities'] }),
    ]);
  };

  const activateMutation = useMutation({
    mutationFn: activateMarketplaceCapability,
    onSuccess: invalidateCatalog,
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateMarketplaceCapability,
    onSuccess: invalidateCatalog,
  });

  const modulesData = modulesQuery.data ?? {};
  const capabilitiesData = capabilitiesQuery.data ?? {};

  const isLoading = modulesQuery.isLoading || capabilitiesQuery.isLoading;
  const hasError = modulesQuery.isError || capabilitiesQuery.isError;
  const firstError = modulesQuery.error ?? capabilitiesQuery.error ?? null;

  return {
    isLoading,
    hasError,
    firstError,
    modules: modulesData.modules ?? [],
    capabilities: capabilitiesData.capabilities ?? [],
    summary: modulesData.summary ?? capabilitiesData.summary ?? null,
    activateCapability: activateMutation.mutateAsync,
    deactivateCapability: deactivateMutation.mutateAsync,
    isMutating: activateMutation.isPending || deactivateMutation.isPending,
  };
}
