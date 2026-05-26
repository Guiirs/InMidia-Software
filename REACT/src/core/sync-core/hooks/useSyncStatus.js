import { useSyncCore } from '../SyncCoreProvider.jsx';

export function useSyncStatus() {
  const { metrics, store, refreshQueue, deduplicator, runtime, mutationManager } = useSyncCore();
  return {
    metrics: metrics.getStats(),
    resources: store.snapshot(),
    queue: refreshQueue.snapshot(),
    pendingRequests: deduplicator.pending(),
    pendingMutations: mutationManager.getPendingMutations(),
    mutationHistory: mutationManager.getMutationHistory(),
    runtime: runtime.getState(),
  };
}
