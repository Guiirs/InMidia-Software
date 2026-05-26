export function createRollbackManager({ store, metrics }) {
  return {
    capture(updates, variables) {
      return (updates ?? []).map(({ resourceKey, updater }) => {
        const previous = store.get(resourceKey).data;
        const next = typeof updater === 'function' ? updater(previous, variables) : updater;
        const optimisticState = store.transition(resourceKey, { type: 'success', data: next, source: 'optimistic' });
        return { resourceKey, previous, optimisticVersion: optimisticState.version };
      });
    },

    rollback(snapshots) {
      snapshots.slice().reverse().forEach(({ resourceKey, previous }) => {
        store.transition(resourceKey, { type: 'success', data: previous, source: 'rollback' });
      });
      if (snapshots.length) metrics?.increment?.('optimisticRollbacks');
    },

    rollbackIfUnchanged(snapshots) {
      snapshots.slice().reverse().forEach(({ resourceKey, previous, optimisticVersion }) => {
        if (store.get(resourceKey).version === optimisticVersion) {
          store.transition(resourceKey, { type: 'success', data: previous, source: 'rollback' });
        }
      });
      if (snapshots.length) metrics?.increment?.('optimisticRollbacks');
    },
  };
}
