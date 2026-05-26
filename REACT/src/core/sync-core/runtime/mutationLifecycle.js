let nextMutationId = 1;

export const MUTATION_STATUSES = {
  queued: 'queued',
  optimistic: 'optimistic',
  running: 'running',
  committed: 'committed',
  rolledBack: 'rolled-back',
  failed: 'failed',
  blocked: 'blocked',
  conflicted: 'conflicted',
};

export function createMutationLifecycle({ maxHistory = 200 } = {}) {
  const mutations = new Map();
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener(Array.from(mutations.values())));

  return {
    start(config, variables) {
      const id = `mut-${nextMutationId++}`;
      const record = {
        id,
        key: config.key,
        domain: config.domain ?? 'unknown',
        debugLabel: config.debugLabel ?? config.key,
        status: MUTATION_STATUSES.queued,
        variables,
        error: null,
        startedAt: Date.now(),
        finishedAt: null,
      };
      mutations.set(id, record);
      if (mutations.size > maxHistory) mutations.delete(mutations.keys().next().value);
      notify();
      return record;
    },

    transition(id, status, patch = {}) {
      const current = mutations.get(id);
      if (!current) return null;
      const next = {
        ...current,
        ...patch,
        status,
        finishedAt: ['committed', 'rolled-back', 'failed', 'blocked', 'conflicted'].includes(status) ? Date.now() : current.finishedAt,
      };
      mutations.set(id, next);
      notify();
      return next;
    },

    list() {
      return Array.from(mutations.values());
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(this.list());
      return () => listeners.delete(listener);
    },
  };
}
