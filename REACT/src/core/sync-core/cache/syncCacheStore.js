import { createInitialResourceState, reduceResourceState } from '../resources/resourceStateMachine.js';

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_IDLE_MS = 5 * 60_000;
const DEFAULT_CLEANUP_INTERVAL_MS = 10_000;
const DEFAULT_CLEANUP_BUDGET = 3;

function estimateEntrySize(entry) {
  const dataSize = entry?.data == null ? 0 : JSON.stringify(entry.data).length * 2;
  const metaSize = 256 + (entry?.subscribers?.size ?? 0) * 32;
  return dataSize + metaSize;
}

function updateEntryOrder(entries, resourceKey, entry) {
  entries.delete(resourceKey);
  entries.set(resourceKey, entry);
}

export function createSyncCacheStore({
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxIdleMs = DEFAULT_MAX_IDLE_MS,
  cleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS,
  cleanupBudget = DEFAULT_CLEANUP_BUDGET,
  metrics,
  telemetry,
} = {}) {
  const entries = new Map();
  let lastCleanupAt = 0;

  const updateGauges = () => {
    const snapshot = Array.from(entries.values());
    metrics?.setGauge?.('cacheEntryCount', snapshot.length);
    metrics?.setGauge?.('staleResourceCount', snapshot.filter((entry) => entry.isStale).length);
    metrics?.setGauge?.('estimatedMemoryBytes', snapshot.reduce((sum, entry) => sum + estimateEntrySize(entry), 0));
  };

  const evict = (resourceKey, reason) => {
    const entry = entries.get(resourceKey);
    if (!entry || entry.subscribers.size) return false;
    entries.delete(resourceKey);
    telemetry?.warn?.({
      type: 'resource-evicted',
      resourceKey,
      event: 'cache.evicted',
      metadata: { reason, lastAccessedAt: entry.lastAccessedAt, version: entry.version },
    });
    updateGauges();
    return true;
  };

  const cleanup = ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - lastCleanupAt < cleanupIntervalMs && entries.size <= maxEntries) return 0;

    let removed = 0;
    let inspected = 0;
    const keys = Array.from(entries.keys());

    for (const resourceKey of keys) {
      if (inspected >= cleanupBudget && entries.size <= maxEntries) break;
      inspected += 1;
      const entry = entries.get(resourceKey);
      if (!entry) continue;
      const isInactive = !entry.subscribers.size && now - (entry.lastAccessedAt || 0) > maxIdleMs;
      if (isInactive && evict(resourceKey, 'inactive')) removed += 1;
    }

    if (entries.size > maxEntries) {
      for (const resourceKey of Array.from(entries.keys())) {
        if (entries.size <= maxEntries) break;
        if (evict(resourceKey, 'capacity')) removed += 1;
      }
    }

    lastCleanupAt = now;
    if (removed) telemetry?.record?.({
      type: 'resource',
      event: 'cache.cleanup',
      metadata: { removed, size: entries.size, maxEntries },
    });
    updateGauges();
    return removed;
  };

  const ensure = (resourceKey) => {
    if (!entries.has(resourceKey)) entries.set(resourceKey, createInitialResourceState());
    const entry = entries.get(resourceKey);
    entry.lastAccessedAt = Date.now();
    updateEntryOrder(entries, resourceKey, entry);
    return entry;
  };

  const notify = (resourceKey) => {
    const entry = ensure(resourceKey);
    entry.subscribers.forEach((listener) => listener({ ...entry }));
  };

  return {
    get(resourceKey) {
      cleanup();
      return ensure(resourceKey);
    },

    transition(resourceKey, event) {
      cleanup();
      const current = ensure(resourceKey);
      const next = reduceResourceState(current, event);
      next.lastAccessedAt = Date.now();
      entries.set(resourceKey, next);
      updateEntryOrder(entries, resourceKey, next);
      updateGauges();
      notify(resourceKey);
      return next;
    },

    subscribe(resourceKey, listener) {
      const entry = ensure(resourceKey);
      entry.subscribers.add(listener);
      entry.lastAccessedAt = Date.now();
      updateEntryOrder(entries, resourceKey, entry);
      updateGauges();
      listener({ ...entry });
      return () => {
        const current = ensure(resourceKey);
        current.subscribers.delete(listener);
        current.lastAccessedAt = Date.now();
        updateEntryOrder(entries, resourceKey, current);
        updateGauges();
      };
    },

    clear(resourceKey) {
      if (resourceKey) {
        this.transition(resourceKey, { type: 'clear' });
        return;
      }
      Array.from(entries.keys()).forEach((key) => this.transition(key, { type: 'clear' }));
    },

    cleanup(options = {}) {
      return cleanup(options);
    },

    keys() {
      return Array.from(entries.keys());
    },

    snapshot() {
      cleanup();
      return Object.fromEntries(Array.from(entries.entries()).map(([key, value]) => [key, { ...value, subscribers: value.subscribers.size }]));
    },
  };
}
