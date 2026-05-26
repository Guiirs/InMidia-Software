export function createSyncResourceInspector({ registry, store, timeline }) {
  return {
    listDefinitions() {
      return Object.values(registry).map((resource) => ({
        key: resource.key,
        domain: resource.domain,
        debugLabel: resource.debugLabel ?? resource.key,
        ttlMs: resource.ttlMs,
        staleWhileRevalidate: resource.staleWhileRevalidate,
        dependencies: resource.dependencies ?? [],
        dependents: resource.dependents ?? [],
        realtimeEvents: resource.realtimeEvents ?? [],
        requiresAuth: resource.requiresAuth ?? true,
      }));
    },

    get(resourceKey) {
      return {
        definition: registry[resourceKey] ?? null,
        state: store.get(resourceKey),
        timeline: timeline.list({ resourceKey }),
      };
    },

    states() {
      return store.snapshot();
    },

    stale() {
      return Object.entries(store.snapshot())
        .filter(([, state]) => state.isStale)
        .map(([key, state]) => ({ key, status: state.status, version: state.version }));
    },
  };
}
