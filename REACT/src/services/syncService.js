/**
 * Sync Service — COMM-3
 *
 * COMM-7: métricas internas, deduplicação com TTL, snapshot recovery robusto.
 *   - _replayCount, _snapshotRecoveries, _duplicateEventsIgnored, _lastEventAt
 *   - Dedup via Map<id, timestamp> com TTL de 5 minutos
 *   - needsSnapshotReason propagado para o caller via evento interno
 *   - getCursor() retorna SyncCursor canônico
 *   - getDiagnostics() expõe estado interno para useSyncDiagnostics()
 *
 * Transporte principal: SSE (EventSource)
 * Fallback automático: polling incremental
 */

import {
  fetchSyncStatus,
  fetchSyncSnapshot,
  fetchSyncEvents,
  fetchStreamToken,
  buildStreamUrl,
} from './syncClient';
import { SYNC_POLL_INTERVAL_MS, isSyncSnapshot, parseCursorFrontend } from '../contracts';

// ─── Estado de transporte ─────────────────────────────────────────────────────

/** @type {import('../contracts').SyncCursor|null} */
let _cursor     = null;
let _snapshot   = null;
let _status     = null;
let _booted     = false;
let _connected  = false;
let _lastSyncAt = null;
let _lastError  = null;

// SSE
/** @type {EventSource|null} */
let _eventSource   = null;
let _sseActive     = false;
let _sseRetryCount = 0;
const MAX_SSE_RETRIES   = 5;
const SSE_RETRY_BASE_MS = 2_000;

// Polling
let _pollingActive = false;
/** @type {ReturnType<typeof setInterval>|null} */
let _intervalId    = null;

// Pub/sub
/** @type {Map<string, ((event: any) => void)[]>} */
const _subscribers = new Map();

// ─── Métricas internas — COMM-7 ───────────────────────────────────────────────

let _replayCount            = 0;
let _snapshotRecoveries     = 0;
let _duplicateEventsIgnored = 0;
let _lastEventAt            = null;
let _bootedAt               = null;
let _latestLagMs            = 0;
let _averageLagMs           = 0;
let _lagSamples             = 0;
let _degradedTransitions    = 0;
let _lastDegraded           = null;
let _legacyCursorDetected   = false;
let _reconnectEvents        = [];
let _replayFailures         = [];
let _degradedTransitionsLog = [];

// Deduplicação com TTL (Map<id, timestampMs>) — COMM-7
const DEDUP_TTL_MS  = 5 * 60_000; // 5 minutos
const MAX_DEDUP     = 500;
/** @type {Map<string, number>} */
const _processedIds = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _hasToken() {
  try { return Boolean(localStorage.getItem('token')); } catch { return false; }
}

/**
 * COMM-7: dedup com TTL explícito.
 * Retorna false se o id já foi processado recentemente.
 * Remove automaticamente entradas expiradas de forma incremental.
 */
function _markProcessed(id) {
  const now = Date.now();
  const seenAt = _processedIds.get(id);

  if (seenAt !== undefined) {
    if (now - seenAt < DEDUP_TTL_MS) {
      _duplicateEventsIgnored++;
      return false; // duplicado dentro do TTL
    }
    _processedIds.delete(id); // expirado — permite reprocessar
  }

  _processedIds.set(id, now);

  // Evicção incremental por tamanho
  if (_processedIds.size > MAX_DEDUP) {
    const oldest = _processedIds.keys().next().value;
    if (oldest) _processedIds.delete(oldest);
  }

  return true;
}

function _dispatch(event) {
  if (!_markProcessed(event.id)) {
    if (import.meta.env.DEV) console.debug(`[syncService] Duplicado ignorado: ${event.type} id=${event.id}`);
    return;
  }
  _lastEventAt = new Date().toISOString(); // COMM-7
  if (import.meta.env.DEV) console.info(`[syncService] Evento: ${event.type} entity=${event.entityId}`);

  (_subscribers.get(event.type) ?? []).forEach(h => {
    try { h(event); } catch (err) { console.error('[syncService] handler error:', err); }
  });
  (_subscribers.get('*') ?? []).forEach(h => {
    try { h(event); } catch (err) { console.error('[syncService] wildcard error:', err); }
  });
}

function _toCursor(raw) {
  return parseCursorFrontend(raw);
}

function _advanceCursor(raw) {
  const next = _toCursor(raw);
  if (next) _cursor = next;
}

function _recordLag(event) {
  const occurredAt = event?.occurredAt ? new Date(event.occurredAt).getTime() : NaN;
  if (Number.isNaN(occurredAt)) return;
  const lag = Math.max(0, Date.now() - occurredAt);
  _latestLagMs = lag;
  _lagSamples++;
  _averageLagMs = _lagSamples === 1 ? lag : (_averageLagMs * 0.9) + (lag * 0.1);
}

function _recordTransportStatus(status) {
  const degraded = Boolean(status?.transport?.degraded ?? status?.syncHealth?.healthy === false);
  if (_lastDegraded !== null && _lastDegraded !== degraded) {
    _degradedTransitions++;
    _degradedTransitionsLog = [
      ..._degradedTransitionsLog,
      {
        at: new Date().toISOString(),
        type: degraded ? 'DEGRADED_ON' : 'DEGRADED_OFF',
        reason: status?.transport?.lastRedisErrorMessage ?? 'TRANSPORT_STATUS_CHANGED',
        severity: degraded ? 'critical' : 'info',
      },
    ].slice(-20);
  }
  _lastDegraded = degraded;
}

function _recordReconnectEvent(reason) {
  _reconnectEvents = [
    ..._reconnectEvents,
    { at: new Date().toISOString(), type: 'SSE_RECONNECT', reason, severity: 'warning' },
  ].slice(-20);
}

function _recordReplayFailure(reason) {
  _replayFailures = [
    ..._replayFailures,
    { at: new Date().toISOString(), type: 'REPLAY_FAILURE', reason, severity: 'warning' },
  ].slice(-20);
}

function _isLegacyCursor(raw) {
  return typeof raw === 'string' && raw.length > 0;
}

// ─── Pub/sub ──────────────────────────────────────────────────────────────────

export function subscribe(eventType, handler) {
  if (!_subscribers.has(eventType)) _subscribers.set(eventType, []);
  _subscribers.get(eventType).push(handler);
  return () => {
    const list = _subscribers.get(eventType);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  };
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

export async function boot() {
  if (!_hasToken()) {
    if (import.meta.env.DEV) console.warn('[syncService] Boot ignorado: sem token.');
    return { status: null, snapshot: null };
  }
  if (_booted) return { status: _status, snapshot: _snapshot };
  _booted    = true;
  _bootedAt  = new Date().toISOString();

  if (import.meta.env.DEV) console.info('[syncService] Boot (COMM-7)...');

  try {
    _status = await fetchSyncStatus();
    _recordTransportStatus(_status);
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[syncService] Status falhou:', err?.message);
  }

  try {
    _snapshot = await fetchSyncSnapshot();
    if (isSyncSnapshot(_snapshot)) {
      _cursor = _toCursor(_snapshot.syncCursor) ?? _toCursor(_snapshot.legacyCursor);
      _legacyCursorDetected = !_snapshot.syncCursor && _isLegacyCursor(_snapshot.legacyCursor);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[syncService] Snapshot falhou:', err?.message);
    _cursor = { mode: 'local', value: new Date().toISOString(), issuedAt: new Date().toISOString() };
  }

  await _tryStartSSE();

  return { status: _status, snapshot: _snapshot };
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

async function _tryStartSSE() {
  if (_sseActive) return;
  if (typeof EventSource === 'undefined') {
    if (import.meta.env.DEV) console.info('[syncService] EventSource indisponível → polling');
    _startPolling();
    return;
  }

  try {
    const { token } = await fetchStreamToken();
    const url = buildStreamUrl(token, _cursor);
    _openEventSource(url);
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[syncService] stream-token falhou → polling:', err?.message);
    _startPolling();
  }
}

function _openEventSource(url) {
  if (_eventSource) { _eventSource.close(); _eventSource = null; }

  const es     = new EventSource(url);
  _eventSource = es;
  _sseActive   = true;

  if (import.meta.env.DEV) console.info('[syncService] SSE conectando...');

  es.onopen = () => {
    _connected     = true;
    _lastSyncAt    = new Date().toISOString();
    _lastError     = null;
    _sseRetryCount = 0;
    _stopPolling();
    if (import.meta.env.DEV) console.info('[syncService] SSE conectado ✓');
  };

  es.onerror = () => {
    _connected = false;
    _lastError = 'SSE connection error';
    _sseActive = false;
    if (es.readyState === EventSource.CLOSED) {
      _eventSource = null;
      _scheduleSSEReconnect();
    }
  };

  es.addEventListener('heartbeat', () => { _lastSyncAt = new Date().toISOString(); });

  es.addEventListener('sync_reset', async (e) => {
    const data = (() => { try { return JSON.parse(e.data); } catch { return {}; } })();
    if (import.meta.env.DEV) console.warn('[syncService] sync_reset:', data.reason ?? 'no_cursor');
    // COMM-7: incrementa snapshotRecoveries em qualquer razão de reset
    _snapshotRecoveries++;
    try {
      const snap = await fetchSyncSnapshot();
      if (isSyncSnapshot(snap)) {
        _snapshot = snap;
        _cursor   = _toCursor(snap.syncCursor) ?? _toCursor(snap.legacyCursor) ?? _cursor;
      }
    } catch { /* mantém estado */ }
  });

  const DOMAIN_EVENTS = [
    'PLACA_CREATED', 'PLACA_UPDATED', 'PLACA_STATUS_CHANGED', 'PLACA_DELETED',
    'REGIAO_UPDATED', 'DASHBOARD_INVALIDATED', 'SYSTEM_STATUS_CHANGED',
  ];

  DOMAIN_EVENTS.forEach(eventType => {
    es.addEventListener(eventType, (e) => {
      try {
        const event = JSON.parse(e.data);
        _recordLag(event);
        _lastSyncAt = new Date().toISOString();

        // COMM-7: Last-Event-ID agora é occurredAt (normalizado pelo backend)
        // Usamos diretamente para avançar cursor (mesmo modo do cursor atual).
        const sseId = e.lastEventId || event.occurredAt;
        if (sseId) {
          _advanceCursor({
            mode:     _cursor?.mode ?? 'local',
            value:    sseId,
            issuedAt: new Date().toISOString(),
          });
        }

        _dispatch(event);
      } catch (parseErr) {
        if (import.meta.env.DEV) console.warn('[syncService] Parse error SSE:', parseErr);
      }
    });
  });
}

function _scheduleSSEReconnect() {
  _sseRetryCount++;
  _recordReconnectEvent('SSE_ERROR');
  if (_sseRetryCount > MAX_SSE_RETRIES) {
    if (import.meta.env.DEV) console.warn(`[syncService] SSE falhou ${MAX_SSE_RETRIES}x → polling permanente`);
    _startPolling();
    return;
  }
  const delay = SSE_RETRY_BASE_MS * Math.pow(2, _sseRetryCount - 1);
  if (import.meta.env.DEV) console.info(`[syncService] SSE reconectando em ${delay}ms (${_sseRetryCount}/${MAX_SSE_RETRIES})`);
  _startPolling();
  setTimeout(async () => {
    if (!_sseActive && _hasToken()) {
      _replayCount++; // COMM-7: conta reconexões SSE como replay
      _stopPolling();
      await _tryStartSSE();
    }
  }, delay);
}

export function stopSSE() {
  _sseActive = false;
  if (_eventSource) { _eventSource.close(); _eventSource = null; }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

function _startPolling() {
  if (_pollingActive || !_hasToken()) return;
  _pollingActive = true;
  _intervalId    = setInterval(_pollOnce, SYNC_POLL_INTERVAL_MS);
  if (import.meta.env.DEV) console.info(`[syncService] Polling ativo (${SYNC_POLL_INTERVAL_MS}ms)`);
}

function _stopPolling() {
  _pollingActive = false;
  if (_intervalId !== null) { clearInterval(_intervalId); _intervalId = null; }
}

async function _pollOnce() {
  if (!_pollingActive || !_hasToken()) return;
  try {
    const result = await fetchSyncEvents(_cursor);

    // COMM-7: needsSnapshot com razão → snapshot recovery robusto
    if (result?.needsSnapshot) {
      const reason = result.needsSnapshotReason ?? 'CURSOR_INVALID';
      if (import.meta.env.DEV) console.warn(`[syncService] needsSnapshot reason=${reason}`);
      _snapshotRecoveries++;
      _recordReplayFailure(reason);
      try {
        const snap = await fetchSyncSnapshot();
        if (isSyncSnapshot(snap)) {
          _snapshot = snap;
          _cursor   = _toCursor(snap.syncCursor) ?? _toCursor(snap.legacyCursor) ?? _cursor;
        }
      } catch { /* mantém estado */ }
      _connected  = true;
      _lastSyncAt = new Date().toISOString();
      _lastError  = null;
      return;
    }

    if (result?.events?.length > 0) {
      _replayCount++; // COMM-7: conta cada poll com eventos como replay
      result.events.forEach(_dispatch);
      result.events.forEach(_recordLag);
    }

    if (result?.nextCursor) _advanceCursor(result.nextCursor);

    _connected  = true;
    _lastSyncAt = new Date().toISOString();
    _lastError  = null;
  } catch (err) {
    _connected = false;
    _lastError = err?.message ?? 'Erro desconhecido';
    if (import.meta.env.DEV) console.warn('[syncService] Poll falhou:', _lastError);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

export const startPolling  = _startPolling;
export const stopPolling   = _stopPolling;
export const startSSE      = _tryStartSSE;
export const stopSSE_pub   = stopSSE;

export const getSnapshot    = () => _snapshot;
export const getStatus      = () => _status;
export const getCursor      = () => _cursor;
export const isBooted       = () => _booted;
export const isConnected    = () => _connected;
export const getLastSyncAt  = () => _lastSyncAt;
export const getLastError   = () => _lastError;
export const isSSEActive    = () => _sseActive && _eventSource !== null;
export const isPollingActive = () => _pollingActive;
export const pollNow        = () => _pollOnce();

/**
 * COMM-7: retorna estado interno para useSyncDiagnostics().
 */
export function getDiagnostics() {
  const mode = _status?.transport?.mode ?? (_sseActive ? 'sse' : _pollingActive ? 'polling' : 'idle');
  const redisConnected = _status?.transport?.redisConnected ?? false;
  const sseConnected = _sseActive && _eventSource !== null && _connected;
  const degraded = _status?.transport?.degraded ?? false;
  const degradedReason = degraded
    ? (_status?.transport?.lastRedisErrorMessage ?? _lastError ?? 'TRANSPORT_DEGRADED')
    : null;
  const healthScore = _status?.syncHealth?.score ?? (degraded ? 60 : 100);
  const healthStatus = _status?.syncHealth?.status ?? (degraded ? 'degraded' : 'healthy');
  const timeline = [
    ..._degradedTransitionsLog,
    ..._reconnectEvents,
    ..._replayFailures,
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    connected:              _connected,
    transportMode:          mode,
    degraded,
    transportHealth:        degraded ? 'degraded' : (redisConnected || mode === 'local-only' ? 'healthy' : 'disconnected'),
    healthScore,
    healthStatus,
    degradedReason,
    redisConnected,
    sseConnected,
    averageLagMs:           Math.round(_averageLagMs),
    latestLagMs:            Math.round(_latestLagMs),
    replayFailureCount:     _snapshotRecoveries,
    degradedTransitions:    _degradedTransitions,
    legacyCursorDetected:   _legacyCursorDetected,
    reconnectAttempts:      _sseRetryCount,
    lastSyncAt:             _lastSyncAt,
    lastEventAt:            _lastEventAt,
    replayCount:            _replayCount,
    snapshotRecoveries:     _snapshotRecoveries,
    reconnectEvents:        _reconnectEvents,
    replayFailures:         _replayFailures,
    degradedTransitionsLog: _degradedTransitionsLog,
    incidentsTimeline:      timeline,
    reconnectStorm:         _sseRetryCount >= 5,
    duplicateEventsIgnored: _duplicateEventsIgnored,
    fallbackMode:           _pollingActive && !_sseActive,
    uptimeMs:               _bootedAt ? Date.now() - new Date(_bootedAt).getTime() : 0,
  };
}

export function reset() {
  stopSSE();
  _stopPolling();
  _cursor                 = null;
  _snapshot               = null;
  _status                 = null;
  _booted                 = false;
  _connected              = false;
  _lastSyncAt             = null;
  _lastError              = null;
  _lastEventAt            = null;
  _bootedAt               = null;
  _latestLagMs            = 0;
  _averageLagMs           = 0;
  _lagSamples             = 0;
  _degradedTransitions    = 0;
  _lastDegraded           = null;
  _legacyCursorDetected   = false;
  _reconnectEvents        = [];
  _replayFailures         = [];
  _degradedTransitionsLog = [];
  _sseRetryCount          = 0;
  _sseActive              = false;
  _replayCount            = 0;
  _snapshotRecoveries     = 0;
  _duplicateEventsIgnored = 0;
  _processedIds.clear();
  _subscribers.clear();
  if (import.meta.env.DEV) console.info('[syncService] Reset completo.');
}
