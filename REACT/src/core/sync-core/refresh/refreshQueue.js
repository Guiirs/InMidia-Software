const DEFAULT_DEBOUNCE_MS = 700;
const DEFAULT_MAX_QUEUED_RESOURCES = 1000;
const DEFAULT_MAX_WAIT_MS = 5_000;
const DOMAIN_PRIORITY = {
  auth: 100,
  inventory: 80,
  dashboard: 70,
  contracts: 60,
  commercial: 50,
  alerts: 50,
  reports: 40,
  operations: 40,
};

export function createRefreshQueue({
  refreshResource,
  registry,
  metrics,
  devtools,
  telemetry,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxQueuedResources = DEFAULT_MAX_QUEUED_RESOURCES,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
}) {
  const timers = new Map();
  const queued = new Map();
  const running = new Set();

  const updateGauge = () => {
    metrics?.setGauge?.('schedulerQueueSize', queued.size);
  };

  const warnQueuePressure = (resourceKey, metadata = {}) => {
    telemetry?.warn?.({
      type: 'queue-congestion',
      resourceKey,
      event: 'scheduler.queue-pressure',
      metadata: { size: queued.size, maxQueuedResources, ...metadata },
    });
  };

  const schedule = (resourceKey, item, delayMs) => {
    const timer = setTimeout(() => flush(resourceKey), delayMs);
    timers.set(resourceKey, timer);
    devtools?.record?.({
      type: 'scheduler',
      domain: registry[resourceKey]?.domain,
      resourceKey,
      event: 'scheduler.enqueued',
      metadata: { ...item, delayMs },
    });
  };

  const flush = (resourceKey) => {
    timers.delete(resourceKey);
    const item = queued.get(resourceKey);
    queued.delete(resourceKey);
    if (!item) return;

    if (running.has(resourceKey)) {
      queued.set(resourceKey, item);
      const ageMs = Date.now() - (item.firstEnqueuedAt ?? item.enqueuedAt ?? Date.now());
      const remainingWait = Math.max(0, maxWaitMs - ageMs);
      schedule(resourceKey, item, Math.max(0, Math.min(Math.max(100, item.debounceMs ?? debounceMs), remainingWait)));
      devtools?.record?.({
        type: 'scheduler',
        domain: registry[resourceKey]?.domain,
        resourceKey,
        event: 'scheduler.deferred-running',
        metadata: item,
      });
      return;
    }

    running.add(resourceKey);
    metrics?.increment?.('refreshesExecuted');
    updateGauge();
    devtools?.record?.({
      type: 'scheduler',
      domain: registry[resourceKey]?.domain,
      resourceKey,
      event: 'scheduler.flush',
      metadata: item,
    });
    Promise.resolve(refreshResource(resourceKey, { force: item.force, reason: item.reason ?? 'queue', propagationDepth: item.depth ?? 0 }))
      .finally(() => {
        running.delete(resourceKey);
        if (queued.has(resourceKey) && !timers.has(resourceKey)) {
          const next = queued.get(resourceKey);
          const ageMs = Date.now() - (next.firstEnqueuedAt ?? next.enqueuedAt ?? Date.now());
          const priorityDelay = Math.max(0, Math.min(Math.max(100, (next.debounceMs ?? debounceMs) - (next.priority ?? 0)), Math.max(0, maxWaitMs - ageMs)));
          schedule(resourceKey, next, priorityDelay);
        }
      });
  };

  const evictLowPriority = () => {
    if (queued.size <= maxQueuedResources) return;

    let victimKey = null;
    let victimItem = null;

    for (const [key, item] of queued.entries()) {
      if (running.has(key)) continue;
      if (!victimItem) {
        victimKey = key;
        victimItem = item;
        continue;
      }
      const isLowerPriority = (item.priority ?? 0) < (victimItem.priority ?? 0);
      const samePriorityOlder = (item.priority ?? 0) === (victimItem.priority ?? 0)
        && (item.firstEnqueuedAt ?? item.enqueuedAt ?? 0) < (victimItem.firstEnqueuedAt ?? victimItem.enqueuedAt ?? 0);
      if (isLowerPriority || samePriorityOlder) {
        victimKey = key;
        victimItem = item;
      }
    }

    if (!victimKey) return;
    const timer = timers.get(victimKey);
    if (timer) clearTimeout(timer);
    timers.delete(victimKey);
    queued.delete(victimKey);
    metrics?.increment?.('refreshesCancelled');
    warnQueuePressure(victimKey, { evicted: true, victimKey, victimPriority: victimItem?.priority });
    devtools?.record?.({
      type: 'scheduler',
      domain: registry[victimKey]?.domain,
      resourceKey: victimKey,
      event: 'scheduler.backpressure-evicted',
      metadata: { priority: victimItem?.priority, size: queued.size },
    });
  };

  return {
    enqueue(resourceKey, options = {}) {
      if (timers.has(resourceKey)) {
        clearTimeout(timers.get(resourceKey));
        metrics?.increment?.('refreshesCancelled');
        devtools?.record?.({
          type: 'scheduler',
          domain: registry[resourceKey]?.domain,
          resourceKey,
          event: 'scheduler.debounce-cancelled',
        });
      }

      const resource = registry[resourceKey];
      const priority = options.priority ?? DOMAIN_PRIORITY[resource?.domain] ?? 0;
      const existing = queued.get(resourceKey);
      const next = existing && existing.priority > priority ? existing : {
        ...options,
        priority,
        firstEnqueuedAt: existing?.firstEnqueuedAt ?? Date.now(),
      };
      queued.set(resourceKey, next);

      if (queued.size > maxQueuedResources) {
        evictLowPriority();
      }

      const ageMs = Date.now() - (next.firstEnqueuedAt ?? next.enqueuedAt ?? Date.now());
      const priorityDelay = Math.max(0, Math.min(Math.max(100, (options.debounceMs ?? debounceMs) - priority), Math.max(0, maxWaitMs - ageMs)));
      schedule(resourceKey, next, priorityDelay);
      updateGauge();

      if (queued.size > maxQueuedResources * 0.9) {
        warnQueuePressure(resourceKey, { size: queued.size, priority });
      }
    },

    cancel(resourceKey) {
      if (!timers.has(resourceKey)) return;
      clearTimeout(timers.get(resourceKey));
      timers.delete(resourceKey);
      queued.delete(resourceKey);
      metrics?.increment?.('refreshesCancelled');
      updateGauge();
      devtools?.record?.({
        type: 'scheduler',
        domain: registry[resourceKey]?.domain,
        resourceKey,
        event: 'scheduler.cancelled',
      });
    },

    clear() {
      const cancelled = timers.size;
      timers.forEach((timer) => clearTimeout(timer));
      metrics?.increment?.('refreshesCancelled', cancelled);
      timers.clear();
      queued.clear();
      running.clear();
      updateGauge();
      devtools?.record?.({
        type: 'scheduler',
        event: 'scheduler.cleared',
        metadata: { cancelled },
      });
    },

    snapshot() {
      updateGauge();
      return Array.from(queued.entries()).map(([key, item]) => ({ key, running: running.has(key), ...item }));
    },

    isRunning(resourceKey) {
      return running.has(resourceKey);
    },
  };
}
