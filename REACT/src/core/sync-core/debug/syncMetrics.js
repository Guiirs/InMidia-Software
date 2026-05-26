export function createSyncMetrics() {
  const counters = {
    requestsTotal: 0,
    requestsDeduplicated: 0,
    cacheHits: 0,
    cacheMisses: 0,
    realtimeInvalidations: 0,
    refreshesExecuted: 0,
    refreshesCancelled: 0,
    authExpirations: 0,
    optimisticRollbacks: 0,
    propagationsPlanned: 0,
    runtimeStarts: 0,
    runtimePauses: 0,
    runtimeResumes: 0,
    runtimeStops: 0,
    mutationsQueued: 0,
    mutationsStarted: 0,
    mutationsCommitted: 0,
    mutationsFailed: 0,
    mutationsBlocked: 0,
    mutationsReconciled: 0,
    mutationConflicts: 0,
    optimisticUpdatesApplied: 0,
  };
  const gauges = {
    schedulerQueueSize: 0,
    cacheEntryCount: 0,
    staleResourceCount: 0,
    estimatedMemoryBytes: 0,
  };
  const durations = [];

  return {
    increment(name, amount = 1) {
      counters[name] = (counters[name] ?? 0) + amount;
    },

    setGauge(name, value) {
      gauges[name] = value;
    },

    recordDuration(ms) {
      durations.push(ms);
      if (durations.length > 200) durations.shift();
    },
    getStats() {
      const cacheHitRatio = (counters.cacheHits + counters.cacheMisses) > 0
        ? counters.cacheHits / (counters.cacheHits + counters.cacheMisses)
        : 0;
      const averageFetchDuration = durations.length
        ? durations.reduce((sum, item) => sum + item, 0) / durations.length
        : 0;
      return {
        ...counters,
        ...gauges,
        cacheHitRatio,
        averageFetchDuration,
      };
    },
  };
}
