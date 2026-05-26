let nextTraceId = 1;

export function createSyncTraceStore({ maxTraces = 200 } = {}) {
  const traces = new Map();
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener(Array.from(traces.values())));

  return {
    startTrace({ type = 'runtime', name, domain = null, resourceKey = null, mutationKey = null, metadata = {} }) {
      const id = `trace-${nextTraceId++}`;
      const trace = {
        id,
        type,
        name: name ?? type,
        domain,
        resourceKey,
        mutationKey,
        metadata,
        startedAt: Date.now(),
        finishedAt: null,
        durationMs: null,
        status: 'running',
        steps: [],
      };
      traces.set(id, trace);
      if (traces.size > maxTraces) traces.delete(traces.keys().next().value);
      notify();
      return id;
    },

    addStep(id, event, metadata = {}) {
      const trace = traces.get(id);
      if (!trace) return null;
      trace.steps.push({ timestamp: Date.now(), event, metadata });
      notify();
      return trace;
    },

    endTrace(id, { status = 'completed', metadata = {} } = {}) {
      const trace = traces.get(id);
      if (!trace) return null;
      const finishedAt = Date.now();
      const next = {
        ...trace,
        metadata: { ...trace.metadata, ...metadata },
        finishedAt,
        durationMs: finishedAt - trace.startedAt,
        status,
      };
      traces.set(id, next);
      notify();
      return next;
    },

    getTrace(id) {
      return traces.get(id) ?? null;
    },

    list(filter = {}) {
      return Array.from(traces.values()).filter((trace) => (
        (!filter.type || trace.type === filter.type)
        && (!filter.status || trace.status === filter.status)
        && (!filter.resourceKey || trace.resourceKey === filter.resourceKey)
        && (!filter.mutationKey || trace.mutationKey === filter.mutationKey)
      ));
    },

    active() {
      return this.list({ status: 'running' });
    },

    clear() {
      traces.clear();
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(Array.from(traces.values()));
      return () => listeners.delete(listener);
    },
  };
}
