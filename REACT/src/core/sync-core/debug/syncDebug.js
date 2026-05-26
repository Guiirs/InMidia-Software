export function installSyncDebug(core, { forceDev = false } = {}) {
  if (!forceDev || typeof window === 'undefined') return;

  const previous = window.__INMIDIA_SYNC_CORE__;
  const api = {
    listResources: () => Object.keys(core.registry),
    listDomains: () => core.adapters.map((adapter) => adapter.domain),
    listMutations: () => Object.keys(core.mutationRegistry),
    getResource: (key) => core.store.get(key),
    getStats: () => core.metrics.getStats(),
    invalidate: (key) => core.invalidateResource(key),
    refresh: (key, options = { force: true }) => core.refreshResource(key, options),
    clearCache: () => core.clearProtectedCache('debug'),
    getPendingRequests: () => core.deduplicator.pending(),
    getQueue: () => core.refreshQueue.snapshot(),
    getMetrics: () => core.metrics.getStats(),
    getDependencyGraph: () => core.getDependencyGraph(),
    planInvalidation: (key) => core.planInvalidation(key),
    getRuntime: () => core.runtime.getState(),
    getPendingMutations: () => core.mutationManager.getPendingMutations(),
    getMutationHistory: () => core.mutationManager.getMutationHistory(),
    getTimeline: (filter) => core.devtools.timeline.list(filter),
    getTraces: (filter) => core.devtools.traces.list(filter),
    getPerformance: () => core.devtools.performance.summary(),
    getTelemetry: (filter) => core.devtools.telemetry.list(filter),
    getWarnings: () => core.devtools.telemetry.list({ severity: 'warning' }),
  };
  window.__INMIDIA_SYNC_CORE__ = api;

  return () => {
    if (window.__INMIDIA_SYNC_CORE__ === api) {
      if (previous === undefined) delete window.__INMIDIA_SYNC_CORE__;
      else window.__INMIDIA_SYNC_CORE__ = previous;
    }
  };
}
