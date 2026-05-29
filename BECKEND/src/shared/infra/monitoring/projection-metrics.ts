export type ProjectionMetricName = 'commercial' | 'dashboard' | 'inventory' | 'public_plates';

export interface ProjectionMetricSnapshot {
  projection: ProjectionMetricName;
  calls: number;
  avgMs: number;
  maxMs: number;
  totalPlates: number;
  avgPlates: number;
  fallbackCount: number;
  fallbackRate: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  rebuildCount: number;
  lastRunAt?: string;
}

interface ProjectionMetricState {
  calls: number;
  totalMs: number;
  maxMs: number;
  totalPlates: number;
  fallbackCount: number;
  cacheHits: number;
  cacheMisses: number;
  rebuildCount: number;
  lastRunAt?: string;
}

const projectionStates = new Map<ProjectionMetricName, ProjectionMetricState>();

function stateFor(projection: ProjectionMetricName): ProjectionMetricState {
  const current = projectionStates.get(projection);
  if (current) return current;

  const created: ProjectionMetricState = {
    calls: 0,
    totalMs: 0,
    maxMs: 0,
    totalPlates: 0,
    fallbackCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    rebuildCount: 0,
  };
  projectionStates.set(projection, created);
  return created;
}

export function recordProjectionMetric(input: {
  projection: ProjectionMetricName;
  durationMs: number;
  plateCount?: number;
  fallbackCount?: number;
  cacheHit?: boolean;
  rebuild?: boolean;
  at?: Date;
}): void {
  const state = stateFor(input.projection);
  const durationMs = Math.max(0, input.durationMs);
  state.calls += 1;
  state.totalMs += durationMs;
  state.maxMs = Math.max(state.maxMs, durationMs);
  state.totalPlates += Math.max(0, input.plateCount ?? 0);
  state.fallbackCount += Math.max(0, input.fallbackCount ?? 0);
  if (input.cacheHit === true) state.cacheHits += 1;
  if (input.cacheHit === false) state.cacheMisses += 1;
  if (input.rebuild === true) state.rebuildCount += 1;
  state.lastRunAt = (input.at ?? new Date()).toISOString();
}

export function getProjectionMetricsSnapshot(): ProjectionMetricSnapshot[] {
  return Array.from(projectionStates.entries())
    .map(([projection, state]) => {
      const cacheTotal = state.cacheHits + state.cacheMisses;
      return {
        projection,
        calls: state.calls,
        avgMs: state.calls > 0 ? Number((state.totalMs / state.calls).toFixed(2)) : 0,
        maxMs: Number(state.maxMs.toFixed(2)),
        totalPlates: state.totalPlates,
        avgPlates: state.calls > 0 ? Number((state.totalPlates / state.calls).toFixed(2)) : 0,
        fallbackCount: state.fallbackCount,
        fallbackRate: state.totalPlates > 0 ? Number((state.fallbackCount / state.totalPlates).toFixed(4)) : 0,
        cacheHits: state.cacheHits,
        cacheMisses: state.cacheMisses,
        cacheHitRate: cacheTotal > 0 ? Number((state.cacheHits / cacheTotal).toFixed(4)) : 0,
        rebuildCount: state.rebuildCount,
        lastRunAt: state.lastRunAt,
      };
    })
    .sort((a, b) => a.projection.localeCompare(b.projection));
}

export function resetProjectionMetrics(): void {
  projectionStates.clear();
}
