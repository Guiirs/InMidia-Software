/**
 * Sync Service — COMM-4
 *
 * COMM-7:
 *   - getSyncHealth()       → bloco syncHealth para /sync/status
 *   - getSyncDiagnostics()  → dados ricos para GET /sync/diagnostics (admin)
 *   - needsSnapshotReason   → razão detalhada nos casos de needsSnapshot
 *   - métrica eventsDeliveredPolling incrementada aqui
 *   - replay path unificado: toda leitura passa por getEventsSinceAsync()
 */

import mongoose from 'mongoose';
import Placa from '@modules/placas/Placa';
import Regiao from '@modules/regioes/Regiao';
import { Log } from '@shared/core';
import {
  getEventsSinceAsync,
  latestIsoForTenant,
  getTotalBufferSize,
  getOldestEventAt,
  getLatestEventAt,
  getRecentEventsPage,
  getTenantsWithBuffer,
} from './sync.registry';
import {
  isConnected as isRedisConnected,
  isDegraded  as isRedisDegraded,
  getMode,
  isEnabled   as isRedisEnabled,
  getInstanceId,
  getReconnectAttempts,
  getLastErrorAt,
  getLastErrorMessage,
  initialize  as initRedisBus,
  getLatestStreamId,
  getLastKnownStreamId,
} from './sync.redis-bus';
import { totalConnections } from './sync.sse-connections';
import { getMetrics, inc, getLagMetrics, getMetricsProvider } from './sync.metrics';
import { getDiagnosticBuffers, recordDiagnostic } from './sync.diagnostics-buffer';
import {
  parseCursor,
  makeLocalCursor,
  makePubsubCursor,
  makeStreamsCursor,
} from './sync.types';
import type {
  SyncStatus,
  SyncSnapshot,
  SyncEventsResponse,
  SyncHealthMetrics,
  SyncDiagnosticsResponse,
  SyncDiagnosticsTimelineResponse,
  SyncDiagnosticsQuery,
  AnyCursor,
  SyncCursor,
  DiagnosticBufferEntry,
} from './sync.types';

// ─── Boot do Redis Bus ────────────────────────────────────────────────────────

let _redisBusBooted = false;

export async function bootRedisBus(): Promise<void> {
  if (_redisBusBooted) return;
  _redisBusBooted = true;
  await initRedisBus();
}

let _apiVersion: string | undefined;
function getApiVersion(): string {
  if (_apiVersion) return _apiVersion;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _apiVersion = (require('../../../package.json') as { version: string }).version;
  } catch { _apiVersion = '1.0.0'; }
  return _apiVersion!;
}

// COMM-7: versão 3 — syncHealth + throughput no status
const CONTRACT_VERSION = 3;

// ─── getSyncHealth — COMM-7 ───────────────────────────────────────────────────

export function getSyncHealth(): SyncHealthMetrics {
  const degradedReasons: string[] = [];

  // Foca em saúde do subsistema de sync (Redis); saúde do DB fica em databaseStatus
  if (isRedisDegraded())                          degradedReasons.push('REDIS_DEGRADED');
  if (isRedisEnabled() && !isRedisConnected())    degradedReasons.push('REDIS_DISCONNECTED');

  const reconnecting = getReconnectAttempts() > 0 && !isRedisConnected() && isRedisEnabled();
  const replayAvailable = getMode() === 'redis-streams' && isRedisConnected() && !isRedisDegraded();
  const lag = getLagMetrics();
  const metrics = getMetrics();
  const { score, status } = calculateHealthScore({
    redisDisconnected: isRedisEnabled() && !isRedisConnected(),
    degraded: degradedReasons.length > 0,
    lagMs: lag.averageLagMs,
    replayFailures: metrics.replayFailures,
    reconnectAttempts: getReconnectAttempts(),
  });

  return {
    healthy:              degradedReasons.length === 0,
    degradedReasons,
    reconnecting,
    replayAvailable,
    score,
    status,
    streamLagMs: lag.latestLagMs,
    averageLagMs: lag.averageLagMs,
    latestLagMs: lag.latestLagMs,
    oldestBufferedEventAt: getOldestEventAt() ?? undefined,
    latestEventAt:         getLatestEventAt() ?? undefined,
  };
}

function calculateHealthScore(input: {
  redisDisconnected: boolean;
  degraded: boolean;
  lagMs: number;
  replayFailures: number;
  reconnectAttempts: number;
}): { score: number; status: SyncHealthMetrics['status'] } {
  let score = 100;
  if (input.redisDisconnected) score -= 30;
  if (input.degraded) score -= 20;
  if (input.lagMs >= Number(process.env.SYNC_HIGH_LAG_MS ?? 5_000)) score -= 15;
  if (input.replayFailures > 0) score -= 10;
  if (input.reconnectAttempts >= Number(process.env.SYNC_RECONNECT_STORM_THRESHOLD ?? 5)) score -= 10;
  score = Math.max(0, Math.min(100, score));
  const status: SyncHealthMetrics['status'] =
    score < 50 ? 'critical' :
    score < 70 ? 'degraded' :
    score < 90 ? 'warning' :
    'healthy';
  return { score, status };
}

// ─── getSyncStatus ─────────────────────────────────────────────────────────────

export async function getSyncStatus(): Promise<SyncStatus> {
  bootRedisBus().catch(() => {});

  const dbState = mongoose.connection.readyState;
  const databaseStatus: SyncStatus['databaseStatus'] =
    dbState === 1 ? 'connected' : dbState === 2 ? 'degraded' : 'disconnected';

  let cacheStatus: SyncStatus['cacheStatus'] = 'disabled';
  try {
    const { default: cacheService } = await import('@shared/container/cache.service');
    await cacheService.get('__sync_probe__');
    cacheStatus = 'connected';
  } catch { cacheStatus = 'disconnected'; }

  return {
    apiVersion:      getApiVersion(),
    contractVersion: CONTRACT_VERSION,
    serverTime:      new Date().toISOString(),
    modules: [
      { name: 'placas',     healthy: databaseStatus === 'connected' },
      { name: 'regioes',    healthy: databaseStatus === 'connected' },
      { name: 'relatorios', healthy: databaseStatus === 'connected' },
      { name: 'sync',       healthy: true },
    ],
    databaseStatus,
    cacheStatus,
    maintenance:  process.env.MAINTENANCE_MODE === 'true',
    featureFlags: {
      syncEnabled:        true,
      realtimeEnabled:    true,
      snapshotEnabled:    true,
      redisDistributed:   isRedisEnabled(),
      canonicalCursor:    true,
      syncObservability:  true, // COMM-7
    },
    transport: {
      mode:                    getMode(),
      degraded:                isRedisDegraded(),
      redisEnabled:            isRedisEnabled(),
      redisConnected:          isRedisConnected(),
      redisReconnectAttempts:  getReconnectAttempts(),
      lastRedisErrorAt:        getLastErrorAt(),
      lastRedisErrorMessage:   getLastErrorMessage(),
      sseClientsConnected:     totalConnections(),
      eventBufferSize:         getTotalBufferSize(),
      instanceId:              getInstanceId(),
    },
    syncHealth: getSyncHealth(), // COMM-7
    throughput: getMetrics(),    // COMM-7
  };
}

// ─── getSyncSnapshot ──────────────────────────────────────────────────────────

export async function getSyncSnapshot(empresaId: string): Promise<SyncSnapshot> {
  const empresaObjectId = new mongoose.Types.ObjectId(empresaId);
  const snapshotAt = new Date().toISOString();

  const [totalPlacas, placasDisponiveis, totalRegioes, dashResult] = await Promise.all([
    Placa.countDocuments({ empresaId: empresaObjectId }),
    Placa.countDocuments({ empresaId: empresaObjectId, disponivel: true }),
    Regiao.countDocuments({ empresaId: empresaObjectId }),
    Placa.aggregate([
      { $match: { empresaId: empresaObjectId } },
      { $group: { _id: '$regiaoId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'regiaos',
          localField: '_id',
          foreignField: '_id',
          as: 'regiaoDetalhes',
        },
      },
      { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, nome: { $ifNull: ['$regiaoDetalhes.nome', 'N/A'] } } },
    ]),
  ]);

  const regiaoPrincipal: string = dashResult.length > 0
    ? (dashResult[0] as { nome: string }).nome
    : 'N/A';

  const legacyIso = latestIsoForTenant(empresaId);
  let syncCursor: SyncCursor;

  const mode = getMode();
  if (mode === 'redis-streams' && isRedisConnected() && !isRedisDegraded()) {
    const knownId  = getLastKnownStreamId(empresaId);
    const latestId = knownId ?? await getLatestStreamId(empresaId);
    syncCursor = makeStreamsCursor(latestId ?? '0-0');
  } else if (mode === 'redis-pubsub') {
    syncCursor = makePubsubCursor(legacyIso);
  } else {
    syncCursor = makeLocalCursor(legacyIso);
  }

  Log.info(`[SyncService] Snapshot gerado para empresa ${empresaId}: ${totalPlacas} placas, ${totalRegioes} regiões | cursor.mode=${syncCursor.mode}`);

  return {
    placas:    { total: totalPlacas, disponiveis: placasDisponiveis, updatedAt: snapshotAt },
    regioes:   { total: totalRegioes, updatedAt: snapshotAt },
    dashboard: { totalPlacas, placasDisponiveis, regiaoPrincipal },
    snapshotAt,
    syncCursor,
    legacyCursor: legacyIso,
  };
}

// ─── getSyncEvents — COMM-7 unified replay path ───────────────────────────────

/**
 * Caminho de replay unificado para polling.
 * Todos os acessos a eventos passam por:
 *   parseCursor() → getEventsSinceAsync() → nextCursor generation
 *
 * Retorna needsSnapshotReason quando o cursor não é recuperável.
 */
export async function getSyncEvents(
  empresaId: string,
  rawCursor: AnyCursor | null | undefined
): Promise<SyncEventsResponse> {
  const cursorWasProvided = rawCursor !== null && rawCursor !== undefined && rawCursor !== '';
  const parsed = parseCursor(rawCursor);
  if (isLegacyCursor(rawCursor)) {
    inc('legacyCursorUses');
    Log.warn(`[SyncService] Cursor legado usado para empresa ${empresaId}. Compatibilidade em deprecação.`);
  }

  // Cursor inválido → needsSnapshot com razão
  if (cursorWasProvided && parsed === null) {
    Log.warn(`[SyncService] Cursor inválido para empresa ${empresaId} → needsSnapshot CURSOR_INVALID`);
    inc('snapshotRecoveries');
    recordDiagnostic('snapshotRecoveries', { empresaId, type: 'SNAPSHOT_RECOVERY', reason: 'CURSOR_INVALID' });
    return {
      events:               [],
      nextCursor:           makeLocalCursor(),
      count:                0,
      needsSnapshot:        true,
      needsSnapshotReason:  'CURSOR_INVALID',
    };
  }

  inc('replayRequests'); // COMM-7: conta toda requisição de eventos

  let events: SyncEvent[];
  try {
    events = await getEventsSinceAsync(empresaId, rawCursor) ?? [];
  } catch {
    // Replay indisponível — stream truncado ou Redis em falha
    inc('replayFailures');
    inc('snapshotRecoveries');
    recordDiagnostic('replayFailures', { empresaId, type: 'REPLAY_FAILURE', reason: 'REPLAY_UNAVAILABLE' });
    recordDiagnostic('snapshotRecoveries', { empresaId, type: 'SNAPSHOT_RECOVERY', reason: 'REPLAY_UNAVAILABLE' });
    Log.warn(`[SyncService] Replay falhou para empresa ${empresaId} → needsSnapshot REPLAY_UNAVAILABLE`);
    return {
      events:               [],
      nextCursor:           makeLocalCursor(),
      count:                0,
      needsSnapshot:        true,
      needsSnapshotReason:  'REPLAY_UNAVAILABLE',
    };
  }

  // Detecta stream truncado: cursor streams mas sem eventos e buffer local também vazio
  if (
    parsed?.mode === 'streams' &&
    events.length === 0 &&
    isRedisConnected() &&
    !isRedisDegraded()
  ) {
    // Verifica se o stream ID fornecido é mais antigo que o disponível
    // (heurística simples: se cursor streams retornou vazio, pode estar truncado)
    const latestId = getLastKnownStreamId(empresaId) ?? await getLatestStreamId(empresaId);
    if (latestId && parsed.value !== '0-0' && parsed.value < latestId) {
      inc('snapshotRecoveries');
      recordDiagnostic('snapshotRecoveries', { empresaId, type: 'SNAPSHOT_RECOVERY', reason: 'STREAM_TRUNCATED' });
      Log.warn(`[SyncService] Stream possivelmente truncado para empresa ${empresaId} → needsSnapshot STREAM_TRUNCATED`);
      return {
        events:               [],
        nextCursor:           makeStreamsCursor(latestId),
        count:                0,
        needsSnapshot:        true,
        needsSnapshotReason:  'STREAM_TRUNCATED',
      };
    }
  }

  inc('eventsDeliveredPolling', events.length); // COMM-7

  const mode = getMode();
  let nextCursor: SyncCursor;

  if (mode === 'redis-streams' && isRedisConnected() && !isRedisDegraded()) {
    const knownId  = getLastKnownStreamId(empresaId);
    const latestId = knownId ?? await getLatestStreamId(empresaId);
    nextCursor = makeStreamsCursor(latestId ?? (parsed?.value ?? '0-0'));
  } else {
    const lastOccurredAt = events.length > 0
      ? events[events.length - 1]!.occurredAt
      : new Date().toISOString();
    nextCursor = mode === 'redis-pubsub'
      ? makePubsubCursor(lastOccurredAt)
      : makeLocalCursor(lastOccurredAt);
  }

  Log.info(`[SyncService] Eventos: ${events.length} para empresa ${empresaId} | nextCursor.mode=${nextCursor.mode}`);

  return { events, nextCursor, count: events.length };
}

// ─── getSyncDiagnostics — COMM-7 (admin) ──────────────────────────────────────

function isLegacyCursor(rawCursor: AnyCursor | null | undefined): boolean {
  if (!rawCursor || typeof rawCursor !== 'string') return false;
  try {
    const padded = rawCursor + '='.repeat((4 - (rawCursor.length % 4)) % 4);
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    return !(parsed && typeof parsed === 'object' && 'mode' in parsed && 'value' in parsed && 'issuedAt' in parsed);
  } catch {
    return true;
  }
}

export function isLegacyCursorInput(rawCursor: AnyCursor | null | undefined): boolean {
  return isLegacyCursor(rawCursor);
}

export function renderSyncPrometheusMetrics(): string {
  return getMetricsProvider().renderPrometheus({
    sseClientsConnected: totalConnections(),
    redisConnected: isRedisConnected(),
    transportDegraded: isRedisDegraded(),
    reconnectAttempts: getReconnectAttempts(),
    instanceId: getInstanceId(),
    transportMode: getMode(),
    degradedReason: getLastErrorMessage() ?? (isRedisDegraded() ? 'TRANSPORT_DEGRADED' : 'none'),
  });
}

export async function getSyncDiagnostics(query: SyncDiagnosticsQuery = {}): Promise<SyncDiagnosticsResponse> {
  const recent = getRecentEventsPage(query);
  const lag = getLagMetrics();
  const buffers = filterDiagnosticBuffers(await getDiagnosticBuffers(), query);
  const redisConnected = isRedisConnected();
  const degraded = isRedisDegraded();
  const degradedReason = degraded
    ? getLastErrorMessage() ?? 'TRANSPORT_DEGRADED'
    : null;
  const sseClientsConnected = totalConnections();
  const transportHealth = degraded
    ? 'degraded'
    : (isRedisEnabled() && !redisConnected ? 'disconnected' : 'healthy');
  const syncHealth = getSyncHealth();

  return {
    instanceId:          getInstanceId(),
    uptimeMs:            getMetrics().uptimeMs,
    mode:                getMode(),
    connected:           redisConnected,
    degraded,
    degradedReason,
    transportHealth,
    healthScore:         syncHealth.score,
    healthStatus:        syncHealth.status,
    redisConnected,
    sseConnected:        sseClientsConnected > 0,
    averageLagMs:        lag.averageLagMs,
    latestLagMs:         lag.latestLagMs,
    replayFailureCount:  getMetrics().replayFailures,
    reconnectAttempts:   getReconnectAttempts(),
    sseClientsConnected,
    streamModeActive:    getMode() === 'redis-streams',
    bufferStats: {
      totalEvents:       getTotalBufferSize(),
      tenantsWithBuffer: getTenantsWithBuffer(),
      oldestEventAt:     getOldestEventAt(),
      latestEventAt:     getLatestEventAt(),
    },
    throughput:    getMetrics(),
    replayFailures: buffers.replayFailures,
    reconnectEvents: buffers.reconnectEvents,
    snapshotRecoveriesLog: buffers.snapshotRecoveries,
    degradedTransitions: buffers.degradedTransitions,
    recentEventsPage: {
      limit: recent.limit,
      offset: recent.offset,
      total: recent.total,
      nextOffset: recent.nextOffset,
    },
    recentEvents:  recent.items,
  };
}

export async function getSyncDiagnosticsTimeline(query: SyncDiagnosticsQuery = {}): Promise<SyncDiagnosticsTimelineResponse> {
  const buffers = await getDiagnosticBuffers();
  const recentEvents = getRecentEventsPage({ ...query, offset: 0, limit: 100 }).items.map(event => ({
    at: event.occurredAt,
    empresaId: event.empresaId,
    type: event.type,
    source: 'recentEvents' as const,
    severity: 'info' as const,
    correlationId: event.correlationId,
    instanceId: getInstanceId(),
  }));

  const all = [
    ...buffers.replayFailures,
    ...buffers.reconnectEvents,
    ...buffers.snapshotRecoveries,
    ...buffers.degradedTransitions,
    ...recentEvents,
  ];
  const filtered = filterDiagnosticEntries(all, query)
    .sort((a, b) => a.at.localeCompare(b.at));
  const cursorOffset = query.cursor ? Number(query.cursor) : NaN;
  const offset = Math.max(Number.isFinite(cursorOffset) ? cursorOffset : (query.offset ?? 0), 0);
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const items = filtered.slice(offset, offset + limit);

  return {
    items,
    page: {
      limit,
      offset,
      total: filtered.length,
      nextCursor: offset + limit < filtered.length ? String(offset + limit) : null,
    },
  };
}

function filterDiagnosticBuffers(
  buffers: Awaited<ReturnType<typeof getDiagnosticBuffers>>,
  query: SyncDiagnosticsQuery
): Awaited<ReturnType<typeof getDiagnosticBuffers>> {
  return {
    replayFailures: filterDiagnosticEntries(buffers.replayFailures, query),
    reconnectEvents: filterDiagnosticEntries(buffers.reconnectEvents, query),
    snapshotRecoveries: filterDiagnosticEntries(buffers.snapshotRecoveries, query),
    degradedTransitions: filterDiagnosticEntries(buffers.degradedTransitions, query),
  };
}

function filterDiagnosticEntries(entries: DiagnosticBufferEntry[], query: SyncDiagnosticsQuery): DiagnosticBufferEntry[] {
  const sinceMs = query.since ? new Date(query.since).getTime() : NaN;
  const untilMs = query.until ? new Date(query.until).getTime() : NaN;
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 100);
  return entries.filter(entry => {
    const atMs = new Date(entry.at).getTime();
    if (query.empresaId && entry.empresaId !== query.empresaId) return false;
    if (query.type && entry.type !== query.type) return false;
    if (query.severity && entry.severity !== query.severity) return false;
    if (query.correlationId && entry.correlationId !== query.correlationId) return false;
    if (!Number.isNaN(sinceMs) && atMs <= sinceMs) return false;
    if (!Number.isNaN(untilMs) && atMs > untilMs) return false;
    return true;
  }).slice(-limit);
}

// Importação de tipo necessária para o cast em getSyncEvents
import type { SyncEvent } from './sync.types';
