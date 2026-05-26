export function applyOptimisticUpdate(store, resourceKey, updater) {
  const previous = store.get(resourceKey).data;
  const next = typeof updater === 'function' ? updater(previous) : updater;
  store.transition(resourceKey, { type: 'success', data: next, source: 'optimistic' });
  return () => {
    store.transition(resourceKey, { type: 'success', data: previous, source: 'rollback' });
  };
}
