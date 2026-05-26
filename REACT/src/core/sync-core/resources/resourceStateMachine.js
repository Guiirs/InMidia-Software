export const RESOURCE_STATUSES = {
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  refreshing: 'refreshing',
  stale: 'stale',
  error: 'error',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  offline: 'offline',
};

export function createInitialResourceState() {
  return {
    data: null,
    status: RESOURCE_STATUSES.idle,
    error: null,
    lastFetchedAt: 0,
    lastSuccessAt: 0,
    lastAccessedAt: 0,
    isRefreshing: false,
    isStale: true,
    source: 'empty',
    version: 0,
    subscribers: new Set(),
    dedupeCount: 0,
    refreshCount: 0,
    blockedByCacheCount: 0,
  };
}

export function reduceResourceState(current, event) {
  const version = current.version + 1;

  if (event.type === 'blocked-by-cache') {
    return { ...current, blockedByCacheCount: current.blockedByCacheCount + 1 };
  }

  if (event.type === 'deduped') {
    return { ...current, dedupeCount: current.dedupeCount + 1 };
  }

  if (event.type === 'stale') {
    return {
      ...current,
      status: current.data ? RESOURCE_STATUSES.stale : current.status,
      isStale: true,
      version,
    };
  }

  if (event.type === 'loading') {
    return {
      ...current,
      status: current.data ? RESOURCE_STATUSES.refreshing : RESOURCE_STATUSES.loading,
      isRefreshing: true,
      error: null,
      refreshCount: current.refreshCount + 1,
      version,
    };
  }

  if (event.type === 'success') {
    const now = Date.now();
    return {
      ...current,
      data: event.data,
      status: RESOURCE_STATUSES.success,
      error: null,
      lastFetchedAt: now,
      lastSuccessAt: now,
      lastAccessedAt: now,
      isRefreshing: false,
      isStale: false,
      source: event.source ?? 'api',
      version,
    };
  }

  if (event.type === 'failure') {
    const nextStatus = event.status ?? (current.data ? RESOURCE_STATUSES.stale : RESOURCE_STATUSES.error);
    return {
      ...current,
      status: nextStatus,
      error: event.error,
      lastAccessedAt: Date.now(),
      isRefreshing: false,
      isStale: Boolean(current.data),
      version,
    };
  }

  if (event.type === 'clear') {
    const subscribers = current.subscribers;
    return { ...createInitialResourceState(), subscribers };
  }

  return current;
}
