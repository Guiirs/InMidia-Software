import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSyncResourceDefinition } from '../syncRegistry.js';
import { useSyncCore } from '../SyncCoreProvider.jsx';

export function useSyncResource(resourceKey, options = {}) {
  const { store, refreshResource, hasAuth } = useSyncCore();
  const resource = getSyncResourceDefinition(resourceKey);
  const [entry, setEntry] = useState(() => ({ ...store.get(resourceKey) }));

  useEffect(() => store.subscribe(resourceKey, setEntry), [resourceKey, store]);

  useEffect(() => {
    if (options.enabled === false) return;
    if (resource.requiresAuth && !hasAuth()) return;

    const shouldLoad = entry.status === 'idle'
      || (entry.isStale && !entry.isRefreshing && entry.status !== 'unauthorized');

    if (shouldLoad) {
      refreshResource(resourceKey, { reason: entry.status === 'idle' ? 'cache-miss' : 'stale-cache' });
    }
  }, [entry.isRefreshing, entry.isStale, entry.status, hasAuth, options.enabled, refreshResource, resource.requiresAuth, resourceKey]);

  const refresh = useCallback((refreshOptions = {}) => (
    refreshResource(resourceKey, { ...refreshOptions, force: true, reason: refreshOptions.reason ?? 'manual' })
  ), [refreshResource, resourceKey]);

  return useMemo(() => ({
    data: entry.data,
    status: entry.status,
    error: entry.error,
    refresh,
    isStale: entry.isStale,
    isRefreshing: entry.isRefreshing,
    lastFetchedAt: entry.lastFetchedAt,
    lastSuccessAt: entry.lastSuccessAt,
    source: entry.source,
  }), [entry, refresh]);
}
