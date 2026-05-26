export function createSyncMutationInspector({ mutationRegistry, mutationManager, timeline }) {
  return {
    listDefinitions() {
      return Object.values(mutationRegistry).map((mutation) => ({
        key: mutation.key,
        domain: mutation.domain,
        debugLabel: mutation.debugLabel ?? mutation.key,
        optimistic: Boolean(mutation.optimisticUpdates?.length),
        invalidates: mutation.invalidate ?? [],
        conflictPolicy: mutation.conflictPolicy ?? 'server-wins',
        requiresAuth: mutation.requiresAuth ?? true,
      }));
    },

    pending() {
      return mutationManager.getPendingMutations();
    },

    history(filter = {}) {
      return mutationManager.getMutationHistory().filter((record) => (
        (!filter.status || record.status === filter.status)
        && (!filter.mutationKey || record.key === filter.mutationKey)
        && (!filter.domain || record.domain === filter.domain)
      ));
    },

    timeline(mutationKey, limit = 30) {
      return timeline.list({ mutationKey }).slice(-limit);
    },
  };
}
