import { authFailureStatus } from '../auth/authSessionGuard.js';
import { isCacheFresh, isWithinStaleWhileRevalidate } from '../cache/cachePolicies.js';
import { executeRequest } from '../requests/requestExecutor.js';

export async function refreshResourceLifecycle({
  resourceKey,
  resource,
  store,
  deduplicator,
  metrics,
  devtools,
  hasAuth,
  options = {},
}) {
  const current = store.get(resourceKey);
  const traceId = devtools?.traces?.startTrace?.({
    type: 'resource',
    name: `refresh:${resourceKey}`,
    domain: resource.domain,
    resourceKey,
    metadata: { reason: options.reason, force: options.force },
  });
  const endMeasure = devtools?.performance?.measure?.('resource.refresh', { resourceKey, domain: resource.domain });

  if (!options.force && isCacheFresh(current, resource)) {
    metrics.increment('cacheHits');
    store.transition(resourceKey, { type: 'blocked-by-cache' });
    devtools?.record?.({
      type: 'resource',
      domain: resource.domain,
      resourceKey,
      event: 'resource.cache-hit',
      metadata: { status: current.status },
    });
    devtools?.traces?.endTrace?.(traceId, { status: 'cache-hit' });
    endMeasure?.();
    return current.data;
  }

  metrics.increment('cacheMisses');

  if (current.refreshCount >= 10) {
    devtools?.telemetry?.warn?.({
      type: 'refresh-excessive',
      resourceKey,
      domain: resource.domain,
      event: 'resource.refresh-excessive',
      metadata: { refreshCount: current.refreshCount },
    });
  }

  if (resource.requiresAuth && !hasAuth()) {
    store.transition(resourceKey, {
      type: 'failure',
      status: 'unauthorized',
      error: new Error('Unauthorized resource sync blocked by auth guard.'),
    });
    devtools?.record?.({
      type: 'auth',
      domain: resource.domain,
      resourceKey,
      event: 'resource.auth-blocked',
      metadata: { requiresAuth: resource.requiresAuth },
    });
    devtools?.traces?.endTrace?.(traceId, { status: 'unauthorized' });
    endMeasure?.();
    return current.data;
  }

  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    store.transition(resourceKey, {
      type: 'failure',
      status: 'offline',
      error: new Error('Offline'),
    });
    devtools?.record?.({
      type: 'resource',
      domain: resource.domain,
      resourceKey,
      event: 'resource.offline',
    });
    devtools?.traces?.endTrace?.(traceId, { status: 'offline' });
    endMeasure?.();
    return current.data;
  }

  store.transition(resourceKey, { type: 'loading' });
  devtools?.record?.({
    type: 'resource',
    domain: resource.domain,
    resourceKey,
    event: 'resource.loading',
    metadata: { reason: options.reason, propagationDepth: options.propagationDepth },
  });

  const { promise, deduped } = deduplicator.run(resourceKey, () => (
    executeRequest(resource.fetcher, { retryPolicy: resource.retryPolicy, metrics })
  ));

  if (deduped) {
    store.transition(resourceKey, { type: 'deduped' });
    devtools?.record?.({
      type: 'resource',
      domain: resource.domain,
      resourceKey,
      event: 'resource.deduped',
    });
  }

  try {
    const data = await promise;
    store.transition(resourceKey, { type: 'success', data, source: 'api' });
    devtools?.record?.({
      type: 'resource',
      domain: resource.domain,
      resourceKey,
      event: 'resource.refreshed',
      metadata: { source: 'api' },
    });
    metrics?.setGauge?.('staleResourceCount', store.keys().filter((key) => store.get(key).isStale).length);
    devtools?.traces?.endTrace?.(traceId, { status: 'completed' });
    endMeasure?.();
    return data;
  } catch (error) {
    const authStatus = authFailureStatus(error);
    const status = authStatus || (current.data && isWithinStaleWhileRevalidate(current, resource) ? 'stale' : 'error');
    store.transition(resourceKey, { type: 'failure', status, error });
    if (status === 'stale' && current.lastSuccessAt && Date.now() - current.lastSuccessAt > (resource.staleWhileRevalidate ?? 5 * 60_000)) {
      devtools?.telemetry?.warn?.({
        type: 'stale-permanent',
        resourceKey,
        domain: resource.domain,
        event: 'resource.stale-permanent',
        metadata: { message: error?.message },
      });
    }
    devtools?.record?.({
      type: status === 'stale' ? 'resource' : 'auth',
      domain: resource.domain,
      resourceKey,
      event: status === 'stale' ? 'resource.stale' : `resource.${status}`,
      metadata: { message: error?.message },
    });
    metrics?.setGauge?.('staleResourceCount', store.keys().filter((key) => store.get(key).isStale).length);
    devtools?.traces?.endTrace?.(traceId, { status });
    endMeasure?.();
    return current.data;
  }
}
