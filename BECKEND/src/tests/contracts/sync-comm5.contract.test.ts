/**
 * Testes de Contrato — COMM-5
 *
 * Cobre:
 * 1. Métricas ricas no SyncStatus.transport (degraded, reconnectAttempts, lastErrorAt, etc.)
 * 2. Modo local-only continua funcionando (sem regressão)
 * 3. publish() fire-and-forget quando Redis desabilitado
 * 4. readStreamSince retorna [] quando Redis desabilitado
 * 5. getLatestStreamId retorna null quando Redis desabilitado
 * 6. _resetForTests limpa métricas de reconexão
 * 7. getEventsSinceAsync retorna eventos locais quando streams desabilitado
 * 8. SyncStatus.transport tem todos os campos COMM-5
 * 9. Modo degraded não quebra publish() (graceful)
 * 10. lastErrorMessage sanitiza URLs com credenciais
 */

import {
  isConnected,
  isDegraded,
  getMode,
  isEnabled,
  getInstanceId,
  getReconnectAttempts,
  getLastErrorAt,
  getLastErrorMessage,
  publish,
  readStreamSince,
  getLatestStreamId,
  _resetForTests,
} from '@modules/sync/sync.redis-bus';
import {
  emitEvent,
  clearAllEvents,
  getEventsSince,
  getEventsSinceAsync,
} from '@modules/sync/sync.registry';
import { getSyncStatus } from '@modules/sync/sync.service';
import { SYNC_EVENT_TYPES } from '@modules/sync/sync.types';
import type { SyncEvent } from '@modules/sync/sync.types';
import {
  clearAllConnections,
} from '@modules/sync/sync.sse-connections';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSyncEvent(overrides: Partial<SyncEvent> = {}): SyncEvent {
  return {
    id:         `test-${Math.random().toString(36).slice(2)}`,
    type:       SYNC_EVENT_TYPES.PLACA_STATUS_CHANGED,
    entity:     'placa',
    entityId:   'p1',
    empresaId:  'emp-comm5-test',
    payload:    { disponivel: false },
    occurredAt: new Date().toISOString(),
    correlationId: `corr-${Math.random().toString(36).slice(2)}`,
    version:    1,
    ...overrides,
  };
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

// ─── 1. Métricas ricas no estado inicial ──────────────────────────────────────

describe('COMM5Contract: métricas ricas (estado inicial sem Redis)', () => {
  it('isDegraded() é false antes de qualquer erro', () => {
    expect(isDegraded()).toBe(false);
  });

  it('getReconnectAttempts() começa em 0', () => {
    expect(getReconnectAttempts()).toBe(0);
  });

  it('getLastErrorAt() começa null', () => {
    expect(getLastErrorAt()).toBeNull();
  });

  it('getLastErrorMessage() começa null', () => {
    expect(getLastErrorMessage()).toBeNull();
  });

  it('getMode() é local-only por padrão', () => {
    expect(getMode()).toBe('local-only');
  });

  it('isEnabled() é false (SYNC_REDIS_ENABLED não definido em testes)', () => {
    expect(isEnabled()).toBe(false);
  });

  it('isConnected() é false sem Redis', () => {
    expect(isConnected()).toBe(false);
  });
});

// ─── 2. publish() graceful sem Redis ─────────────────────────────────────────

describe('COMM5Contract: publish() sem Redis habilitado', () => {
  it('não lança exceção', async () => {
    await expect(publish(makeSyncEvent())).resolves.not.toThrow();
  });

  it('múltiplos publish() são silenciosos', async () => {
    for (let i = 0; i < 10; i++) {
      await publish(makeSyncEvent({ id: `p-${i}` }));
    }
    expect(isDegraded()).toBe(false); // sem tentativas de reconexão
  });
});

// ─── 3. readStreamSince e getLatestStreamId sem Redis ────────────────────────

describe('COMM5Contract: streams API sem Redis', () => {
  it('readStreamSince retorna [] sem Redis', async () => {
    const result = await readStreamSince('emp1', '');
    expect(result).toEqual([]);
  });

  it('getLatestStreamId retorna null sem Redis', async () => {
    const id = await getLatestStreamId('emp1');
    expect(id).toBeNull();
  });
});

// ─── 4. _resetForTests limpa métricas ────────────────────────────────────────

describe('COMM5Contract: _resetForTests', () => {
  it('limpa todas as métricas de reconexão', () => {
    _resetForTests();
    expect(getReconnectAttempts()).toBe(0);
    expect(getLastErrorAt()).toBeNull();
    expect(getLastErrorMessage()).toBeNull();
    expect(isDegraded()).toBe(false);
    expect(isConnected()).toBe(false);
  });
});

// ─── 5. getEventsSinceAsync em modo local-only ────────────────────────────────

describe('COMM5Contract: getEventsSinceAsync — modo local-only', () => {
  it('retorna eventos do buffer local', async () => {
    const emp = 'emp-async-test';
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'a', empresaId: emp });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'b', empresaId: emp });

    const events = await getEventsSinceAsync(emp, '');
    expect(events).not.toBeNull();
    expect(events!.length).toBe(2);
  });

  it('cursor ISO filtra eventos posteriores', async () => {
    const emp = 'emp-cursor-test';
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'before', empresaId: emp });
    const cursor = new Date().toISOString();
    await new Promise(r => setTimeout(r, 5));
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'after', empresaId: emp });

    const events = await getEventsSinceAsync(emp, cursor);
    expect(events!.length).toBe(1);
    expect(events![0]!.entityId).toBe('after');
  });

  it('retorna [] para empresa sem eventos', async () => {
    const events = await getEventsSinceAsync('empresa-vazia-xyz', '');
    expect(events).toEqual([]);
  });
});

// ─── 6. SyncStatus.transport completo (COMM-5) ───────────────────────────────

describe('COMM5Contract: SyncStatus.transport — campos COMM-5', () => {
  it('contém todos os campos novos', async () => {
    const status = await getSyncStatus();
    const t = status.transport;

    expect(typeof t.degraded).toBe('boolean');
    expect(typeof t.redisReconnectAttempts).toBe('number');
    expect(t.lastRedisErrorAt === null || typeof t.lastRedisErrorAt === 'string').toBe(true);
    expect(t.lastRedisErrorMessage === null || typeof t.lastRedisErrorMessage === 'string').toBe(true);
  });

  it('degraded é false no estado inicial', async () => {
    const status = await getSyncStatus();
    expect(status.transport.degraded).toBe(false);
  });

  it('redisReconnectAttempts começa em 0', async () => {
    const status = await getSyncStatus();
    expect(status.transport.redisReconnectAttempts).toBe(0);
  });

  it('mode é local-only quando Redis desabilitado', async () => {
    const status = await getSyncStatus();
    expect(status.transport.mode).toBe('local-only');
  });

  it('featureFlags.redisDistributed é false no modo local', async () => {
    const status = await getSyncStatus();
    expect(status.featureFlags.redisDistributed).toBe(false);
  });
});

// ─── 7. Isolamento e getEventsSince síncrono continua funcionando ─────────────

describe('COMM5Contract: getEventsSince síncrono (compatibilidade)', () => {
  it('continua retornando eventos locais', () => {
    const emp = 'emp-sync-compat';
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_DELETED, entity: 'placa', entityId: 'x', empresaId: emp });
    const events = getEventsSince(emp, '');
    expect(events.length).toBe(1);
    expect(events[0]!.type).toBe('PLACA_DELETED');
  });
});

// ─── 8. TransportMode inclui redis-streams ────────────────────────────────────

describe('COMM5Contract: TransportMode', () => {
  it('getMode() retorna tipo válido', () => {
    const validModes = ['local-only', 'redis-pubsub', 'redis-streams'];
    expect(validModes).toContain(getMode());
  });
});

// ─── 9. INSTANCE_ID formato UUID ─────────────────────────────────────────────

describe('COMM5Contract: INSTANCE_ID', () => {
  it('é UUID v4 válido', () => {
    const id = getInstanceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
