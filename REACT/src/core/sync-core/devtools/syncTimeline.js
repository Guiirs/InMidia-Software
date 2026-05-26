const DEFAULT_MAX_EVENTS = 500;

export const SYNC_TIMELINE_TYPES = {
  resource: 'resource',
  invalidation: 'invalidation',
  propagation: 'propagation',
  mutation: 'mutation',
  rollback: 'rollback',
  conflict: 'conflict',
  auth: 'auth',
  reconnect: 'reconnect',
  scheduler: 'scheduler',
  realtime: 'realtime',
};

function normalizeTimelineEvent(event = {}) {
  return {
    timestamp: event.timestamp ?? Date.now(),
    type: event.type ?? 'runtime',
    domain: event.domain ?? null,
    resourceKey: event.resourceKey ?? null,
    mutationKey: event.mutationKey ?? null,
    event: event.event ?? 'unknown',
    metadata: event.metadata ?? {},
  };
}

export function createSyncTimeline({ maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  const events = [];
  const listeners = new Set();

  const notify = (entry) => {
    listeners.forEach((listener) => listener(entry, events.slice()));
  };

  return {
    record(event) {
      const entry = normalizeTimelineEvent(event);
      events.push(entry);
      if (events.length > maxEvents) events.shift();
      notify(entry);
      return entry;
    },

    list(filter = {}) {
      return events.filter((entry) => (
        (!filter.type || entry.type === filter.type)
        && (!filter.domain || entry.domain === filter.domain)
        && (!filter.resourceKey || entry.resourceKey === filter.resourceKey)
        && (!filter.mutationKey || entry.mutationKey === filter.mutationKey)
        && (!filter.event || entry.event === filter.event)
      ));
    },

    latest(limit = 50) {
      return events.slice(Math.max(0, events.length - limit));
    },

    clear() {
      events.length = 0;
      notify(null);
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(null, events.slice());
      return () => listeners.delete(listener);
    },
  };
}
