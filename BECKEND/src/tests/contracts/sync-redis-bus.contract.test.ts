/**
 * Testes de Contrato — Redis Bus (COMM-4)
 *
 * Cobre:
 * 1. Modo local-only quando SYNC_REDIS_ENABLED=false (default em testes)
 * 2. emitEvent salva no buffer local mesmo sem Redis
 * 3. storeEventFromRemote salva no buffer local sem push SSE
 * 4. INSTANCE_ID é string UUID não-vazia
 * 5. publish() é no-op quando Redis desabilitado (sem crash)
 * 6. SyncStatus contém campos de transport (modo, instanceId, etc.)
 * 7. getTotalBufferSize reflete eventos acumulados
 * 8. Métricas de SSE clients refletem conexões reais
 */

import {
  isEnabled,
  isConnected,
  getMode,
  getInstanceId,
  publish,
  _resetForTests,
} from '@modules/sync/sync.redis-bus';
import {
  emitEvent,
  storeEventFromRemote,
  clearAllEvents,
  getEventsSince,
  getTotalBufferSize,
} from '@modules/sync/sync.registry';
import {
  registerConnection,
  clearAllConnections,
} from '@modules/sync/sync.sse-connections';
import { getSyncStatus } from '@modules/sync/sync.service';
import { SYNC_EVENT_TYPES } from '@modules/sync/sync.types';
import type { SyncEvent } from '@modules/sync/sync.types';
import { Response } from 'express';

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeSyncEvent(overrides: Partial<SyncEvent> = {}): SyncEvent {
  return {
    id:         `test-${Math.random().toString(36).slice(2)}`,
    type:       SYNC_EVENT_TYPES.PLACA_STATUS_CHANGED,
    entity:     'placa',
    entityId:   'p1',
    empresaId:  'emp-redis-test',
    payload:    { disponivel: false },
    occurredAt: new Date().toISOString(),
    correlationId: `corr-${Math.random().toString(36).slice(2)}`,
    version:    1,
    ...overrides,
  };
}

function makeMockRes(): Response {
  const written: string[] = [];
  return {
    write: (c: string) => { written.push(c); return true; },
    end: () => {},
    _written: written,
  } as unknown as Response;
}

// ─── Setup/Teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  _resetForTests();
  clearAllEvents();
  clearAllConnections();
});

afterAll(() => {
  _resetForTests();
  clearAllEvents();
  clearAllConnections();
});

// ─── 1. Modo local-only (default em testes) ───────────────────────────────────

describe('RedisBusContract: modo local-only', () => {
  it('isEnabled() é false quando SYNC_REDIS_ENABLED não está definido', () => {
    expect(isEnabled()).toBe(false);
  });

  it('getMode() retorna "local-only" quando Redis não está conectado', () => {
    expect(getMode()).toBe('local-only');
  });

  it('isConnected() é false no modo local-only', () => {
    expect(isConnected()).toBe(false);
  });
});

// ─── 2. INSTANCE_ID ───────────────────────────────────────────────────────────

describe('RedisBusContract: INSTANCE_ID', () => {
  it('é string não-vazia', () => {
    const id = getInstanceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(10);
  });

  it('tem formato UUID (com hífens)', () => {
    const id = getInstanceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

// ─── 3. publish() sem crash quando Redis desabilitado ────────────────────────

describe('RedisBusContract: publish() graceful degradation', () => {
  it('publish() retorna sem erro quando Redis desabilitado', async () => {
    const event = makeSyncEvent();
    await expect(publish(event)).resolves.not.toThrow();
  });

  it('múltiplos publish() sem Redis não causam crash', async () => {
    for (let i = 0; i < 5; i++) {
      await publish(makeSyncEvent({ id: `pub-${i}` }));
    }
    expect(true).toBe(true); // chegou aqui sem exceção
  });
});

// ─── 4. emitEvent salva no buffer local ──────────────────────────────────────

describe('RedisBusContract: emitEvent com modo local-only', () => {
  it('emitEvent salva no buffer mesmo sem Redis', () => {
    const empresaId = 'emp-local-1';
    emitEvent({
      type:      SYNC_EVENT_TYPES.PLACA_CREATED,
      entity:    'placa',
      entityId:  'p1',
      empresaId,
      payload:   { numero_placa: 'TEST-001' },
    });

    const events = getEventsSince(empresaId, '');
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('PLACA_CREATED');
  });

  it('emitEvent retorna SyncEvent com id e occurredAt', () => {
    const event = emitEvent({
      type:      SYNC_EVENT_TYPES.PLACA_DELETED,
      entity:    'placa',
      entityId:  'p2',
      empresaId: 'emp-local-2',
    });

    expect(typeof event.id).toBe('string');
    expect(typeof event.occurredAt).toBe('string');
    expect(new Date(event.occurredAt).getTime()).toBeGreaterThan(0);
  });
});

// ─── 5. storeEventFromRemote ──────────────────────────────────────────────────

describe('RedisBusContract: storeEventFromRemote', () => {
  it('salva evento remoto no buffer local', () => {
    const empresaId = 'emp-remote-1';
    const event = makeSyncEvent({ empresaId, id: 'remote-evt-001' });

    storeEventFromRemote(event);

    const events = getEventsSince(empresaId, '');
    expect(events.length).toBe(1);
    expect(events[0]!.id).toBe('remote-evt-001');
  });

  it('storeEventFromRemote não faz push SSE (SSE é responsabilidade do redis-bus)', () => {
    const res = makeMockRes() as any;
    const empresaId = 'emp-remote-2';
    registerConnection(empresaId, 'u1', res);

    const event = makeSyncEvent({ empresaId });
    storeEventFromRemote(event);

    // SSE NÃO deve ter sido escrito por storeEventFromRemote
    expect(res._written.length).toBe(0);
  });
});

// ─── 6. getTotalBufferSize ────────────────────────────────────────────────────

describe('RedisBusContract: getTotalBufferSize', () => {
  it('retorna 0 com store vazio', () => {
    expect(getTotalBufferSize()).toBe(0);
  });

  it('reflete eventos de múltiplas empresas', () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'a', empresaId: 'empA' });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'b', empresaId: 'empA' });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'c', empresaId: 'empB' });

    expect(getTotalBufferSize()).toBe(3);
  });
});

// ─── 7. SyncStatus.transport ─────────────────────────────────────────────────

describe('RedisBusContract: getSyncStatus.transport', () => {
  it('retorna campos de transport no status', async () => {
    const status = await getSyncStatus();

    expect(status.transport).toBeDefined();
    expect(typeof status.transport.mode).toBe('string');
    expect(typeof status.transport.redisEnabled).toBe('boolean');
    expect(typeof status.transport.redisConnected).toBe('boolean');
    expect(typeof status.transport.sseClientsConnected).toBe('number');
    expect(typeof status.transport.eventBufferSize).toBe('number');
    expect(typeof status.transport.instanceId).toBe('string');
  });

  it('transport.mode é "local-only" quando Redis desabilitado', async () => {
    const status = await getSyncStatus();
    expect(status.transport.mode).toBe('local-only');
    expect(status.transport.redisEnabled).toBe(false);
    expect(status.transport.redisConnected).toBe(false);
  });

  it('transport.instanceId é o mesmo do getInstanceId()', async () => {
    const status = await getSyncStatus();
    expect(status.transport.instanceId).toBe(getInstanceId());
  });

  it('transport.sseClientsConnected reflete conexões reais', async () => {
    const res = makeMockRes();
    const { cleanup } = registerConnection('emp-metrics', 'user1', res);

    const status = await getSyncStatus();
    expect(status.transport.sseClientsConnected).toBeGreaterThanOrEqual(1);

    cleanup();
  });

  it('transport.eventBufferSize reflete buffer acumulado', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'x', empresaId: 'emp-buffer' });

    const status = await getSyncStatus();
    expect(status.transport.eventBufferSize).toBeGreaterThanOrEqual(1);
  });

  it('featureFlags.redisDistributed é false em modo local-only', async () => {
    const status = await getSyncStatus();
    expect(status.featureFlags.redisDistributed).toBe(false);
  });
});
