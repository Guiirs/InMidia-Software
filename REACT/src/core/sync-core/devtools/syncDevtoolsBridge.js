import { createSyncGraphVisualizer } from './syncGraphVisualizer.js';
import { createSyncInspector } from './syncInspector.js';
import { createSyncMutationInspector } from './syncMutationInspector.js';
import { createSyncPerformanceMetrics } from './syncPerformanceMetrics.js';
import { createSyncResourceInspector } from './syncResourceInspector.js';
import { createSyncSchedulerInspector } from './syncSchedulerInspector.js';
import { createSyncTimeline, SYNC_TIMELINE_TYPES } from './syncTimeline.js';
import { createSyncTraceStore } from './syncTraceStore.js';
import { createSyncTelemetry } from '../debug/syncTelemetry.js';

export function createSyncDevtools() {
  const timeline = createSyncTimeline();
  const traces = createSyncTraceStore();
  const performanceMetrics = createSyncPerformanceMetrics();
  const telemetry = createSyncTelemetry();

  return {
    timeline,
    traces,
    performance: performanceMetrics,
    telemetry,
    record(event) {
      try {
        return timeline.record(event);
      } catch {
        return null;
      }
    },
    types: SYNC_TIMELINE_TYPES,
  };
}

/**
 * Instala o bridge de devtools do Sync Core na janela global.
 *
 * @param core - instância do Sync Core
 * @param options.forceDev - habilita manualmente (default: false)
 *   Use a feature flag syncDevtools para controlar em produção.
 *   Em desenvolvimento local, passe forceDev=true explicitamente.
 */
export function installSyncDevtoolsBridge(core, { forceDev = false } = {}) {
  if (!forceDev || typeof window === 'undefined') return;

  const previous = window.__INMIDIA_SYNC_DEVTOOLS__;
  const api = {
    timeline: core.devtools.timeline,
    traces: core.devtools.traces,
    performance: core.devtools.performance,
    inspector: createSyncInspector(core),
    graph: createSyncGraphVisualizer({ registry: core.registry, getDependencyGraph: core.getDependencyGraph }),
    scheduler: createSyncSchedulerInspector({ refreshQueue: core.refreshQueue, timeline: core.devtools.timeline }),
    mutations: createSyncMutationInspector({
      mutationRegistry: core.mutationRegistry,
      mutationManager: core.mutationManager,
      timeline: core.devtools.timeline,
    }),
    resources: createSyncResourceInspector({
      registry: core.registry,
      store: core.store,
      timeline: core.devtools.timeline,
    }),
    telemetry: core.devtools.telemetry,
    getTimeline: (filter) => core.devtools.timeline.list(filter),
  };

  window.__INMIDIA_SYNC_DEVTOOLS__ = api;

  return () => {
    if (window.__INMIDIA_SYNC_DEVTOOLS__ === api) {
      if (previous === undefined) delete window.__INMIDIA_SYNC_DEVTOOLS__;
      else window.__INMIDIA_SYNC_DEVTOOLS__ = previous;
    }
  };
}
