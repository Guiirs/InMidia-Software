/**
 * Sync Throughput Metrics — COMM-7
 *
 * Contadores em memória para observabilidade operacional.
 * Mantidos por instância — sem persistência entre restarts.
 *
 * Uso:
 *   import { inc, getMetrics } from './sync.metrics';
 *   inc('eventsPublishedTotal');
 */

import type { SyncThroughputMetrics, SyncLagMetrics } from './sync.types';

// ─── Estado interno ───────────────────────────────────────────────────────────

let _startedAt: number = Date.now();

const _counters: Omit<SyncThroughputMetrics, 'uptimeMs'> = {
  eventsPublishedTotal:    0,
  eventsDeliveredSSE:      0,
  eventsDeliveredPolling:  0,
  replayRequests:          0,
  replayFailures:          0,
  snapshotRecoveries:      0,
  duplicateEventsIgnored:  0,
  legacyCursorUses:        0,
  reconnectAttemptsTotal:  0,
};

const _publishTimestamps = new Map<string, number>();
let _latestLagMs = 0;
let _averageLagMs = 0;
let _lagSamples = 0;

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Incrementa um contador de throughput.
 * @param metric - nome do contador
 * @param by    - incremento (padrão: 1)
 */
export function inc(metric: keyof Omit<SyncThroughputMetrics, 'uptimeMs'>, by = 1): void {
  _counters[metric] += by;
}

export function recordPublishTimestamp(eventId: string, publishedAtMs = Date.now()): void {
  _publishTimestamps.set(eventId, publishedAtMs);
  if (_publishTimestamps.size > 1_000) {
    const oldest = _publishTimestamps.keys().next().value;
    if (oldest) _publishTimestamps.delete(oldest);
  }
}

export function recordSseDelivery(eventId: string, occurredAt?: string, deliveredAtMs = Date.now()): number {
  const publishedAt =
    _publishTimestamps.get(eventId) ??
    (occurredAt ? new Date(occurredAt).getTime() : NaN);
  if (Number.isNaN(publishedAt)) return _latestLagMs;

  const lag = Math.max(0, deliveredAtMs - publishedAt);
  _latestLagMs = lag;
  _lagSamples++;
  _averageLagMs = _lagSamples === 1
    ? lag
    : (_averageLagMs * 0.9) + (lag * 0.1);
  _publishTimestamps.delete(eventId);
  return lag;
}

export function getLagMetrics(): SyncLagMetrics {
  return {
    latestLagMs: Math.round(_latestLagMs),
    averageLagMs: Math.round(_averageLagMs),
    samples: _lagSamples,
  };
}

/** Retorna snapshot atual de todos os contadores. */
export function getMetrics(): SyncThroughputMetrics {
  return {
    ..._counters,
    uptimeMs: Date.now() - _startedAt,
  };
}

export interface SyncMetricsProvider {
  getMetrics(): SyncThroughputMetrics;
  getLagMetrics(): SyncLagMetrics;
  renderPrometheus(extra?: {
    sseClientsConnected?: number;
    redisConnected?: boolean;
    transportDegraded?: boolean;
    reconnectAttempts?: number;
    instanceId?: string;
    transportMode?: string;
    degradedReason?: string;
  }): string;
}

function prometheusLine(name: string, value: number): string {
  return `${name} ${Number.isFinite(value) ? value : 0}`;
}

function prometheusLabeledLine(name: string, labels: Record<string, string>, value: number): string {
  const body = Object.entries(labels)
    .map(([key, raw]) => `${key}="${String(raw).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
  return `${name}{${body}} ${Number.isFinite(value) ? value : 0}`;
}

export const memoryMetricsProvider: SyncMetricsProvider = {
  getMetrics,
  getLagMetrics,
  renderPrometheus(extra = {}) {
    const m = getMetrics();
    const lag = getLagMetrics();
    const labels = {
      instanceId: extra.instanceId ?? 'unknown',
      transportMode: extra.transportMode ?? 'unknown',
      degradedReason: extra.degradedReason ?? 'none',
      correlationId: 'sample_unavailable',
    };
    return [
      '# HELP sync_events_published_total Total sync events published.',
      '# TYPE sync_events_published_total counter',
      prometheusLine('sync_events_published_total', m.eventsPublishedTotal),
      '# HELP sync_events_delivered_sse_total Total sync events delivered through SSE.',
      '# TYPE sync_events_delivered_sse_total counter',
      prometheusLine('sync_events_delivered_sse_total', m.eventsDeliveredSSE),
      '# HELP sync_events_delivered_polling_total Total sync events delivered through polling.',
      '# TYPE sync_events_delivered_polling_total counter',
      prometheusLine('sync_events_delivered_polling_total', m.eventsDeliveredPolling),
      '# HELP sync_replay_requests_total Total replay requests.',
      '# TYPE sync_replay_requests_total counter',
      prometheusLine('sync_replay_requests_total', m.replayRequests),
      '# HELP sync_replay_failures_total Total replay failures.',
      '# TYPE sync_replay_failures_total counter',
      prometheusLine('sync_replay_failures_total', m.replayFailures),
      '# HELP sync_snapshot_recoveries_total Total snapshot recoveries.',
      '# TYPE sync_snapshot_recoveries_total counter',
      prometheusLine('sync_snapshot_recoveries_total', m.snapshotRecoveries),
      '# HELP sync_duplicate_events_ignored_total Total duplicate sync events ignored.',
      '# TYPE sync_duplicate_events_ignored_total counter',
      prometheusLine('sync_duplicate_events_ignored_total', m.duplicateEventsIgnored),
      '# HELP sync_legacy_cursor_uses_total Total legacy cursor usages.',
      '# TYPE sync_legacy_cursor_uses_total counter',
      prometheusLine('sync_legacy_cursor_uses_total', m.legacyCursorUses),
      '# HELP sync_sse_clients_connected Current SSE clients connected.',
      '# TYPE sync_sse_clients_connected gauge',
      prometheusLine('sync_sse_clients_connected', extra.sseClientsConnected ?? 0),
      '# HELP sync_redis_connected Redis connection state for sync transport.',
      '# TYPE sync_redis_connected gauge',
      prometheusLine('sync_redis_connected', extra.redisConnected ? 1 : 0),
      '# HELP sync_transport_degraded Sync transport degraded state.',
      '# TYPE sync_transport_degraded gauge',
      prometheusLine('sync_transport_degraded', extra.transportDegraded ? 1 : 0),
      prometheusLabeledLine('sync_transport_degraded_info', labels, extra.transportDegraded ? 1 : 0),
      '# HELP sync_reconnect_attempts_total Current sync reconnect attempts.',
      '# TYPE sync_reconnect_attempts_total counter',
      prometheusLine('sync_reconnect_attempts_total', m.reconnectAttemptsTotal || extra.reconnectAttempts || 0),
      '# HELP sync_uptime_seconds Sync subsystem uptime in seconds.',
      '# TYPE sync_uptime_seconds gauge',
      prometheusLine('sync_uptime_seconds', Math.floor(m.uptimeMs / 1000)),
      '# HELP sync_stream_lag_latest_ms Latest publish-to-SSE delivery lag in milliseconds.',
      '# TYPE sync_stream_lag_latest_ms gauge',
      prometheusLine('sync_stream_lag_latest_ms', lag.latestLagMs),
      '# HELP sync_stream_lag_average_ms Moving average publish-to-SSE delivery lag in milliseconds.',
      '# TYPE sync_stream_lag_average_ms gauge',
      prometheusLine('sync_stream_lag_average_ms', lag.averageLagMs),
      prometheusLabeledLine('sync_instance_health_info', labels, 1),
      '',
    ].join('\n');
  },
};

export const prometheusMetricsProvider = memoryMetricsProvider;

export function getMetricsProvider(): SyncMetricsProvider {
  return process.env.SYNC_METRICS_PROVIDER === 'prometheus'
    ? prometheusMetricsProvider
    : memoryMetricsProvider;
}

/** Para testes — reseta todos os contadores e reinicia o uptime. */
export function resetMetrics(): void {
  (Object.keys(_counters) as (keyof typeof _counters)[]).forEach(k => {
    _counters[k] = 0;
  });
  _publishTimestamps.clear();
  _latestLagMs = 0;
  _averageLagMs = 0;
  _lagSamples = 0;
  _startedAt = Date.now();
}
