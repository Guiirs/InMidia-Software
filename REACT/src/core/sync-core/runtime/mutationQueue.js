export function createMutationQueue(metrics, telemetry) {
  const tails = new Map();
  const pending = new Map();

  function queueKey(config, variables) {
    if (config.queueKey) {
      return typeof config.queueKey === 'function' ? config.queueKey(variables) : config.queueKey;
    }
    return config.conflictKey ?? config.key;
  }

  return {
    enqueue(config, variables, task) {
      const key = queueKey(config, variables);
      const previous = tails.get(key) ?? Promise.resolve();
      const nextCount = (pending.get(key) ?? 0) + 1;
      pending.set(key, nextCount);
      metrics?.increment?.('mutationsQueued');
      metrics?.setGauge?.('mutationQueueSize', pending.size);
      if (nextCount >= 4) {
        telemetry?.warn?.({
          type: 'mutation-retry-loop',
          mutationKey: config.key,
          event: 'mutation.retry-loop',
          metadata: { queueKey: key, pendingCount: nextCount },
        });
      }

      const run = previous.catch(() => undefined).then(task);
      const tail = run.catch(() => undefined).finally(() => {
        const count = (pending.get(key) ?? 1) - 1;
        if (count <= 0) pending.delete(key);
        else pending.set(key, count);
        metrics?.setGauge?.('mutationQueueSize', pending.size);
        if (tails.get(key) === tail) tails.delete(key);
      });
      tails.set(key, tail);

      return run;
    },

    hasConflict(config, variables) {
      const key = queueKey(config, variables);
      return pending.has(key);
    },

    snapshot() {
      return Array.from(pending.entries()).map(([key, count]) => ({ key, count }));
    },

    clear() {
      pending.clear();
      tails.clear();
      metrics?.setGauge?.('mutationQueueSize', 0);
    },
  };
}
