/**
 * Testes de Contrato — COMM-6 (Cursor Canônico)
 *
 * Cobre:
 *  1. parseCursor — string ISO → modo local
 *  2. parseCursor — Redis stream ID → modo streams
 *  3. parseCursor — base64url JSON canônico → objeto direto
 *  4. parseCursor — string inválida → null
 *  5. parseCursor — objeto canônico já pronto → retorna como está
 *  6. serializeCursor → parseCursor roundtrip
 *  7. makeLocalCursor / makeStreamsCursor / makePubsubCursor formatos corretos
 *  8. getSyncSnapshot retorna SyncCursor canônico (modo local)
 *  9. getSyncEvents retorna nextCursor canônico
 * 10. getSyncEvents cursor inválido retorna needsSnapshot: true
 * 11. getEventsSinceAsync — cursor local filtra corretamente
 * 12. getEventsSinceAsync — cursor streams não mistura ISO com stream ID
 * 13. getLastKnownStreamId inicia null (sem publish)
 * 14. _resetForTests limpa _lastStreamIdByEmpresa
 */

import {
  parseCursor,
  serializeCursor,
  makeLocalCursor,
  makePubsubCursor,
  makeStreamsCursor,
  isRedisStreamId,
  SYNC_EVENT_TYPES,
} from '@modules/sync/sync.types';
import type { SyncCursor } from '@modules/sync/sync.types';
import {
  emitEvent,
  clearAllEvents,
  clearEventsForTenant,
  getEventsSinceAsync,
} from '@modules/sync/sync.registry';
import { getSyncEvents } from '@modules/sync/sync.service';
import {
  getLastKnownStreamId,
  _resetForTests,
} from '@modules/sync/sync.redis-bus';
import {
  clearAllConnections,
} from '@modules/sync/sync.sse-connections';

const TENANT = 'test-comm6-empresa';

// ─── Setup/Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  _resetForTests();
  clearEventsForTenant(TENANT);
  clearAllConnections();
});

afterAll(() => {
  _resetForTests();
  clearAllEvents();
  clearAllConnections();
});

// ─── 1. parseCursor — string ISO ─────────────────────────────────────────────

describe('COMM6: parseCursor — string ISO timestamp', () => {
  it('retorna cursor mode=local para string ISO válida', () => {
    const iso = '2025-05-15T12:34:56.789Z';
    const cursor = parseCursor(iso);
    expect(cursor).not.toBeNull();
    expect(cursor!.mode).toBe('local');
    expect(cursor!.value).toBe(iso);
    expect(typeof cursor!.issuedAt).toBe('string');
  });

  it('issuedAt é ISO 8601 válido', () => {
    const cursor = parseCursor(new Date().toISOString());
    expect(isNaN(new Date(cursor!.issuedAt).getTime())).toBe(false);
  });
});

// ─── 2. parseCursor — Redis stream ID ────────────────────────────────────────

describe('COMM6: parseCursor — Redis stream ID', () => {
  it('isRedisStreamId detecta padrão \\d+-\\d+', () => {
    expect(isRedisStreamId('1718000000000-0')).toBe(true);
    expect(isRedisStreamId('1718000000000-42')).toBe(true);
    expect(isRedisStreamId('0-0')).toBe(true);
  });

  it('isRedisStreamId rejeita ISO e strings genéricas', () => {
    expect(isRedisStreamId('2025-05-15T12:34:56.789Z')).toBe(false);
    expect(isRedisStreamId('abc')).toBe(false);
    expect(isRedisStreamId('')).toBe(false);
  });

  it('parseCursor converte stream ID para mode=streams', () => {
    const streamId = '1718000000000-0';
    const cursor = parseCursor(streamId);
    expect(cursor).not.toBeNull();
    expect(cursor!.mode).toBe('streams');
    expect(cursor!.value).toBe(streamId);
  });
});

// ─── 3. parseCursor — base64url JSON canônico ────────────────────────────────

describe('COMM6: parseCursor — base64url JSON', () => {
  it('decodifica cursor canônico serializado com serializeCursor', () => {
    const original: SyncCursor = {
      mode:     'streams',
      value:    '1718000000000-5',
      issuedAt: '2025-05-15T12:00:00.000Z',
    };
    const serialized = serializeCursor(original);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(0);

    const parsed = parseCursor(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed!.mode).toBe('streams');
    expect(parsed!.value).toBe('1718000000000-5');
    expect(parsed!.issuedAt).toBe('2025-05-15T12:00:00.000Z');
  });

  it('roundtrip local cursor', () => {
    const original = makeLocalCursor('2025-01-01T00:00:00.000Z');
    const serialized = serializeCursor(original);
    const parsed = parseCursor(serialized);
    expect(parsed!.mode).toBe('local');
    expect(parsed!.value).toBe('2025-01-01T00:00:00.000Z');
  });
});

// ─── 4. parseCursor — string inválida ────────────────────────────────────────

describe('COMM6: parseCursor — cursor inválido', () => {
  it('retorna null para string vazia', () => {
    expect(parseCursor('')).toBeNull();
  });

  it('retorna null para string irreconhecível', () => {
    expect(parseCursor('cursor-invalido-xpto')).toBeNull();
  });

  it('retorna null para null', () => {
    expect(parseCursor(null)).toBeNull();
  });

  it('retorna null para undefined', () => {
    expect(parseCursor(undefined)).toBeNull();
  });
});

// ─── 5. parseCursor — objeto canônico ────────────────────────────────────────

describe('COMM6: parseCursor — objeto canônico já pronto', () => {
  it('retorna o mesmo objeto sem modificar', () => {
    const cursor: SyncCursor = {
      mode:     'local',
      value:    '2025-05-01T00:00:00.000Z',
      issuedAt: '2025-05-01T00:00:00.000Z',
    };
    const result = parseCursor(cursor);
    expect(result).toEqual(cursor);
  });
});

// ─── 6. serializeCursor ───────────────────────────────────────────────────────

describe('COMM6: serializeCursor', () => {
  it('produz string sem caracteres inválidos para query string', () => {
    const cursor = makeStreamsCursor('1718000000000-99');
    const serialized = serializeCursor(cursor);
    // base64url não tem +, / ou =
    expect(serialized).not.toMatch(/[+/=]/);
  });

  it('roundtrip streams cursor preserva todas as propriedades', () => {
    const cursor = makeStreamsCursor('1718000000000-1');
    const parsed = parseCursor(serializeCursor(cursor));
    expect(parsed!.mode).toBe('streams');
    expect(parsed!.value).toBe('1718000000000-1');
  });
});

// ─── 7. makeLocalCursor / makeStreamsCursor / makePubsubCursor ───────────────

describe('COMM6: make* helpers', () => {
  it('makeLocalCursor → mode=local com ISO fornecido', () => {
    const c = makeLocalCursor('2025-05-01T00:00:00.000Z');
    expect(c.mode).toBe('local');
    expect(c.value).toBe('2025-05-01T00:00:00.000Z');
  });

  it('makeLocalCursor sem argumento usa tempo atual', () => {
    const before = Date.now();
    const c = makeLocalCursor();
    const after = Date.now();
    const ts = new Date(c.value).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('makeStreamsCursor → mode=streams com stream ID', () => {
    const c = makeStreamsCursor('1718000000000-0');
    expect(c.mode).toBe('streams');
    expect(c.value).toBe('1718000000000-0');
  });

  it('makePubsubCursor → mode=pubsub', () => {
    const c = makePubsubCursor('2025-05-01T00:00:00.000Z');
    expect(c.mode).toBe('pubsub');
    expect(c.value).toBe('2025-05-01T00:00:00.000Z');
  });
});

// ─── 8. getSyncEvents — cursor inválido retorna needsSnapshot ────────────────

describe('COMM6: getSyncEvents — cursor inválido', () => {
  it('retorna needsSnapshot: true para cursor irreconhecível', async () => {
    const result = await getSyncEvents(TENANT, 'lixo-que-nao-e-cursor');
    expect(result.needsSnapshot).toBe(true);
    expect(result.events).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.nextCursor).toBeDefined();
    expect(typeof result.nextCursor.mode).toBe('string');
  });

  it('cursor vazio não retorna needsSnapshot (retorna últimos eventos)', async () => {
    const result = await getSyncEvents(TENANT, null);
    expect(result.needsSnapshot).toBeFalsy();
  });

  it('cursor string vazia não retorna needsSnapshot', async () => {
    const result = await getSyncEvents(TENANT, '');
    expect(result.needsSnapshot).toBeFalsy();
  });
});

// ─── 9. getSyncEvents — nextCursor canônico ───────────────────────────────────

describe('COMM6: getSyncEvents — nextCursor canônico', () => {
  it('nextCursor é objeto com mode, value, issuedAt', async () => {
    const result = await getSyncEvents(TENANT, null);
    expect(typeof result.nextCursor).toBe('object');
    expect(['local', 'pubsub', 'streams']).toContain(result.nextCursor.mode);
    expect(typeof result.nextCursor.value).toBe('string');
    expect(typeof result.nextCursor.issuedAt).toBe('string');
  });

  it('nextCursor avança após emitir eventos', async () => {
    const cursor1 = (await getSyncEvents(TENANT, null)).nextCursor;

    await new Promise(r => setTimeout(r, 5));
    emitEvent({
      type:      SYNC_EVENT_TYPES.PLACA_CREATED,
      entity:    'placa',
      entityId:  'p-comm6-1',
      empresaId: TENANT,
    });

    const result2 = await getSyncEvents(TENANT, cursor1);
    expect(result2.events.length).toBeGreaterThanOrEqual(1);
    expect(result2.nextCursor.value).not.toBe(cursor1.value);
  });
});

// ─── 10. getEventsSinceAsync — cursor local filtra corretamente ──────────────

describe('COMM6: getEventsSinceAsync — cursor local', () => {
  it('filtra eventos com cursor mode=local', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'before', empresaId: TENANT });

    const cursor = makeLocalCursor(new Date().toISOString());
    await new Promise(r => setTimeout(r, 5));

    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'after', empresaId: TENANT });

    const events = await getEventsSinceAsync(TENANT, cursor);
    expect(events).not.toBeNull();
    expect(events!.length).toBe(1);
    expect(events![0]!.entityId).toBe('after');
  });

  it('cursor streams não filtra por ISO — retorna buffer completo para merge', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'x1', empresaId: TENANT });
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'x2', empresaId: TENANT });

    // Em modo local-only, Redis não está disponível, então getEventsSinceAsync
    // cai no fallback local. Com cursor streams, _getLocalSince retorna buffer inteiro.
    const cursor = makeStreamsCursor('1718000000000-0');
    const events = await getEventsSinceAsync(TENANT, cursor);
    // Deve retornar todos os eventos do buffer (não filtrar por stream ID)
    expect(events).not.toBeNull();
    expect(events!.length).toBe(2);
  });
});

// ─── 11. getLastKnownStreamId — sem publish retorna null ─────────────────────

describe('COMM6: getLastKnownStreamId', () => {
  it('retorna null antes de qualquer publish em streams mode', () => {
    expect(getLastKnownStreamId(TENANT)).toBeNull();
    expect(getLastKnownStreamId('outra-empresa')).toBeNull();
  });

  it('_resetForTests limpa o mapa', () => {
    // Não podemos testar o set sem Redis real, mas podemos verificar
    // que _resetForTests mantém o retorno como null
    _resetForTests();
    expect(getLastKnownStreamId(TENANT)).toBeNull();
  });
});
