import type {
  MarketplaceActivationResult,
  MarketplaceCatalog,
  MarketplaceListResponse,
} from '../contracts/marketplace.contracts';

export function presentMarketplaceCatalog(catalog: MarketplaceCatalog): MarketplaceListResponse {
  return {
    success: true,
    modules: catalog.modules,
    capabilities: catalog.capabilities,
    summary: catalog.summary,
  };
}

export function presentMarketplaceActivation(result: MarketplaceActivationResult): MarketplaceActivationResult {
  return result;
}
