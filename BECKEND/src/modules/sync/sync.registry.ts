/**
 * Sync Event Registry — COMM-4
 *
 * COMM-7:
 *   - métrica eventsPublishedTotal incrementada em emitEvent()
 *   - getOldestEventAt() / getLatestEventAt() para syncHealth
 *   - getRecentEvents() para o endpoint de diagnostics
 *   - recentEvents ring-buffer global (últimos 50, todas as empresas)
 *
 * Buffer em memória de eventos de domínio recentes.
 * Design: circular buffer por empresa — máximo MAX_EVENTS_PER_TENANT.
 *
 * COMM-6: cursor canônico por modo de transporte.
 */

import { randomUUID } from 'crypto';
import { Log } from '@shared/core';
import { inc, recordPublishTimestamp } from './sync.metrics';
import type { SyncEvent, SyncEventType, AnyCursor } from './sync.types';
import { parseCursor } from './sync.types';

// ─── Lazy imports ─────────────────────────────────────────────────────────────

let _sseModule: typeof import('./sync.sse-connections') | null = null;
async function getSseModule() {
  if (!_sseModule) _sseModule = await import('./sync.sse-connections');
  return _sseModule;
}

let _redisBusModule: typeof import('./sync.redis-bus') | null = null;
async function getRedisBusModule() {
  if (!_redisBusModule) _redisBusModule = await import('./sync.redis-bus');
  return _redisBusModule;
}

// ─── Buffer local por empresa ─────────────────────────────────────────────────

const MAX_EVENTS_PER_TENANT = 500;

const store = new Map<string, SyncEvent[]>();

function _appendToStore(empresaId: string, event: SyncEvent): void {
  if (!store.has(empresaId)) store.set(empresaId, []);
  const list = store.get(empresaId)!;
  list.push(event);
  if (list.length > MAX_EVENTS_PER_TENANT) {
    list.splice(0, list.length - MAX_EVENTS_PER_TENANT);
  }
}

// ─── Ring-buffer global de eventos recentes (diagnostics) ─────────────────────

const MAX_RECENT = 50;
type RecentEvent = Pick<SyncEvent, 'id' | 'type' | 'empresaId' | 'occurredAt' | 'correlationId'>;
const _recentEvents: RecentEvent[] = [];

function _appendRecent(event: SyncEvent): void {
  _recentEvents.push({
    id: event.id,
    type: event.type,
    empresaId: event.empresaId,
    occurredAt: event.occurredAt,
    correlationId: event.correlationId,
  });
  if (_recentEvents.length > MAX_RECENT) _recentEvents.shift();
}

// ─── emitEvent ────────────────────────────────────────────────────────────────

export function emitEvent(params: {
  type: SyncEventType;
  entity: string;
  entityId: string;
  empresaId: string;
  payload?: Record<string, unknown>;
  actorId?: string;
  correlationId?: string;
}): SyncEvent {
  const event: SyncEvent = {
    id:            randomUUID(),
    type:          params.type,
    entity:        params.entity,
    entityId:      params.entityId,
    empresaId:     params.empresaId,
    payload:       params.payload ?? {},
    occurredAt:    new Date().toISOString(),
    actorId:       params.actorId,
    correlationId: params.correlationId ?? randomUUID(),
    version:       1,
  };

  _appendToStore(params.empresaId, event);
  _appendRecent(event);

  inc('eventsPublishedTotal'); // COMM-7
  recordPublishTimestamp(event.id);

  Log.info(`[SyncRegistry] Evento emitido: ${event.type} | entity=${event.entity}/${event.entityId} | empresa=${event.empresaId} correlationId=${event.correlationId}`);

  getSseModule().then(sse => {
    sse.pushEventToTenant(params.empresaId, event);
    // cursorValue = event.occurredAt (default no pushEventToTenant)
  }).catch(() => {});

  getRedisBusModule().then(bus => {
    bus.publish(event);
  }).catch(() => {});

  return event;
}

// ─── storeEventFromRemote ─────────────────────────────────────────────────────

export function storeEventFromRemote(event: SyncEvent): void {
  _appendToStore(event.empresaId, event);
  _appendRecent(event);
  Log.info(`[SyncRegistry] Evento remoto armazenado: ${event.type} | empresa=${event.empresaId} | id=${event.id} correlationId=${event.correlationId}`);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * COMM-6/7: retorna eventos desde cursor.
 * Replay path unificado: parseCursor() → buffer/streams → nextCursor.
 * Retorna null se cursor for inválido (sinaliza needsSnapshot ao caller).
 */
export async function getEventsSinceAsync(
  empresaId: string,
  cursor: AnyCursor | null | undefined
): Promise<SyncEvent[] | null> {
  try {
    const { getMode, readStreamSince, isConnected, isDegraded } = await getRedisBusModule();
    if (getMode() === 'redis-streams' && isConnected() && !isDegraded()) {
      const parsed = parseCursor(cursor);
      const streamCursorValue = (parsed?.mode === 'streams') ? parsed.value : '0-0';
      const remote = await readStreamSince(empresaId, streamCursorValue);
      const local  = _getLocalSince(empresaId, cursor);
      const seenIds = new Set(local.map(e => e.id));
      const merged  = [...local];
      for (const e of remote) {
        if (!seenIds.has(e.id)) merged.push(e);
      }
      merged.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      return merged;
    }
  } catch { /* fallback local */ }

  return _getLocalSince(empresaId, cursor);
}

export function getEventsSince(empresaId: string, cursor: AnyCursor | null | undefined): SyncEvent[] {
  return _getLocalSince(empresaId, cursor);
}

function _getLocalSince(empresaId: string, cursor: AnyCursor | null | undefined): SyncEvent[] {
  const list = store.get(empresaId) ?? [];
  if (!cursor) return list.slice(-50);
  const parsed = parseCursor(cursor);
  if (!parsed) return list.slice(-50);
  if (parsed.mode === 'streams') return [...list];
  const cutoff = new Date(parsed.value).getTime();
  if (isNaN(cutoff)) return [];
  return list.filter(e => new Date(e.occurredAt).getTime() > cutoff);
}

// ─── Métricas de buffer — COMM-7 ──────────────────────────────────────────────

export function latestIsoForTenant(empresaId: string): string {
  const list = store.get(empresaId) ?? [];
  if (list.length === 0) return new Date().toISOString();
  return list[list.length - 1]!.occurredAt;
}

/** @deprecated Use latestIsoForTenant. */
export function latestCursorForTenant(empresaId: string): string {
  return latestIsoForTenant(empresaId);
}

/** ISO do evento mais antigo no buffer de todas as empresas, ou null se vazio. */
export function getOldestEventAt(): string | null {
  let oldest: string | null = null;
  for (const list of store.values()) {
    if (list.length === 0) continue;
    const t = list[0]!.occurredAt;
    if (!oldest || t < oldest) oldest = t;
  }
  return oldest;
}

/** ISO do evento mais recente no buffer de todas as empresas, ou null se vazio. */
export function getLatestEventAt(): string | null {
  let latest: string | null = null;
  for (const list of store.values()) {
    if (list.length === 0) continue;
    const t = list[list.length - 1]!.occurredAt;
    if (!latest || t > latest) latest = t;
  }
  return latest;
}

/** Últimos eventos globais. Sem filtros preserva o contrato COMM-7. */
export function getRecentEvents(): RecentEvent[] {
  return [..._recentEvents];
}

/** Eventos recentes globais filtrados/paginados para diagnostics. */
export function getRecentEventsPage(options: {
  empresaId?: string;
  type?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
} = {}): { items: RecentEvent[]; total: number; limit: number; offset: number; nextOffset: number | null } {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursorOffset = options.cursor ? Number(options.cursor) : NaN;
  const offset = Math.max(Number.isFinite(cursorOffset) ? cursorOffset : (options.offset ?? 0), 0);
  const sinceMs = options.since ? new Date(options.since).getTime() : NaN;
  const untilMs = options.until ? new Date(options.until).getTime() : NaN;
  const filtered = _recentEvents.filter(event => {
    const occurredAtMs = new Date(event.occurredAt).getTime();
    if (options.empresaId && event.empresaId !== options.empresaId) return false;
    if (options.type && event.type !== options.type) return false;
    if (!Number.isNaN(sinceMs) && occurredAtMs <= sinceMs) return false;
    if (!Number.isNaN(untilMs) && occurredAtMs > untilMs) return false;
    return true;
  });
  const items = filtered.slice(offset, offset + limit);
  return {
    items,
    total: filtered.length,
    limit,
    offset,
    nextOffset: offset + limit < filtered.length ? offset + limit : null,
  };
}

/** Número de empresas com buffer não-vazio. */
export function getTenantsWithBuffer(): number {
  let count = 0;
  for (const list of store.values()) if (list.length > 0) count++;
  return count;
}

export function getBufferSizeForTenant(empresaId: string): number {
  return store.get(empresaId)?.length ?? 0;
}

export function getTotalBufferSize(): number {
  let total = 0;
  for (const list of store.values()) total += list.length;
  return total;
}

// ─── Helpers de teste ─────────────────────────────────────────────────────────

export function clearEventsForTenant(empresaId: string): void {
  store.delete(empresaId);
}

export function clearAllEvents(): void {
  store.clear();
  _recentEvents.length = 0;
}
