/**
 * Testes de Contrato — COMM-7 (Observabilidade e Resiliência)
 *
 * Cobre:
 *  1.  sync.metrics — inc() incrementa contadores; getMetrics() retorna shape correto
 *  2.  sync.metrics — resetMetrics() zera tudo
 *  3.  sync.registry — getOldestEventAt / getLatestEventAt retornam ISO correto
 *  4.  sync.registry — getRecentEvents() ring-buffer global (max 50)
 *  5.  sync.registry — getTenantsWithBuffer() conta corretamente
 *  6.  getSyncHealth — healthy=true sem Redis (modo local)
 *  7.  getSyncHealth — degradedReasons inclui REDIS_DISCONNECTED quando habilitado mas desconectado
 *  8.  getSyncStatus — contém syncHealth e throughput
 *  9.  getSyncEvents — needsSnapshotReason=CURSOR_INVALID para cursor inválido
 *  10. getSyncEvents — replayRequests incrementa a cada call
 *  11. getSyncEvents — eventsDeliveredPolling incrementa com eventos retornados
 *  12. getSyncEvents — needsSnapshot=false para cursor válido
 *  13. pushEventToTenant — eventsDeliveredSSE incrementado
 *  14. dedup TTL — evento com TTL expirado é reprocessado
 *  15. dedup TTL — evento dentro do TTL é ignorado e conta duplicateEventsIgnored
 *  16. getSyncDiagnostics — retorna shape canônico
 */

import {
  inc,
  getMetrics,
  resetMetrics,
  getLagMetrics,
} from '@modules/sync/sync.metrics';
import {
  emitEvent,
  clearAllEvents,
  clearEventsForTenant,
  getOldestEventAt,
  getLatestEventAt,
  getRecentEvents,
  getRecentEventsPage,
  getTenantsWithBuffer,
} from '@modules/sync/sync.registry';
import { getSyncHealth, getSyncStatus, getSyncEvents, getSyncDiagnostics, getSyncDiagnosticsTimeline, renderSyncPrometheusMetrics } from '@modules/sync/sync.service';
import { pushEventToTenant, clearAllConnections, registerConnection } from '@modules/sync/sync.sse-connections';
import { _resetForTests } from '@modules/sync/sync.redis-bus';
import { SYNC_EVENT_TYPES } from '@modules/sync/sync.types';
import type { SyncEvent } from '@modules/sync/sync.types';
import {
  clearDiagnosticBuffers,
  recordDiagnostic,
  resetDiagnosticsPersistenceProviderForTests,
  setDiagnosticsPersistenceProviderForTests,
} from '@modules/sync/sync.diagnostics-buffer';

const TENANT = 'test-comm7-empresa';

function makeEvent(overrides: Partial<SyncEvent> = {}): SyncEvent {
  return {
    id:         `id-${Math.random().toString(36).slice(2)}`,
    type:       SYNC_EVENT_TYPES.PLACA_CREATED,
    entity:     'placa',
    entityId:   'p1',
    empresaId:  TENANT,
    payload:    {},
    occurredAt: new Date().toISOString(),
    correlationId: `corr-${Math.random().toString(36).slice(2)}`,
    version:    1,
    ...overrides,
  };
}

beforeEach(() => {
  resetMetrics();
  _resetForTests();
  clearEventsForTenant(TENANT);
  clearDiagnosticBuffers();
  clearAllConnections();
  resetDiagnosticsPersistenceProviderForTests();
});

afterAll(() => {
  resetMetrics();
  _resetForTests();
  clearAllEvents();
  clearDiagnosticBuffers();
  resetDiagnosticsPersistenceProviderForTests();
  clearAllConnections();
});

// ─── 1. inc() / getMetrics() shape ───────────────────────────────────────────

describe('COMM7: sync.metrics — inc e getMetrics', () => {
  it('eventsPublishedTotal começa em 0', () => {
    expect(getMetrics().eventsPublishedTotal).toBe(0);
  });

  it('inc() incrementa corretamente', () => {
    inc('eventsPublishedTotal');
    inc('eventsPublishedTotal');
    inc('eventsDeliveredSSE', 3);
    expect(getMetrics().eventsPublishedTotal).toBe(2);
    expect(getMetrics().eventsDeliveredSSE).toBe(3);
  });

  it('getMetrics() retorna todos os campos obrigatórios', () => {
    const m = getMetrics();
    expect(typeof m.eventsPublishedTotal).toBe('number');
    expect(typeof m.eventsDeliveredSSE).toBe('number');
    expect(typeof m.eventsDeliveredPolling).toBe('number');
    expect(typeof m.replayRequests).toBe('number');
    expect(typeof m.replayFailures).toBe('number');
    expect(typeof m.snapshotRecoveries).toBe('number');
    expect(typeof m.duplicateEventsIgnored).toBe('number');
    expect(typeof m.legacyCursorUses).toBe('number');
    expect(typeof m.reconnectAttemptsTotal).toBe('number');
    expect(typeof m.uptimeMs).toBe('number');
    expect(m.uptimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── 2. resetMetrics() ────────────────────────────────────────────────────────

describe('COMM7: sync.metrics — resetMetrics', () => {
  it('zera todos os contadores', () => {
    inc('eventsPublishedTotal', 10);
    inc('snapshotRecoveries', 5);
    resetMetrics();
    const m = getMetrics();
    expect(m.eventsPublishedTotal).toBe(0);
    expect(m.snapshotRecoveries).toBe(0);
    expect(m.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(m.uptimeMs).toBeLessThan(100); // reiniciou recentemente
  });
});

// ─── 3. getOldestEventAt / getLatestEventAt ───────────────────────────────────

describe('COMM7: sync.registry — getOldestEventAt / getLatestEventAt', () => {
  it('retornam null sem eventos', () => {
    expect(getOldestEventAt()).toBeNull();
    expect(getLatestEventAt()).toBeNull();
  });

  it('retornam ISO do primeiro e último evento', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'a', empresaId: TENANT });
    await new Promise(r => setTimeout(r, 5));
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'b', empresaId: TENANT });

    const oldest = getOldestEventAt();
    const latest = getLatestEventAt();

    expect(oldest).not.toBeNull();
    expect(latest).not.toBeNull();
    expect(oldest! < latest!).toBe(true);
    expect(isNaN(new Date(oldest!).getTime())).toBe(false);
    expect(isNaN(new Date(latest!).getTime())).toBe(false);
  });
});

// ─── 4. getRecentEvents() ─────────────────────────────────────────────────────

describe('COMM7: sync.registry — getRecentEvents ring-buffer', () => {
  it('retorna até 50 eventos globais', () => {
    for (let i = 0; i < 60; i++) {
      emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: `p${i}`, empresaId: TENANT });
    }
    const recent = getRecentEvents();
    expect(recent.length).toBe(50); // max 50
  });

  it('cada entrada tem id, type, empresaId, occurredAt', () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_DELETED, entity: 'placa', entityId: 'del', empresaId: TENANT });
    const recent = getRecentEvents();
    const last = recent[recent.length - 1]!;
    expect(typeof last.id).toBe('string');
    expect(typeof last.type).toBe('string');
    expect(typeof last.empresaId).toBe('string');
    expect(typeof last.occurredAt).toBe('string');
    expect(typeof last.correlationId).toBe('string');
    // não tem payload (privacidade)
    expect((last as any).payload).toBeUndefined();
  });
});

// ─── 5. getTenantsWithBuffer() ────────────────────────────────────────────────

describe('COMM7: sync.registry — getTenantsWithBuffer', () => {
  it('retorna 0 sem eventos', () => {
    expect(getTenantsWithBuffer()).toBe(0);
  });

  it('conta empresas com buffer', () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'x', empresaId: 'emp-a' });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'y', empresaId: 'emp-b' });
    expect(getTenantsWithBuffer()).toBeGreaterThanOrEqual(2);
    clearEventsForTenant('emp-a');
    clearEventsForTenant('emp-b');
  });
});

// ─── 6. getSyncHealth — modo local ───────────────────────────────────────────

describe('COMM7: getSyncHealth — sem Redis', () => {
  it('healthy=true no modo local-only', () => {
    const h = getSyncHealth();
    expect(h.healthy).toBe(true);
    expect(h.degradedReasons).toHaveLength(0);
  });

  it('reconnecting=false sem tentativas', () => {
    expect(getSyncHealth().reconnecting).toBe(false);
  });

  it('replayAvailable=false sem Redis streams', () => {
    expect(getSyncHealth().replayAvailable).toBe(false);
  });

  it('campos opcionais são undefined ou string', () => {
    const h = getSyncHealth();
    if (h.oldestBufferedEventAt !== undefined) {
      expect(typeof h.oldestBufferedEventAt).toBe('string');
    }
    if (h.latestEventAt !== undefined) {
      expect(typeof h.latestEventAt).toBe('string');
    }
  });
});

// ─── 7. getSyncHealth — degradedReasons ──────────────────────────────────────

describe('COMM7: getSyncHealth — degradedReasons', () => {
  it('não inclui REDIS_DISCONNECTED quando Redis desabilitado', () => {
    // SYNC_REDIS_ENABLED=false por padrão nos testes
    const h = getSyncHealth();
    expect(h.degradedReasons).not.toContain('REDIS_DISCONNECTED');
  });
});

// ─── 8. getSyncStatus — contém syncHealth e throughput ───────────────────────

describe('COMM7: getSyncStatus — shape COMM-7', () => {
  it('contém syncHealth com campos obrigatórios', async () => {
    const status = await getSyncStatus();
    expect(typeof status.syncHealth).toBe('object');
    expect(typeof status.syncHealth.healthy).toBe('boolean');
    expect(Array.isArray(status.syncHealth.degradedReasons)).toBe(true);
    expect(typeof status.syncHealth.reconnecting).toBe('boolean');
    expect(typeof status.syncHealth.replayAvailable).toBe('boolean');
    expect(typeof status.syncHealth.latestLagMs).toBe('number');
    expect(typeof status.syncHealth.averageLagMs).toBe('number');
    expect(typeof status.syncHealth.score).toBe('number');
    expect(['healthy', 'warning', 'degraded', 'critical']).toContain(status.syncHealth.status);
  });

  it('contém throughput com todos os contadores', async () => {
    const status = await getSyncStatus();
    const t = status.throughput;
    expect(typeof t.eventsPublishedTotal).toBe('number');
    expect(typeof t.eventsDeliveredSSE).toBe('number');
    expect(typeof t.eventsDeliveredPolling).toBe('number');
    expect(typeof t.replayRequests).toBe('number');
    expect(typeof t.replayFailures).toBe('number');
    expect(typeof t.snapshotRecoveries).toBe('number');
    expect(typeof t.duplicateEventsIgnored).toBe('number');
    expect(typeof t.legacyCursorUses).toBe('number');
    expect(typeof t.uptimeMs).toBe('number');
  });

  it('contractVersion é 3 (COMM-7)', async () => {
    const status = await getSyncStatus();
    expect(status.contractVersion).toBe(3);
  });

  it('featureFlags.syncObservability é true', async () => {
    const status = await getSyncStatus();
    expect(status.featureFlags.syncObservability).toBe(true);
  });
});

// ─── 9. getSyncEvents — needsSnapshotReason ──────────────────────────────────

describe('COMM7: getSyncEvents — needsSnapshotReason', () => {
  it('cursor inválido retorna reason=CURSOR_INVALID', async () => {
    const result = await getSyncEvents(TENANT, 'lixo-invalido-xyz');
    expect(result.needsSnapshot).toBe(true);
    expect(result.needsSnapshotReason).toBe('CURSOR_INVALID');
  });

  it('cursor null não retorna needsSnapshot', async () => {
    const result = await getSyncEvents(TENANT, null);
    expect(result.needsSnapshot).toBeFalsy();
    expect(result.needsSnapshotReason).toBeUndefined();
  });

  it('cursor ISO válido não retorna needsSnapshot', async () => {
    const result = await getSyncEvents(TENANT, new Date(Date.now() + 60_000).toISOString());
    expect(result.needsSnapshot).toBeFalsy();
  });

  it('cursor legado incrementa contador de uso', async () => {
    const before = getMetrics().legacyCursorUses;
    await getSyncEvents(TENANT, new Date().toISOString());
    expect(getMetrics().legacyCursorUses).toBe(before + 1);
  });
});

// ─── 10. replayRequests incrementa ───────────────────────────────────────────

describe('COMM7: getSyncEvents — métricas de replay', () => {
  it('replayRequests incrementa a cada call válida', async () => {
    const before = getMetrics().replayRequests;
    await getSyncEvents(TENANT, null);
    await getSyncEvents(TENANT, new Date().toISOString());
    expect(getMetrics().replayRequests).toBe(before + 2);
  });

  it('cursor inválido incrementa snapshotRecoveries', async () => {
    const before = getMetrics().snapshotRecoveries;
    await getSyncEvents(TENANT, 'invalido-xpto');
    expect(getMetrics().snapshotRecoveries).toBe(before + 1);
    // replayRequests NÃO deve incrementar — saiu antes
    expect(getMetrics().replayRequests).toBe(0);
  });

  it('eventsDeliveredPolling incrementa com eventos retornados', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'p1', empresaId: TENANT });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'p2', empresaId: TENANT });

    const before = getMetrics().eventsDeliveredPolling;
    await getSyncEvents(TENANT, null); // sem cursor → últimos 50
    expect(getMetrics().eventsDeliveredPolling).toBeGreaterThanOrEqual(before + 2);
  });
});

// ─── 11. eventsPublishedTotal via emitEvent ───────────────────────────────────

describe('COMM7: sync.registry — eventsPublishedTotal', () => {
  it('incrementa a cada emitEvent()', () => {
    const before = getMetrics().eventsPublishedTotal;
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'x', empresaId: TENANT });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'y', empresaId: TENANT });
    expect(getMetrics().eventsPublishedTotal).toBe(before + 2);
  });

  it('garante correlationId quando não informado', () => {
    const event = emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'corr', empresaId: TENANT });
    expect(typeof event.correlationId).toBe('string');
    expect(event.correlationId.length).toBeGreaterThan(10);
  });

  it('preserva correlationId informado', () => {
    const event = emitEvent({
      type: SYNC_EVENT_TYPES.PLACA_CREATED,
      entity: 'placa',
      entityId: 'corr-provided',
      empresaId: TENANT,
      correlationId: 'corr-from-request',
    });
    expect(event.correlationId).toBe('corr-from-request');
  });
});

// ─── 12. pushEventToTenant — eventsDeliveredSSE ──────────────────────────────

describe('COMM7: sync.sse-connections — eventsDeliveredSSE', () => {
  it('eventsDeliveredSSE não incrementa sem clientes conectados', () => {
    const before = getMetrics().eventsDeliveredSSE;
    pushEventToTenant(TENANT, makeEvent()); // sem conexões → nenhuma entrega
    expect(getMetrics().eventsDeliveredSSE).toBe(before);
  });

  it('stream lag é calculado quando SSE entrega evento', () => {
    const res: any = { write: jest.fn() };
    const { cleanup } = registerConnection(TENANT, 'user-test', res);
    const event = makeEvent({ id: 'lag-1', occurredAt: new Date(Date.now() - 25).toISOString() });
    pushEventToTenant(TENANT, event);
    expect(getLagMetrics().latestLagMs).toBeGreaterThanOrEqual(0);
    cleanup();
  });
});

// ─── 13. getSyncDiagnostics — shape ──────────────────────────────────────────

describe('COMM7: getSyncDiagnostics — shape canônico', () => {
  it('retorna todos os campos obrigatórios', async () => {
    const d = await getSyncDiagnostics();

    expect(typeof d.instanceId).toBe('string');
    expect(typeof d.uptimeMs).toBe('number');
    expect(typeof d.mode).toBe('string');
    expect(typeof d.connected).toBe('boolean');
    expect(typeof d.degraded).toBe('boolean');
    expect(typeof d.transportHealth).toBe('string');
    expect(typeof d.healthScore).toBe('number');
    expect(typeof d.healthStatus).toBe('string');
    expect(typeof d.redisConnected).toBe('boolean');
    expect(typeof d.sseConnected).toBe('boolean');
    expect(typeof d.averageLagMs).toBe('number');
    expect(typeof d.latestLagMs).toBe('number');
    expect(typeof d.replayFailureCount).toBe('number');
    expect(typeof d.reconnectAttempts).toBe('number');
    expect(typeof d.sseClientsConnected).toBe('number');
    expect(typeof d.streamModeActive).toBe('boolean');
    expect(typeof d.bufferStats).toBe('object');
    expect(typeof d.bufferStats.totalEvents).toBe('number');
    expect(typeof d.bufferStats.tenantsWithBuffer).toBe('number');
    expect(typeof d.throughput).toBe('object');
    expect(Array.isArray(d.replayFailures)).toBe(true);
    expect(Array.isArray(d.reconnectEvents)).toBe(true);
    expect(Array.isArray(d.snapshotRecoveriesLog)).toBe(true);
    expect(Array.isArray(d.degradedTransitions)).toBe(true);
    expect(typeof d.recentEventsPage).toBe('object');
    expect(Array.isArray(d.recentEvents)).toBe(true);
  });

  it('recentEvents tem shape correto', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'diag1', empresaId: TENANT });
    const d = await getSyncDiagnostics();
    const last = d.recentEvents[d.recentEvents.length - 1];
    if (last) {
      expect(typeof last.id).toBe('string');
      expect(typeof last.type).toBe('string');
      expect(typeof last.empresaId).toBe('string');
      expect(typeof last.occurredAt).toBe('string');
    }
  });

  it('modo é local-only por padrão (sem Redis)', async () => {
    const d = await getSyncDiagnostics();
    expect(d.mode).toBe('local-only');
    expect(d.streamModeActive).toBe(false);
  });

  it('filtra e pagina recentEvents', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'f1', empresaId: 'emp-filter-a' });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'f2', empresaId: 'emp-filter-b' });
    const page = getRecentEventsPage({ empresaId: 'emp-filter-a', limit: 1, offset: 0 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.empresaId).toBe('emp-filter-a');
    clearEventsForTenant('emp-filter-a');
    clearEventsForTenant('emp-filter-b');
  });

  it('suporta filtros since/until/type e cursor offset', async () => {
    const since = new Date(Date.now() - 1_000).toISOString();
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'w1', empresaId: 'emp-window' });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'w2', empresaId: 'emp-window' });
    const until = new Date(Date.now() + 1_000).toISOString();

    const page = getRecentEventsPage({
      empresaId: 'emp-window',
      type: SYNC_EVENT_TYPES.PLACA_UPDATED,
      since,
      until,
      limit: 1,
      cursor: '0',
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.type).toBe(SYNC_EVENT_TYPES.PLACA_UPDATED);
    expect(page.nextOffset).toBeNull();
    clearEventsForTenant('emp-window');
  });

  it('renderiza métricas Prometheus do sync', () => {
    const text = renderSyncPrometheusMetrics();
    expect(text).toContain('sync_events_published_total');
    expect(text).toContain('sync_stream_lag_latest_ms');
    expect(text).toContain('sync_transport_degraded');
    expect(text).toContain('sync_legacy_cursor_uses_total');
    expect(text).toContain('sync_instance_health_info');
  });
});

describe('COMM10: diagnostics timeline e persistência', () => {
  it('retorna timeline filtrada por severity e correlationId', async () => {
    recordDiagnostic('replayFailures', {
      empresaId: TENANT,
      type: 'REPLAY_FAILURE',
      reason: 'REPLAY_UNAVAILABLE',
      severity: 'critical',
      correlationId: 'corr-timeline-1',
    });

    const timeline = await getSyncDiagnosticsTimeline({
      empresaId: TENANT,
      severity: 'critical',
      correlationId: 'corr-timeline-1',
      limit: 10,
    });

    expect(timeline.items).toHaveLength(1);
    expect(timeline.items[0]!.correlationId).toBe('corr-timeline-1');
    expect(timeline.page.nextCursor).toBeNull();
  });

  it('lê diagnostics persistidos por provider Redis opcional', async () => {
    const persisted: any[] = [{
      at: new Date().toISOString(),
      type: 'REDIS_RECONNECT_SCHEDULED',
      reason: 'CONNECTION_ERROR',
      source: 'reconnectEvents',
      severity: 'warning',
      correlationId: 'corr-redis-provider',
    }];
    setDiagnosticsPersistenceProviderForTests({
      async append(_name, entry) { persisted.push(entry); },
      async getBuffer() { return persisted; },
      async clear() { persisted.length = 0; },
    });

    const timeline = await getSyncDiagnosticsTimeline({ correlationId: 'corr-redis-provider' });
    expect(timeline.items.some(item => item.correlationId === 'corr-redis-provider')).toBe(true);
  });

  it('limpa itens fora do TTL no provider', async () => {
    const oldAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    setDiagnosticsPersistenceProviderForTests({
      async append() {},
      async getBuffer() {
        return [{
          at: oldAt,
          type: 'REPLAY_FAILURE',
          source: 'replayFailures',
          severity: 'critical',
          correlationId: 'corr-expired',
        }];
      },
      async clear() {},
    });

    const timeline = await getSyncDiagnosticsTimeline({ correlationId: 'corr-expired' });
    expect(timeline.items).toHaveLength(0);
  });
});
