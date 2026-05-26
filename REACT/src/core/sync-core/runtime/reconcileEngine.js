function replaceItemById(current, serverData) {
  if (!Array.isArray(current) || !serverData?.id) return serverData;
  return current.map((item) => item?.id === serverData.id ? { ...item, ...serverData } : item);
}

export function createReconcileEngine({ store, metrics }) {
  return {
    reconcile(config, result, variables, options = {}) {
      const policy = config.reconcilePolicy ?? 'server-wins';
      if (policy === 'none') return result;

      (config.reconcile ?? config.optimisticUpdates ?? []).forEach(({ resourceKey, resolver }) => {
        if (options.shouldReconcileResource && !options.shouldReconcileResource(resourceKey)) return;
        const current = store.get(resourceKey).data;
        const next = resolver
          ? resolver(current, result, variables)
          : policy === 'server-wins'
            ? replaceItemById(current, result)
            : current;

        if (next !== current) {
          store.transition(resourceKey, { type: 'success', data: next, source: 'server-reconcile' });
          metrics?.increment?.('mutationsReconciled');
        }
      });

      return result;
    },
  };
}
