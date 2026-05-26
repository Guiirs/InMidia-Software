import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { hasValidSyncSession } from './auth/authSessionGuard.js';
import { createAuthSyncState } from './auth/authSyncState.js';
import { createSyncCacheStore } from './cache/syncCacheStore.js';
import { installSyncDebug } from './debug/syncDebug.js';
import { createSyncMetrics } from './debug/syncMetrics.js';
import { createSyncDevtools, installSyncDevtoolsBridge } from './devtools/syncDevtoolsBridge.js';
import { createMutationManager } from './mutations/mutationManager.js';
import { createRefreshQueue } from './refresh/refreshQueue.js';
import { createRefreshScheduler } from './refresh/refreshScheduler.js';
import RealtimeBridge from './realtime/realtimeBridge.js';
import { getInvalidatedResourcesForEvent } from './realtime/realtimeInvalidationMap.js';
import { createRequestDeduplicator } from './requests/requestDeduplicator.js';
import { refreshResourceLifecycle } from './resources/resourceLifecycle.js';
import { buildDependencyGraph, graphSnapshot } from './runtime/dependencyGraph.js';
import { createPropagationEngine } from './runtime/propagationEngine.js';
import { createRuntimeLifecycle } from './runtime/runtimeLifecycle.js';
import { realtimeInvalidationMap } from './realtime/realtimeInvalidationMap.js';
import { syncAdapters, syncMutationRegistry, syncRegistry } from './syncRegistry.js';

const SyncCoreContext = createContext(null);

export function SyncCoreProvider({ children }) {
  const auth = useAuth();
  const authRef = useRef(auth);
  const storeRef = useRef(null);
  const metricsRef = useRef(null);
  const devtoolsRef = useRef(null);
  const deduplicatorRef = useRef(null);
  const authStateRef = useRef(null);
  const refreshQueueRef = useRef(null);
  const schedulerRef = useRef(null);
  const mutationManagerRef = useRef(null);
  const graphRef = useRef(null);
  const propagationRef = useRef(null);
  const runtimeRef = useRef(null);

  if (!storeRef.current) storeRef.current = createSyncCacheStore();
  if (!metricsRef.current) metricsRef.current = createSyncMetrics();
  if (!devtoolsRef.current) devtoolsRef.current = createSyncDevtools();
  if (!deduplicatorRef.current) deduplicatorRef.current = createRequestDeduplicator(metricsRef.current);
  if (!authStateRef.current) authStateRef.current = createAuthSyncState();
  if (!graphRef.current) graphRef.current = buildDependencyGraph(syncRegistry);
  if (!propagationRef.current) {
    propagationRef.current = createPropagationEngine({
      registry: syncRegistry,
      graph: graphRef.current,
      eventMap: realtimeInvalidationMap,
      metrics: metricsRef.current,
      devtools: devtoolsRef.current,
    });
  }
  if (!runtimeRef.current) runtimeRef.current = createRuntimeLifecycle(metricsRef.current);

  useEffect(() => {
    runtimeRef.current.start();
    return () => {
      refreshQueueRef.current?.clear();
      deduplicatorRef.current?.clear();
      mutationManagerRef.current?.clear();
      runtimeRef.current.stop();
    };
  }, []);

  useEffect(() => {
    authRef.current = auth;
    if (hasValidSyncSession(auth)) authStateRef.current.unblock();
  }, [auth]);

  const hasAuth = useCallback(() => hasValidSyncSession(authRef.current) && !authStateRef.current.isBlocked(), []);

  const refreshResource = useCallback((resourceKey, options = {}) => {
    const resource = syncRegistry[resourceKey];
    if (!resource) throw new Error(`[sync-core] Resource not registered: ${resourceKey}`);

    return refreshResourceLifecycle({
      resourceKey,
      resource,
      store: storeRef.current,
      deduplicator: deduplicatorRef.current,
      metrics: metricsRef.current,
      devtools: devtoolsRef.current,
      hasAuth,
      options,
    });
  }, [hasAuth]);

  if (!refreshQueueRef.current) {
    refreshQueueRef.current = createRefreshQueue({
      refreshResource,
      registry: syncRegistry,
      metrics: metricsRef.current,
      devtools: devtoolsRef.current,
    });
  }

  if (!schedulerRef.current) {
    schedulerRef.current = createRefreshScheduler(refreshQueueRef.current, devtoolsRef.current);
  }

  const invalidateResource = useCallback((resourceKey, options = {}) => {
    const plan = propagationRef.current.planFromResources([resourceKey], options);
    const resource = syncRegistry[resourceKey];
    plan.forEach((item) => storeRef.current.transition(item.key, { type: 'stale' }));
    devtoolsRef.current.record({
      type: 'invalidation',
      domain: resource?.domain,
      resourceKey,
      event: 'resource.invalidated',
      metadata: { options, planSize: plan.length },
    });
    schedulerRef.current.invalidatePlan(plan, options);
  }, []);

  const invalidateByEvent = useCallback((eventType, options = {}) => {
    devtoolsRef.current.record({
      type: 'realtime',
      event: 'realtime.event',
      metadata: { eventType, options },
    });
    const plan = propagationRef.current.planFromEvent({ type: eventType, source: options.source ?? 'realtime' }, options);
    if (!plan.length) {
      const resources = getInvalidatedResourcesForEvent(eventType, syncRegistry);
      if (!resources.length) return;
      devtoolsRef.current.record({
        type: 'invalidation',
        event: 'realtime.fallback-invalidation',
        metadata: { eventType, resources },
      });
      schedulerRef.current.invalidateMany(resources, { ...options, reason: `realtime:${eventType}` });
      return;
    }
    metricsRef.current.increment('realtimeInvalidations');
    schedulerRef.current.invalidatePlan(plan, { ...options, reason: `realtime:${eventType}` });
  }, []);

  const planInvalidation = useCallback((resourceKey, options = {}) => (
    propagationRef.current.planFromResources([resourceKey], options)
  ), []);

  const clearProtectedCache = useCallback((reason = 'auth') => {
    devtoolsRef.current.record({
      type: 'auth',
      event: reason === 'auth-expired' ? 'auth.expired' : 'auth.cache-cleared',
      metadata: { reason },
    });
    refreshQueueRef.current.clear();
    deduplicatorRef.current.clear();
    Object.values(syncRegistry).forEach((resource) => {
      if (resource.requiresAuth) storeRef.current.clear(resource.key);
    });
    if (reason === 'auth-expired') metricsRef.current.increment('authExpirations');
  }, []);

  if (!mutationManagerRef.current) {
    mutationManagerRef.current = createMutationManager({
      store: storeRef.current,
      invalidateResource,
      metrics: metricsRef.current,
      devtools: devtoolsRef.current,
      hasAuth,
    });
  }

  useEffect(() => {
    if (!hasValidSyncSession(auth)) {
      authStateRef.current.block();
      clearProtectedCache(auth.sessionExpired ? 'auth-expired' : 'auth');
    }
  }, [auth.isAuthenticated, auth.sessionExpired, auth.token, clearProtectedCache]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    registry: syncRegistry,
    adapters: syncAdapters,
    mutationRegistry: syncMutationRegistry,
    store: storeRef.current,
    metrics: metricsRef.current,
    devtools: devtoolsRef.current,
    deduplicator: deduplicatorRef.current,
    refreshQueue: refreshQueueRef.current,
    scheduler: schedulerRef.current,
    mutationManager: mutationManagerRef.current,
    mutationRuntime: mutationManagerRef.current.runtime,
    runtime: runtimeRef.current,
    refreshResource,
    invalidateResource,
    invalidateByEvent,
    planInvalidation,
    getDependencyGraph: () => graphSnapshot(graphRef.current),
    clearProtectedCache,
    hasAuth,
  }), [clearProtectedCache, hasAuth, invalidateByEvent, invalidateResource, planInvalidation, refreshResource]);

  useEffect(() => {
    // Devtools habilitados somente em DEV local; em produção via feature flag syncDevtools
    const devEnabled = import.meta.env.DEV;
    const cleanupDebug = installSyncDebug(value, { forceDev: devEnabled });
    const cleanupDevtools = installSyncDevtoolsBridge(value, { forceDev: devEnabled });
    return () => {
      cleanupDebug?.();
      cleanupDevtools?.();
    };
  }, [value]);

  return (
    <SyncCoreContext.Provider value={value}>
      <RealtimeBridge invalidateByEvent={invalidateByEvent} clearProtectedCache={clearProtectedCache} devtools={devtoolsRef.current} />
      {children}
    </SyncCoreContext.Provider>
  );
}

export function useSyncCore() {
  const context = useContext(SyncCoreContext);
  if (!context) throw new Error('[sync-core] useSyncCore must be used inside SyncCoreProvider');
  return context;
}
