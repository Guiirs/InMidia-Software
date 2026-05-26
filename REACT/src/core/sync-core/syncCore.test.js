import { describe, expect, it, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSyncCacheStore } from './cache/syncCacheStore.js';
import { isCacheFresh } from './cache/cachePolicies.js';
import { createMutationManager } from './mutations/mutationManager.js';
import { createRefreshQueue } from './refresh/refreshQueue.js';
import { createRefreshScheduler } from './refresh/refreshScheduler.js';
import { createRequestDeduplicator } from './requests/requestDeduplicator.js';
import { refreshResourceLifecycle } from './resources/resourceLifecycle.js';
import { createSyncMetrics } from './debug/syncMetrics.js';
import { createSyncTelemetry } from './debug/syncTelemetry.js';
import { installSyncDebug } from './debug/syncDebug.js';
import { createSyncDevtools, installSyncDevtoolsBridge } from './devtools/syncDevtoolsBridge.js';
import { createSyncTimeline } from './devtools/syncTimeline.js';
import { createSyncTraceStore } from './devtools/syncTraceStore.js';
import { getInvalidatedResourcesForEvent } from './realtime/realtimeInvalidationMap.js';
import { installRealtimeBridgeListeners } from './realtime/realtimeBridge.js';
import { buildDependencyGraph, getDependents } from './runtime/dependencyGraph.js';
import { createPropagationEngine } from './runtime/propagationEngine.js';
import { syncAdapters, syncMutationRegistry, syncRegistry } from './syncRegistry.js';
import { realtimeInvalidationMap } from './realtime/realtimeInvalidationMap.js';

describe('sync core primitives', () => {
  it('builds resource and mutation registries from domain adapters', () => {
    expect(syncAdapters.map((adapter) => adapter.domain)).toEqual(expect.arrayContaining([
      'inventory',
      'dashboard',
      'contracts',
      'commercial',
      'alerts',
      'reports',
      'operations',
    ]));
    expect(syncRegistry['inventory.summary'].domain).toBe('inventory');
    expect(syncRegistry['inventory.boards'].fetcher).toEqual(expect.any(Function));
    expect(syncRegistry['inventory.regions'].dependencies).toEqual(expect.arrayContaining([
      'inventory.boards',
      'inventory.summary',
    ]));
    expect(syncMutationRegistry['inventory.board.update'].domain).toBe('inventory');
  });

  it('builds realtime invalidation map from domain adapters', () => {
    expect(realtimeInvalidationMap.PLACA_UPDATED).toEqual(expect.arrayContaining([
      'inventory.summary',
      'inventory.boards',
      'inventory.regions',
      'dashboard.kpis',
    ]));
  });

  it('deduplicates identical resource requests', async () => {
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    const fetcher = vi.fn(async () => 'ok');

    const first = dedupe.run('inventory.summary', fetcher);
    const second = dedupe.run('inventory.summary', fetcher);

    expect(first.promise).toBe(second.promise);
    await expect(first.promise).resolves.toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(metrics.getStats().requestsDeduplicated).toBe(1);
  });

  it('honors cache TTL and force refresh', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    const fetcher = vi.fn(async () => ({ count: fetcher.mock.calls.length }));
    const resource = { key: 'inventory.summary', fetcher, ttlMs: 60_000, requiresAuth: false };

    await refreshResourceLifecycle({ resourceKey: resource.key, resource, store, deduplicator: dedupe, metrics, hasAuth: () => true });
    await refreshResourceLifecycle({ resourceKey: resource.key, resource, store, deduplicator: dedupe, metrics, hasAuth: () => true });
    await refreshResourceLifecycle({ resourceKey: resource.key, resource, store, deduplicator: dedupe, metrics, hasAuth: () => true, options: { force: true } });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(isCacheFresh(store.get(resource.key), resource)).toBe(true);
  });

  it('records resource refreshes in the devtools timeline', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const devtools = createSyncDevtools();
    const dedupe = createRequestDeduplicator(metrics);
    const resource = {
      key: 'inventory.summary',
      domain: 'inventory',
      fetcher: vi.fn(async () => ({ total: 3 })),
      ttlMs: 0,
      requiresAuth: false,
    };

    await refreshResourceLifecycle({
      resourceKey: resource.key,
      resource,
      store,
      deduplicator: dedupe,
      metrics,
      devtools,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(devtools.timeline.list({ resourceKey: resource.key }).map((item) => item.event)).toEqual([
      'resource.loading',
      'resource.refreshed',
    ]);
    expect(devtools.traces.list({ resourceKey: resource.key })[0].status).toBe('completed');
    expect(devtools.performance.summary()['resource.refresh'].count).toBe(1);
  });

  it('blocks unauthorized protected resources', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    const fetcher = vi.fn();
    const resource = { key: 'auth.profile', fetcher, ttlMs: 60_000, requiresAuth: true };

    await refreshResourceLifecycle({ resourceKey: resource.key, resource, store, deduplicator: dedupe, metrics, hasAuth: () => false });

    expect(fetcher).not.toHaveBeenCalled();
    expect(store.get(resource.key).status).toBe('unauthorized');
  });

  it('cancels queued refreshes', () => {
    vi.useFakeTimers();
    const refreshResource = vi.fn();
    const metrics = createSyncMetrics();
    const queue = createRefreshQueue({ refreshResource, registry: {}, metrics, debounceMs: 50 });

    queue.enqueue('inventory.summary');
    queue.cancel('inventory.summary');
    vi.advanceTimersByTime(120);

    expect(refreshResource).not.toHaveBeenCalled();
    expect(metrics.getStats().refreshesCancelled).toBe(1);
    vi.useRealTimers();
  });

  it('auth expired queue cleanup cancels scheduled refreshes', () => {
    vi.useFakeTimers();
    const refreshResource = vi.fn();
    const queue = createRefreshQueue({ refreshResource, registry: {}, metrics: createSyncMetrics(), debounceMs: 50 });

    queue.enqueue('inventory.summary');
    queue.clear();
    vi.advanceTimersByTime(120);

    expect(refreshResource).not.toHaveBeenCalled();
    expect(queue.snapshot()).toEqual([]);
    vi.useRealTimers();
  });

  it('scheduler debounces repeated invalidations for the same resource', () => {
    vi.useFakeTimers();
    const refreshResource = vi.fn();
    const queue = createRefreshQueue({ refreshResource, registry: {}, metrics: createSyncMetrics(), debounceMs: 50 });

    queue.enqueue('inventory.summary');
    queue.enqueue('inventory.summary');
    queue.enqueue('inventory.summary');
    vi.advanceTimersByTime(120);

    expect(refreshResource).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('scheduler dedupes invalidation plans before enqueueing', () => {
    const queue = { enqueue: vi.fn(), cancel: vi.fn(), clear: vi.fn() };
    const scheduler = createRefreshScheduler(queue);

    scheduler.invalidatePlan([
      { key: 'inventory.summary', reason: 'a' },
      { key: 'inventory.summary', reason: 'b' },
    ]);

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledWith('inventory.summary', expect.objectContaining({ reason: 'b' }));
  });

  it('scheduler does not run concurrent refreshes for the same resource', async () => {
    vi.useFakeTimers();
    let release;
    const refreshResource = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const queue = createRefreshQueue({ refreshResource, registry: {}, metrics: createSyncMetrics(), debounceMs: 20 });

    queue.enqueue('inventory.summary');
    vi.advanceTimersByTime(120);
    queue.enqueue('inventory.summary');
    vi.advanceTimersByTime(120);

    expect(refreshResource).toHaveBeenCalledTimes(1);
    release();
    await Promise.resolve();
    vi.advanceTimersByTime(120);

    expect(refreshResource).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('maps realtime events to invalidated resources', () => {
    expect(getInvalidatedResourcesForEvent('PLACA_UPDATED', {})).toContain('inventory.summary');
    expect(getInvalidatedResourcesForEvent('PLACA_UPDATED', {})).toContain('inventory.boards');
    expect(getInvalidatedResourcesForEvent('inventory.board.availability.changed', syncRegistry)).toContain('inventory.regions');
  });

  it('registers canonical dashboard resources', () => {
    expect(Object.keys(syncRegistry)).toEqual(expect.arrayContaining([
      'dashboard.kpis',
      'dashboard.overview',
      'dashboard.activity',
      'dashboard.performance',
      'dashboard.alertsSummary',
    ]));
    expect(syncRegistry['dashboard.kpis']).toEqual(expect.objectContaining({
      domain: 'dashboard',
      productionMockAllowed: false,
      fallbackPolicy: 'keep-last-valid',
    }));
  });

  it('dashboard.kpis depends on inventory, contracts and commercial resources', () => {
    expect(syncRegistry['dashboard.kpis'].dependencies).toEqual([
      'inventory.summary',
      'contracts.summary',
      'commercial.pipeline',
    ]);
  });

  it('registers canonical contracts resources and mutations', () => {
    expect(Object.keys(syncRegistry)).toEqual(expect.arrayContaining([
      'contracts.summary',
      'contracts.list',
      'contracts.active',
      'contracts.expiring',
      'contracts.timeline',
    ]));
    expect(Object.keys(syncMutationRegistry)).toEqual(expect.arrayContaining([
      'contracts.create',
      'contracts.update',
      'contracts.status.change',
      'contracts.cancel',
      'contracts.renew',
    ]));
    expect(syncRegistry['contracts.summary']).toEqual(expect.objectContaining({
      domain: 'contracts',
      fallbackPolicy: 'keep-last-valid',
      productionMockAllowed: false,
    }));
  });

  it('contracts.summary depends on contracts.list', () => {
    expect(syncRegistry['contracts.summary'].dependencies).toEqual(['contracts.list']);
  });

  it('contract.updated invalidates contracts summary and dashboard kpis', () => {
    expect(realtimeInvalidationMap['contract.updated']).toEqual(expect.arrayContaining([
      'contracts.list',
      'contracts.summary',
      'dashboard.kpis',
    ]));
  });

  it('registers canonical commercial resources and mutations', () => {
    expect(Object.keys(syncRegistry)).toEqual(expect.arrayContaining([
      'commercial.pipeline',
      'commercial.opportunities',
      'commercial.proposals',
      'commercial.conversions',
      'commercial.activities',
    ]));
    expect(Object.keys(syncMutationRegistry)).toEqual(expect.arrayContaining([
      'commercial.opportunity.create',
      'commercial.opportunity.update',
      'commercial.opportunity.stage.change',
      'commercial.proposal.create',
      'commercial.proposal.update',
      'commercial.proposal.convert',
      'commercial.activity.create',
    ]));
    expect(syncRegistry['commercial.pipeline']).toEqual(expect.objectContaining({
      domain: 'commercial',
      fallbackPolicy: 'keep-last-valid',
      productionMockAllowed: false,
    }));
  });

  it('commercial.pipeline depends on contracts.summary', () => {
    expect(syncRegistry['commercial.pipeline'].dependencies).toEqual(['contracts.summary']);
  });

  it('commercial opportunity updates invalidate pipeline and dashboard kpis', () => {
    expect(realtimeInvalidationMap['commercial.opportunity.updated']).toEqual(expect.arrayContaining([
      'commercial.opportunities',
      'commercial.pipeline',
      'dashboard.kpis',
    ]));
  });

  it('proposal conversion invalidates conversions, contracts summary and dashboard kpis', () => {
    expect(realtimeInvalidationMap['commercial.proposal.converted']).toEqual(expect.arrayContaining([
      'commercial.conversions',
      'commercial.pipeline',
      'contracts.summary',
      'dashboard.kpis',
    ]));
  });

  it('registers canonical alerts resources and mutations', () => {
    expect(Object.keys(syncRegistry)).toEqual(expect.arrayContaining([
      'alerts.list',
      'alerts.summary',
      'alerts.critical',
      'alerts.unread',
      'alerts.byDomain',
    ]));
    expect(Object.keys(syncMutationRegistry)).toEqual(expect.arrayContaining([
      'alerts.markRead',
      'alerts.markAllRead',
      'alerts.dismiss',
      'alerts.resolve',
      'alerts.createManual',
    ]));
    expect(syncRegistry['alerts.list']).toEqual(expect.objectContaining({
      domain: 'alerts',
      fallbackPolicy: 'keep-last-valid',
      productionMockAllowed: false,
    }));
  });

  it('alerts.summary depends on alerts.list', () => {
    expect(syncRegistry['alerts.summary'].dependencies).toEqual(['alerts.list']);
    expect(syncRegistry['dashboard.alertsSummary'].dependencies).toEqual(['alerts.summary']);
  });

  it('alert.created invalidates list, summary, unread and dashboard alert summary', () => {
    expect(realtimeInvalidationMap['alert.created']).toEqual(expect.arrayContaining([
      'alerts.list',
      'alerts.summary',
      'alerts.unread',
      'dashboard.alertsSummary',
    ]));
  });

  it('alert resolve invalidates critical alerts and dashboard alert summary', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const invalidateResource = vi.fn();
    const manager = createMutationManager({ store, invalidateResource, metrics });
    store.transition('alerts.list', { type: 'success', data: [{ id: 'alert-1', status: 'open', severity: 'critical', lido: false }] });

    await manager.run({
      ...syncMutationRegistry['alerts.resolve'],
      mutationFn: async () => ({ id: 'alert-1', status: 'resolved', lido: true }),
    }, { id: 'alert-1' });

    expect(invalidateResource).toHaveBeenCalledWith('alerts.critical', expect.objectContaining({
      includeDependents: true,
      reason: 'mutation:alerts.resolve',
    }));
    expect(invalidateResource).toHaveBeenCalledWith('dashboard.alertsSummary', expect.objectContaining({
      includeDependents: true,
      reason: 'mutation:alerts.resolve',
    }));
  });

  it('registers canonical operations resources and mutations', () => {
    expect(Object.keys(syncRegistry)).toEqual(expect.arrayContaining([
      'operations.timeline',
      'operations.summary',
      'operations.tasks',
      'operations.pending',
      'operations.byDomain',
    ]));
    expect(Object.keys(syncMutationRegistry)).toEqual(expect.arrayContaining([
      'operations.task.create',
      'operations.task.update',
      'operations.task.complete',
      'operations.task.assign',
      'operations.event.create',
    ]));
    expect(syncRegistry['operations.timeline']).toEqual(expect.objectContaining({
      domain: 'operations',
      fallbackPolicy: 'keep-last-valid',
      productionMockAllowed: false,
    }));
  });

  it('operations.summary depends on timeline and alerts summary', () => {
    expect(syncRegistry['operations.summary'].dependencies).toEqual([
      'operations.timeline',
      'alerts.summary',
    ]);
    expect(syncRegistry['dashboard.activity'].dependencies).toEqual(expect.arrayContaining([
      'operations.timeline',
    ]));
  });

  it('operations event creation invalidates timeline and dashboard activity', () => {
    expect(realtimeInvalidationMap['operations.event.created']).toEqual(expect.arrayContaining([
      'operations.timeline',
      'dashboard.activity',
    ]));
  });

  it('registers canonical reports resources and mutations', () => {
    expect(Object.keys(syncRegistry)).toEqual(expect.arrayContaining([
      'reports.summary',
      'reports.analytics',
      'reports.exports',
      'reports.byPeriod',
      'reports.byDomain',
    ]));
    expect(Object.keys(syncMutationRegistry)).toEqual(expect.arrayContaining([
      'reports.export.create',
      'reports.export.cancel',
      'reports.schedule.create',
      'reports.schedule.update',
      'reports.schedule.delete',
    ]));
    expect(syncRegistry['reports.summary']).toEqual(expect.objectContaining({
      domain: 'reports',
      fallbackPolicy: 'keep-last-valid',
      productionMockAllowed: false,
    }));
  });

  it('reports.summary depends on the main migrated domains', () => {
    expect(syncRegistry['reports.summary'].dependencies).toEqual([
      'inventory.summary',
      'contracts.summary',
      'commercial.conversions',
      'operations.summary',
    ]);
    expect(syncRegistry['dashboard.performance'].dependencies).toEqual(['reports.summary']);
  });

  it('report updates invalidate report analytics and dashboard performance', () => {
    expect(realtimeInvalidationMap['report.updated']).toEqual(expect.arrayContaining([
      'reports.summary',
      'reports.analytics',
      'dashboard.performance',
    ]));
  });

  it('invalidating inventory.summary marks dashboard.kpis stale through propagation', () => {
    const store = createSyncCacheStore();
    const graph = buildDependencyGraph(syncRegistry);
    const engine = createPropagationEngine({
      registry: syncRegistry,
      graph,
      eventMap: realtimeInvalidationMap,
      metrics: createSyncMetrics(),
    });

    store.transition('dashboard.kpis', { type: 'success', data: { total: 1 } });
    engine.planFromResources(['inventory.summary']).forEach((item) => {
      store.transition(item.key, { type: 'stale' });
    });

    expect(store.get('dashboard.kpis').status).toBe('stale');
    expect(store.get('dashboard.kpis').data).toEqual({ total: 1 });
  });

  it('DashboardProvider does not import direct API clients or services', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/v4-painel/providers/DashboardProvider.jsx'), 'utf8');

    expect(source).not.toMatch(/apiClient|axios|fetch\s*\(|integration\/services|services\//);
  });

  it('ContractsProvider does not import direct API clients or services', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/v4-painel/providers/ContractsProvider.jsx'), 'utf8');

    expect(source).not.toMatch(/apiClient|axios|fetch\s*\(|integration\/services|services\//);
  });

  it('CommercialProvider does not import direct API clients or services', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/v4-painel/providers/CommercialProvider.jsx'), 'utf8');

    expect(source).not.toMatch(/apiClient|axios|fetch\s*\(|integration\/services|services\//);
  });

  it('AlertsProvider does not import direct API clients or services', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/v4-painel/providers/AlertsProvider.jsx'), 'utf8');

    expect(source).not.toMatch(/apiClient|axios|fetch\s*\(|integration\/services|services\//);
  });

  it('OperationsProvider does not import direct API clients or services', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/v4-painel/providers/OperationsProvider.jsx'), 'utf8');

    expect(source).not.toMatch(/apiClient|axios|fetch\s*\(|integration\/services|services\//);
  });

  it('ReportsProvider does not import direct API clients or services', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/v4-painel/providers/ReportsProvider.jsx'), 'utf8');

    expect(source).not.toMatch(/apiClient|axios|fetch\s*\(|integration\/services|services\//);
  });

  it('no V4 provider imports direct API clients or services', () => {
    const providersDir = resolve(process.cwd(), 'src/v4-painel/providers');
    const providerFiles = readdirSync(providersDir)
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) => !file.endsWith('.test.jsx'));

    providerFiles.forEach((file) => {
      const source = readFileSync(resolve(providersDir, file), 'utf8');
      expect(source, file).not.toMatch(/apiClient|axios|fetch\s*\(|integration\/services|(?:\.\.\/)+services\//);
    });
  });

  it('legacy V4 data orchestrator has no runtime consumers', () => {
    const root = resolve(process.cwd(), 'src');
    const dataOrchestratorDir = resolve(process.cwd(), 'src/v4-painel/data-orchestrator');

    expect(existsSync(dataOrchestratorDir)).toBe(false);

    function readRuntimeFiles(dir, files = []) {
      readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (!/node_modules|dist|docs|REVIEW_/.test(fullPath)) readRuntimeFiles(fullPath, files);
          return;
        }
        if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(fullPath);
      });
      return files;
    }

    const offenders = readRuntimeFiles(root)
      .filter((file) => !file.includes('core/sync-core/docs'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return /data-orchestrator|useV4Resource|useV4Refresh|v4DataRegistry/.test(source);
      });

    expect(offenders).toEqual([]);
  });

  it('RealtimeProvider is a stream bridge without direct API or fetch', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/v4-painel/providers/RealtimeProvider.jsx'), 'utf8');

    expect(source).not.toMatch(/apiClient|axios|fetch\s*\(|(?:\.\.\/)+services\//);
    expect(source).toMatch(/syncEvents\.realtimeEvent/);
  });

  it('sync boundary allowlist is empty after legacy cleanup', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/check-sync-boundaries.js'), 'utf8');

    expect(source).toMatch(/const legacyAllowlist = \[\];/);
  });

  it('unmount cleanup removes realtime subscriptions', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const replayQueuedInvalidations = vi.fn();

    const cleanup = installRealtimeBridgeListeners({
      target,
      invalidateByEvent: vi.fn(),
      clearProtectedCache: vi.fn(),
      replayQueuedInvalidations,
      devtools: createSyncDevtools(),
    });

    target.addEventListener.mock.calls.find((call) => call[0] === 'sync:realtime-reconnect')[1]({ detail: { queued: 3 } });
    cleanup();

    expect(target.addEventListener).toHaveBeenCalledTimes(3);
    expect(target.removeEventListener).toHaveBeenCalledTimes(3);
    expect(target.removeEventListener.mock.calls.map((call) => call[0])).toEqual([
      'sync:realtime-event',
      'sync:realtime-reconnect',
      'auth:expired',
    ]);
    expect(replayQueuedInvalidations).toHaveBeenCalledWith({ queued: 3 });
  });

  it('builds dependency graph and propagates to dependents', () => {
    const registry = {
      'inventory.boards': { key: 'inventory.boards', dependencies: [] },
      'inventory.summary': { key: 'inventory.summary', dependencies: ['inventory.boards'] },
      'dashboard.kpis': { key: 'dashboard.kpis', dependencies: ['inventory.summary'] },
    };
    const graph = buildDependencyGraph(registry);

    expect(getDependents('inventory.boards', graph)).toEqual(['inventory.summary', 'dashboard.kpis']);
  });

  it('plans smart invalidation from domain events without duplicates', () => {
    const registry = {
      'inventory.boards': { key: 'inventory.boards', dependencies: [], domainEvents: ['inventory.updated'] },
      'inventory.summary': { key: 'inventory.summary', dependencies: ['inventory.boards'] },
      'dashboard.kpis': { key: 'dashboard.kpis', dependencies: ['inventory.summary'] },
    };
    const graph = buildDependencyGraph(registry);
    const engine = createPropagationEngine({
      registry,
      graph,
      eventMap: { 'inventory.updated': ['inventory.boards'] },
      metrics: createSyncMetrics(),
    });

    const plan = engine.planFromEvent('inventory.updated').map((item) => item.key);

    expect(plan).toEqual(['inventory.boards', 'inventory.summary', 'dashboard.kpis']);
  });

  it('handles propagation cycles without breaking the runtime', () => {
    const registry = {
      a: { key: 'a', dependencies: ['c'] },
      b: { key: 'b', dependencies: ['a'] },
      c: { key: 'c', dependencies: ['b'] },
    };
    const graph = buildDependencyGraph(registry);
    const engine = createPropagationEngine({ registry, graph, eventMap: {}, metrics: createSyncMetrics() });

    expect(engine.planFromResources(['a']).map((item) => item.key)).toEqual(['a', 'b', 'c']);
  });

  it('keeps previous data and marks offline when browser is offline', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { onLine: false });

    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    store.transition('inventory.summary', { type: 'success', data: { total: 1 } });

    await refreshResourceLifecycle({
      resourceKey: 'inventory.summary',
      resource: { key: 'inventory.summary', fetcher: vi.fn(), ttlMs: 0, requiresAuth: false },
      store,
      deduplicator: dedupe,
      metrics,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(store.get('inventory.summary').data).toEqual({ total: 1 });
    expect(store.get('inventory.summary').status).toBe('offline');

    vi.unstubAllGlobals();
  });

  it('stale state keeps the last valid dashboard data', () => {
    const store = createSyncCacheStore();
    store.transition('dashboard.kpis', { type: 'success', data: { mainKpis: [{ id: 'one' }] } });
    store.transition('dashboard.kpis', { type: 'stale' });

    expect(store.get('dashboard.kpis').status).toBe('stale');
    expect(store.get('dashboard.kpis').data).toEqual({ mainKpis: [{ id: 'one' }] });
  });

  it('dashboard resource errors keep the panel state recoverable', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);

    await refreshResourceLifecycle({
      resourceKey: 'dashboard.overview',
      resource: {
        key: 'dashboard.overview',
        domain: 'dashboard',
        fetcher: async () => { throw new Error('dashboard failed'); },
        ttlMs: 0,
        requiresAuth: false,
      },
      store,
      deduplicator: dedupe,
      metrics,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(store.get('dashboard.overview').status).toBe('error');
    expect(store.get('dashboard.overview').data).toBe(null);
  });

  it('contract resource errors keep the last valid data stale', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    store.transition('contracts.summary', { type: 'success', data: { summary: { ativos: 1 } } });

    await refreshResourceLifecycle({
      resourceKey: 'contracts.summary',
      resource: {
        key: 'contracts.summary',
        domain: 'contracts',
        fetcher: async () => { throw new Error('contracts failed'); },
        ttlMs: 0,
        staleWhileRevalidate: 60_000,
        requiresAuth: false,
      },
      store,
      deduplicator: dedupe,
      metrics,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(store.get('contracts.summary').status).toBe('stale');
    expect(store.get('contracts.summary').data).toEqual({ summary: { ativos: 1 } });
  });

  it('commercial resource errors keep the last valid data stale', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    store.transition('commercial.pipeline', { type: 'success', data: { pipeline: { stages: [] } } });

    await refreshResourceLifecycle({
      resourceKey: 'commercial.pipeline',
      resource: {
        key: 'commercial.pipeline',
        domain: 'commercial',
        fetcher: async () => { throw new Error('commercial failed'); },
        ttlMs: 0,
        staleWhileRevalidate: 60_000,
        requiresAuth: false,
      },
      store,
      deduplicator: dedupe,
      metrics,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(store.get('commercial.pipeline').status).toBe('stale');
    expect(store.get('commercial.pipeline').data).toEqual({ pipeline: { stages: [] } });
  });

  it('alerts resource errors keep the last valid data stale', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    store.transition('alerts.list', { type: 'success', data: [{ id: 'alert-1' }] });

    await refreshResourceLifecycle({
      resourceKey: 'alerts.list',
      resource: {
        key: 'alerts.list',
        domain: 'alerts',
        fetcher: async () => { throw new Error('alerts failed'); },
        ttlMs: 0,
        staleWhileRevalidate: 60_000,
        requiresAuth: false,
      },
      store,
      deduplicator: dedupe,
      metrics,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(store.get('alerts.list').status).toBe('stale');
    expect(store.get('alerts.list').data).toEqual([{ id: 'alert-1' }]);
  });

  it('operations resource errors keep the last valid data stale', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    store.transition('operations.timeline', { type: 'success', data: [{ id: 'event-1' }] });

    await refreshResourceLifecycle({
      resourceKey: 'operations.timeline',
      resource: {
        key: 'operations.timeline',
        domain: 'operations',
        fetcher: async () => { throw new Error('operations failed'); },
        ttlMs: 0,
        staleWhileRevalidate: 60_000,
        requiresAuth: false,
      },
      store,
      deduplicator: dedupe,
      metrics,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(store.get('operations.timeline').status).toBe('stale');
    expect(store.get('operations.timeline').data).toEqual([{ id: 'event-1' }]);
  });

  it('reports resource errors keep the last valid data stale', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const dedupe = createRequestDeduplicator(metrics);
    store.transition('reports.summary', { type: 'success', data: { executiveReports: [{ id: 'rep-1' }] } });

    await refreshResourceLifecycle({
      resourceKey: 'reports.summary',
      resource: {
        key: 'reports.summary',
        domain: 'reports',
        fetcher: async () => { throw new Error('reports failed'); },
        ttlMs: 0,
        staleWhileRevalidate: 60_000,
        requiresAuth: false,
      },
      store,
      deduplicator: dedupe,
      metrics,
      hasAuth: () => true,
      options: { force: true },
    });

    expect(store.get('reports.summary').status).toBe('stale');
    expect(store.get('reports.summary').data).toEqual({ executiveReports: [{ id: 'rep-1' }] });
  });

  it('rolls back optimistic updates on mutation failure', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const invalidateResource = vi.fn();
    store.transition('inventory.boards', { type: 'success', data: [{ id: '1', name: 'old' }] });
    const manager = createMutationManager({ store, invalidateResource, metrics });

    await expect(manager.run({
      key: 'inventory.board.update',
      mutationFn: async () => { throw new Error('boom'); },
      optimisticUpdates: [{
        resourceKey: 'inventory.boards',
        updater: (boards) => boards.map((board) => ({ ...board, name: 'new' })),
      }],
    })).rejects.toThrow('boom');

    expect(store.get('inventory.boards').data).toEqual([{ id: '1', name: 'old' }]);
    expect(metrics.getStats().optimisticRollbacks).toBe(1);
  });

  it('commits mutation, reconciles server response and invalidates resources', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const invalidateResource = vi.fn();
    store.transition('inventory.boards', { type: 'success', data: [{ id: '1', name: 'old' }] });
    const manager = createMutationManager({ store, invalidateResource, metrics });

    const result = await manager.run({
      key: 'inventory.board.update',
      domain: 'inventory',
      mutationFn: async () => ({ id: '1', name: 'server' }),
      optimistic: true,
      optimisticUpdates: [{
        resourceKey: 'inventory.boards',
        updater: (boards) => boards.map((board) => ({ ...board, name: 'optimistic' })),
      }],
      invalidate: ['inventory.boards'],
    }, { id: '1', name: 'client' });

    expect(result).toEqual({ id: '1', name: 'server' });
    expect(store.get('inventory.boards').data).toEqual([{ id: '1', name: 'server' }]);
    expect(invalidateResource).toHaveBeenCalledWith('inventory.boards', expect.objectContaining({ reason: 'mutation:inventory.board.update' }));
    expect(metrics.getStats().mutationsCommitted).toBe(1);
    expect(metrics.getStats().mutationsReconciled).toBe(1);
  });

  it('records mutation commits and rollbacks in the devtools timeline', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const devtools = createSyncDevtools();
    const invalidateResource = vi.fn();
    store.transition('inventory.boards', { type: 'success', data: [{ id: '1', name: 'old' }] });
    const manager = createMutationManager({ store, invalidateResource, metrics, devtools });

    await manager.run({
      key: 'inventory.board.update',
      domain: 'inventory',
      mutationFn: async () => ({ id: '1', name: 'server' }),
      invalidate: ['inventory.boards'],
    }, { id: '1' });

    await expect(manager.run({
      key: 'inventory.board.update',
      domain: 'inventory',
      mutationFn: async () => { throw new Error('boom'); },
      optimisticUpdates: [{
        resourceKey: 'inventory.boards',
        updater: (boards) => boards.map((board) => ({ ...board, name: 'new' })),
      }],
    })).rejects.toThrow('boom');

    expect(devtools.timeline.list({ mutationKey: 'inventory.board.update' }).map((item) => item.event)).toEqual(expect.arrayContaining([
      'mutation.queued',
      'mutation.committed',
      'mutation.rolled-back',
    ]));
    expect(devtools.performance.summary()['mutation.execute'].count).toBe(2);
  });

  it('mutation rollback preserves newer valid resource data', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({ store, invalidateResource: vi.fn(), metrics });
    store.transition('inventory.boards', { type: 'success', data: [{ id: '1', name: 'old' }] });

    await expect(manager.run({
      key: 'inventory.board.update',
      domain: 'inventory',
      mutationFn: async () => {
        store.transition('inventory.boards', { type: 'success', data: [{ id: '1', name: 'newer' }] });
        throw new Error('boom');
      },
      optimisticUpdates: [{
        resourceKey: 'inventory.boards',
        updater: () => [{ id: '1', name: 'optimistic' }],
      }],
    })).rejects.toThrow('boom');

    expect(store.get('inventory.boards').data).toEqual([{ id: '1', name: 'newer' }]);
  });

  it('contracts.update applies optimistic update and rolls back on failure', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({ store, invalidateResource: vi.fn(), metrics });
    store.transition('contracts.list', { type: 'success', data: [{ id: 'CTR-1', realId: '1', cliente: 'Old' }] });

    await expect(manager.run({
      ...syncMutationRegistry['contracts.update'],
      mutationFn: async () => { throw new Error('boom'); },
    }, { id: '1', cliente: 'New' })).rejects.toThrow('boom');

    expect(store.get('contracts.list').data).toEqual([{ id: 'CTR-1', realId: '1', cliente: 'Old' }]);
    expect(metrics.getStats().optimisticUpdatesApplied).toBe(1);
    expect(metrics.getStats().optimisticRollbacks).toBe(1);
  });

  it('contracts.status.change invalidates dependents', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const invalidateResource = vi.fn();
    const manager = createMutationManager({ store, invalidateResource, metrics });
    store.transition('contracts.list', { type: 'success', data: [{ id: 'CTR-1', realId: '1', status: 'active' }] });

    await manager.run({
      ...syncMutationRegistry['contracts.status.change'],
      mutationFn: async () => ({ id: 'CTR-1', realId: '1', status: 'paused' }),
    }, { id: '1', status: 'paused' });

    expect(invalidateResource).toHaveBeenCalledWith('contracts.summary', expect.objectContaining({
      includeDependents: true,
      reason: 'mutation:contracts.status.change',
    }));
  });

  it('commercial stage change applies optimistic update and rolls back on failure', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({ store, invalidateResource: vi.fn(), metrics });
    store.transition('commercial.opportunities', { type: 'success', data: [{ id: 'opp-1', status: 'Lead' }] });

    await expect(manager.run({
      ...syncMutationRegistry['commercial.opportunity.stage.change'],
      mutationFn: async () => { throw new Error('boom'); },
    }, { id: 'opp-1', stage: 'Fechamento' })).rejects.toThrow('boom');

    expect(store.get('commercial.opportunities').data).toEqual([{ id: 'opp-1', status: 'Lead' }]);
    expect(metrics.getStats().optimisticUpdatesApplied).toBe(1);
    expect(metrics.getStats().optimisticRollbacks).toBe(1);
  });

  it('alerts.markRead applies optimistic update and rolls back on failure', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({ store, invalidateResource: vi.fn(), metrics });
    store.transition('alerts.list', { type: 'success', data: [{ id: 'alert-1', lido: false, read: false }] });

    await expect(manager.run({
      ...syncMutationRegistry['alerts.markRead'],
      mutationFn: async () => { throw new Error('boom'); },
    }, { id: 'alert-1' })).rejects.toThrow('boom');

    expect(store.get('alerts.list').data).toEqual([{ id: 'alert-1', lido: false, read: false }]);
    expect(metrics.getStats().optimisticUpdatesApplied).toBe(1);
    expect(metrics.getStats().optimisticRollbacks).toBe(1);
  });

  it('operations.task.complete applies optimistic update and rolls back on failure', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({ store, invalidateResource: vi.fn(), metrics });
    store.transition('operations.tasks', { type: 'success', data: [{ id: 'task-1', status: 'pending' }] });
    store.transition('operations.pending', { type: 'success', data: [{ id: 'task-1', status: 'pending' }] });

    await expect(manager.run({
      ...syncMutationRegistry['operations.task.complete'],
      mutationFn: async () => { throw new Error('boom'); },
    }, { id: 'task-1' })).rejects.toThrow('boom');

    expect(store.get('operations.tasks').data).toEqual([{ id: 'task-1', status: 'pending' }]);
    expect(store.get('operations.pending').data).toEqual([{ id: 'task-1', status: 'pending' }]);
    expect(metrics.getStats().optimisticUpdatesApplied).toBe(1);
    expect(metrics.getStats().optimisticRollbacks).toBe(1);
  });

  it('reports.export.create goes through mutation runtime and invalidates exports', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const invalidateResource = vi.fn();
    const manager = createMutationManager({ store, invalidateResource, metrics });
    store.transition('reports.exports', { type: 'success', data: [] });

    const result = await manager.run({
      ...syncMutationRegistry['reports.export.create'],
      mutationFn: async () => ({ id: 'export-1', status: 'queued' }),
    }, { id: 'export-1', status: 'queued' });

    expect(result).toEqual({ id: 'export-1', status: 'queued' });
    expect(invalidateResource).toHaveBeenCalledWith('reports.exports', expect.objectContaining({
      includeDependents: true,
      reason: 'mutation:reports.export.create',
    }));
    expect(metrics.getStats().mutationsCommitted).toBe(1);
  });

  it('older mutations do not overwrite newer reconciled state', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({ store, invalidateResource: vi.fn(), metrics });
    store.transition('inventory.boards', { type: 'success', data: [{ id: '1', name: 'base' }] });
    let releaseOld;

    const oldMutation = manager.run({
      key: 'inventory.board.update.old',
      domain: 'inventory',
      queueKey: 'old',
      mutationFn: () => new Promise((resolve) => { releaseOld = () => resolve({ id: '1', name: 'old-server' }); }),
      reconcile: [{ resourceKey: 'inventory.boards' }],
    }, { id: '1' });

    await manager.run({
      key: 'inventory.board.update.new',
      domain: 'inventory',
      queueKey: 'new',
      mutationFn: async () => ({ id: '1', name: 'new-server' }),
      reconcile: [{ resourceKey: 'inventory.boards' }],
    }, { id: '1' });

    releaseOld();
    await oldMutation;

    expect(store.get('inventory.boards').data).toEqual([{ id: '1', name: 'new-server' }]);
  });

  it('blocks protected mutations without auth', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({
      store,
      invalidateResource: vi.fn(),
      metrics,
      hasAuth: () => false,
    });

    await expect(manager.run({
      key: 'inventory.board.update',
      mutationFn: vi.fn(),
      requiresAuth: true,
    }, {})).rejects.toThrow('Mutation unauthorized');

    expect(metrics.getStats().mutationsBlocked).toBe(1);
  });

  it('rejects conflicting mutations when conflict policy is reject', async () => {
    const store = createSyncCacheStore();
    const metrics = createSyncMetrics();
    const manager = createMutationManager({ store, invalidateResource: vi.fn(), metrics });
    let release;
    const first = manager.run({
      key: 'inventory.board.update',
      queueKey: 'board:1',
      mutationFn: () => new Promise((resolve) => { release = () => resolve({ id: '1' }); }),
    }, {});

    await expect(manager.run({
      key: 'inventory.board.update',
      queueKey: 'board:1',
      conflictPolicy: 'reject',
      mutationFn: async () => ({ id: '1' }),
    }, {})).rejects.toThrow('Mutation conflict');

    release();
    await first;
    expect(metrics.getStats().mutationConflicts).toBe(1);
  });

  it('timeline respects its configured limit', () => {
    const timeline = createSyncTimeline({ maxEvents: 2 });

    timeline.record({ event: 'one' });
    timeline.record({ event: 'two' });
    timeline.record({ event: 'three' });

    expect(timeline.list().map((item) => item.event)).toEqual(['two', 'three']);
  });

  it('trace store respects its configured limit', () => {
    const traces = createSyncTraceStore({ maxTraces: 2 });

    traces.startTrace({ name: 'one' });
    traces.startTrace({ name: 'two' });
    traces.startTrace({ name: 'three' });

    expect(traces.list().map((item) => item.name)).toEqual(['two', 'three']);
  });

  it('evicts inactive cache entries under capacity pressure', () => {
    const metrics = createSyncMetrics();
    const store = createSyncCacheStore({ maxEntries: 2, cleanupIntervalMs: 0, metrics });

    store.transition('inventory.one', { type: 'success', data: { id: 1 } });
    store.transition('inventory.two', { type: 'success', data: { id: 2 } });
    store.transition('inventory.three', { type: 'success', data: { id: 3 } });
    store.cleanup({ force: true });

    expect(store.keys().length).toBeLessThanOrEqual(2);
    expect(metrics.getStats().cacheEntryCount).toBeLessThanOrEqual(2);
    expect(metrics.getStats().estimatedMemoryBytes).toBeGreaterThan(0);
  });

  it('keeps the refresh queue bounded under 1000 invalidations', () => {
    vi.useFakeTimers();
    const refreshResource = vi.fn();
    const metrics = createSyncMetrics();
    const queue = createRefreshQueue({
      refreshResource,
      registry: {},
      metrics,
      maxQueuedResources: 100,
      debounceMs: 50,
    });

    for (let index = 0; index < 1000; index += 1) {
      queue.enqueue(`inventory.${index}`);
    }

    expect(queue.snapshot().length).toBeLessThanOrEqual(100);
    expect(metrics.getStats().schedulerQueueSize).toBeLessThanOrEqual(100);
    queue.clear();
    vi.useRealTimers();
  });

  it('prevents starvation with a max wait window', () => {
    vi.useFakeTimers();
    const refreshResource = vi.fn();
    const queue = createRefreshQueue({
      refreshResource,
      registry: {},
      metrics: createSyncMetrics(),
      debounceMs: 1000,
      maxWaitMs: 120,
    });

    queue.enqueue('inventory.summary');
    vi.advanceTimersByTime(60);
    queue.enqueue('inventory.summary');
    vi.advanceTimersByTime(70);

    expect(refreshResource).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('deduplicates runtime telemetry warnings', () => {
    const telemetry = createSyncTelemetry({ dedupingWindowMs: 1000 });

    telemetry.warn({ type: 'queue-congestion', event: 'scheduler.queue-pressure', metadata: { size: 100 } });
    telemetry.warn({ type: 'queue-congestion', event: 'scheduler.queue-pressure', metadata: { size: 100 } });

    expect(telemetry.list({ severity: 'warning' })).toHaveLength(1);
  });

  it('warns on propagation storms and dependency cycles', () => {
    const registry = {
      'inventory.a': { key: 'inventory.a', dependencies: ['inventory.b'], dependents: [], realtimeEvents: [] , domainEvents: [] },
      'inventory.b': { key: 'inventory.b', dependencies: ['inventory.a'], dependents: [], realtimeEvents: [] , domainEvents: [] },
      ...Object.fromEntries(Array.from({ length: 60 }, (_, index) => [
        `inventory.extra-${index}`,
        { key: `inventory.extra-${index}`, dependencies: [], dependents: [], realtimeEvents: [], domainEvents: [] },
      ])),
    };
    const graph = buildDependencyGraph(registry);
    const telemetry = createSyncTelemetry();
    const engine = createPropagationEngine({ registry, graph, eventMap: {}, metrics: createSyncMetrics(), devtools: { telemetry, record: vi.fn() } });

    engine.planFromResources(Object.keys(registry), { includeDependencies: false, includeDependents: false });

    expect(telemetry.list({ event: 'propagation.storm' }).length).toBeGreaterThan(0);
    expect(telemetry.list({ event: 'propagation.dependency-cycle' }).length).toBeGreaterThan(0);
  });

  it('devtools globals cleanup on unmount-like disposal and do not stack', () => {
    vi.stubGlobal('window', {});
    const core = {
      registry: {},
      mutationRegistry: {},
      devtools: createSyncDevtools(),
      refreshQueue: { snapshot: () => [] },
      mutationManager: { getPendingMutations: () => [], getMutationHistory: () => [] },
      store: { snapshot: () => ({}), get: () => ({}) },
      metrics: createSyncMetrics(),
      deduplicator: { pending: () => [] },
      getDependencyGraph: () => ({}),
      runtime: { getState: () => ({ status: 'running' }) },
    };

    const cleanupOne = installSyncDevtoolsBridge(core, { forceDev: true });
    const first = window.__INMIDIA_SYNC_DEVTOOLS__;
    const cleanupTwo = installSyncDevtoolsBridge(core, { forceDev: true });

    expect(window.__INMIDIA_SYNC_DEVTOOLS__).not.toBe(first);
    cleanupTwo();
    expect(window.__INMIDIA_SYNC_DEVTOOLS__).toBe(first);
    cleanupOne();
    expect(window.__INMIDIA_SYNC_DEVTOOLS__).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('production mode does not expose sync debug globals', () => {
    vi.stubGlobal('window', {});
    const core = {
      registry: {},
      adapters: [],
      mutationRegistry: {},
      devtools: createSyncDevtools(),
      refreshQueue: { snapshot: () => [] },
      mutationManager: { getPendingMutations: () => [], getMutationHistory: () => [] },
      store: { snapshot: () => ({}), get: () => ({}) },
      metrics: createSyncMetrics(),
      deduplicator: { pending: () => [] },
      getDependencyGraph: () => ({}),
      runtime: { getState: () => ({ status: 'running' }) },
      invalidateResource: vi.fn(),
      refreshResource: vi.fn(),
      clearProtectedCache: vi.fn(),
      planInvalidation: vi.fn(),
    };

    installSyncDevtoolsBridge(core, { forceDev: false });
    installSyncDebug(core, { forceDev: false });

    expect(window.__INMIDIA_SYNC_DEVTOOLS__).toBeUndefined();
    expect(window.__INMIDIA_SYNC_CORE__).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
