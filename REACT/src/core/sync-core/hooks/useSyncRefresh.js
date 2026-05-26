import { useCallback } from 'react';
import { useSyncCore } from '../SyncCoreProvider.jsx';

export function useSyncRefresh() {
  const { invalidateResource, invalidateByEvent, refreshResource } = useSyncCore();
  return {
    invalidateResource,
    invalidateByEvent,
    refreshResource: useCallback((resourceKey, options = {}) => (
      refreshResource(resourceKey, { ...options, force: true, reason: options.reason ?? 'manual' })
    ), [refreshResource]),
  };
}
