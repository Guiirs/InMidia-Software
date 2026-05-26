import { MARKETPLACE_CAPABILITY_REGISTRY } from '../registry/marketplace.registry';

export const MARKETPLACE_CAPABILITIES = MARKETPLACE_CAPABILITY_REGISTRY;

export function getMarketplaceCapabilityIds(): string[] {
  return MARKETPLACE_CAPABILITY_REGISTRY.map((capability) => capability.id);
}
