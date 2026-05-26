const DEFAULT_MAX_EVENTS = 300;
const DEFAULT_DEDUPING_WINDOW_MS = 60_000;

function normalizeTelemetryEvent(event = {}) {
  return {
    timestamp: event.timestamp ?? Date.now(),
    severity: event.severity ?? 'info',
    type: event.type ?? 'runtime',
    domain: event.domain ?? null,
    resourceKey: event.resourceKey ?? null,
    mutationKey: event.mutationKey ?? null,
    event: event.event ?? 'unknown',
    message: event.message ?? null,
    metadata: event.metadata ?? {},
  };
}

export function createSyncTelemetry({ maxEvents = DEFAULT_MAX_EVENTS, dedupingWindowMs = DEFAULT_DEDUPING_WINDOW_MS } = {}) {
  const events = [];
  const listeners = new Set();
  const dedupeMap = new Map();

  const emit = (event) => {
    const entry = normalizeTelemetryEvent(event);
    const key = [entry.type, entry.event, entry.resourceKey ?? '', entry.mutationKey ?? '', entry.message ?? ''].join('|');
    const lastAt = dedupeMap.get(key) ?? 0;
    if (entry.severity !== 'info' && Date.now() - lastAt < dedupingWindowMs) return null;

    dedupeMap.set(key, entry.timestamp);
    events.push(entry);
    if (events.length > maxEvents) events.shift();
    listeners.forEach((listener) => listener(entry, events.slice()));
    return entry;
  };

  return {
    record: emit,
    warn(event) {
      return emit({ ...event, severity: 'warning' });
    },
    error(event) {
      return emit({ ...event, severity: 'error' });
    },
    list(filter = {}) {
      return events.filter((entry) => (
        (!filter.type || entry.type === filter.type)
        && (!filter.severity || entry.severity === filter.severity)
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
      dedupeMap.clear();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(null, events.slice());
      return () => listeners.delete(listener);
    },
  };
}
