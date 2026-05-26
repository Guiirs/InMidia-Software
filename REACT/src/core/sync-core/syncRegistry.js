import {
  buildMutationRegistryFromAdapters,
  buildResourceRegistryFromAdapters,
  syncDomainAdapters,
} from './adapters/index.js';

export const syncAdapters = syncDomainAdapters;
export const syncRegistry = buildResourceRegistryFromAdapters(syncAdapters);
export const syncMutationRegistry = buildMutationRegistryFromAdapters(syncAdapters);

export function getSyncResourceDefinition(resourceKey) {
  const resource = syncRegistry[resourceKey];
  if (!resource) throw new Error(`[sync-core] Resource not registered: ${resourceKey}`);
  return resource;
}

export function getSyncMutationDefinition(mutationKey) {
  const mutation = syncMutationRegistry[mutationKey];
  if (!mutation) throw new Error(`[sync-core] Mutation not registered: ${mutationKey}`);
  return mutation;
}
