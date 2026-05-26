export function createRequestDeduplicator(metrics) {
  const inFlight = new Map();

  return {
    run(key, executor) {
      if (inFlight.has(key)) {
        metrics?.increment?.('requestsDeduplicated');
        return { promise: inFlight.get(key), deduped: true };
      }

      const promise = Promise.resolve()
        .then(executor)
        .finally(() => inFlight.delete(key));

      inFlight.set(key, promise);
      return { promise, deduped: false };
    },

    clear() {
      inFlight.clear();
    },

    pending() {
      return Array.from(inFlight.keys());
    },
  };
}
