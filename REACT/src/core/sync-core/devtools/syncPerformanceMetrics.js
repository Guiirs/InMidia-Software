function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

export function createSyncPerformanceMetrics({ maxSamples = 300 } = {}) {
  const samples = new Map();

  function push(name, durationMs, metadata = {}) {
    const list = samples.get(name) ?? [];
    list.push({ durationMs, metadata, timestamp: Date.now() });
    if (list.length > maxSamples) list.shift();
    samples.set(name, list);
  }

  return {
    record(name, durationMs, metadata = {}) {
      push(name, durationMs, metadata);
    },

    measure(name, metadata = {}) {
      const startedAt = performance.now();
      return () => push(name, performance.now() - startedAt, metadata);
    },

    get(name) {
      return (samples.get(name) ?? []).slice();
    },

    summary() {
      return Object.fromEntries(Array.from(samples.entries()).map(([name, list]) => {
        const values = list.map((item) => item.durationMs);
        const total = values.reduce((sum, item) => sum + item, 0);
        return [name, {
          count: values.length,
          averageMs: values.length ? total / values.length : 0,
          p50Ms: percentile(values, 0.5),
          p95Ms: percentile(values, 0.95),
          p99Ms: percentile(values, 0.99),
          maxMs: values.length ? Math.max(...values) : 0,
          last: list[list.length - 1] ?? null,
        }];
      }));
    },

    clear() {
      samples.clear();
    },
  };
}
