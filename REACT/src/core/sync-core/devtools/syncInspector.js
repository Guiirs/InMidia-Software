export function createSyncInspector(core) {
  return {
    snapshot() {
      return {
        runtime: core.runtime.getState(),
        metrics: core.metrics.getStats(),
        resources: core.store.snapshot(),
        refreshQueue: core.refreshQueue.snapshot(),
        pendingRequests: core.deduplicator.pending(),
        pendingMutations: core.mutationManager.getPendingMutations(),
        mutationHistory: core.mutationManager.getMutationHistory(),
        dependencyGraph: core.getDependencyGraph(),
      };
    },

    health() {
      const snapshot = this.snapshot();
      const staleResources = Object.entries(snapshot.resources)
        .filter(([, resource]) => resource.isStale || ['error', 'unauthorized', 'forbidden', 'offline'].includes(resource.status))
        .map(([key, resource]) => ({ key, status: resource.status, version: resource.version }));

      return {
        runtimeStatus: snapshot.runtime.status,
        staleResources,
        queuedRefreshes: snapshot.refreshQueue.length,
        pendingRequests: snapshot.pendingRequests.length,
        pendingMutations: snapshot.pendingMutations.length,
      };
    },
  };
}
