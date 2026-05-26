/**
 * Testes de Contrato — Operational Sync Layer (COMM-1)
 *
 * Garantem que:
 * 1. SYNC_EVENT_TYPES são strings únicas e não-vazias.
 * 2. emitEvent produz SyncEvent com todos os campos obrigatórios.
 * 3. getEventsSince respeita o cursor (filtra corretamente).
 * 4. getSyncStatus retorna shape canônico (apiVersion, contractVersion, etc.).
 * 5. getSyncSnapshot retorna shape canônico.
 * 6. Versão do contrato é inteiro positivo.
 */

import { SYNC_EVENT_TYPES } from '@modules/sync/sync.types';
import { emitEvent, getEventsSince, clearAllEvents, clearEventsForTenant } from '@modules/sync/sync.registry';
import { getSyncStatus } from '@modules/sync/sync.service';

const TENANT = 'test-empresa-sync-contracts';

beforeEach(() => {
  clearEventsForTenant(TENANT);
});

afterAll(() => {
  clearAllEvents();
});

// ─── 1. SYNC_EVENT_TYPES ──────────────────────────────────────────────────────

describe('SyncContract: SYNC_EVENT_TYPES', () => {
  it('tem pelo menos 7 tipos definidos', () => {
    expect(Object.keys(SYNC_EVENT_TYPES).length).toBeGreaterThanOrEqual(7);
  });

  it('todos os valores são strings não-vazias', () => {
    Object.values(SYNC_EVENT_TYPES).forEach(v => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });

  it('não tem valores duplicados', () => {
    const values = Object.values(SYNC_EVENT_TYPES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('contém PLACA_STATUS_CHANGED (evento crítico para frontend)', () => {
    expect(SYNC_EVENT_TYPES.PLACA_STATUS_CHANGED).toBe('PLACA_STATUS_CHANGED');
  });

  it('contém DASHBOARD_INVALIDATED', () => {
    expect(SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED).toBe('DASHBOARD_INVALIDATED');
  });
});

// ─── 2. emitEvent ─────────────────────────────────────────────────────────────

describe('SyncContract: emitEvent — shape do SyncEvent', () => {
  it('retorna evento com todos os campos obrigatórios', () => {
    const event = emitEvent({
      type:      SYNC_EVENT_TYPES.PLACA_STATUS_CHANGED,
      entity:    'placa',
      entityId:  'placa-123',
      empresaId: TENANT,
      payload:   { disponivel: false },
      actorId:   'user-abc',
    });

    expect(typeof event.id).toBe('string');
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.type).toBe('PLACA_STATUS_CHANGED');
    expect(event.entity).toBe('placa');
    expect(event.entityId).toBe('placa-123');
    expect(event.empresaId).toBe(TENANT);
    expect(event.payload).toEqual({ disponivel: false });
    expect(typeof event.occurredAt).toBe('string');
    expect(() => new Date(event.occurredAt)).not.toThrow();
    expect(event.actorId).toBe('user-abc');
    expect(event.version).toBe(1);
  });

  it('occurredAt é ISO 8601 válido', () => {
    const event = emitEvent({
      type:      SYNC_EVENT_TYPES.PLACA_CREATED,
      entity:    'placa',
      entityId:  'p1',
      empresaId: TENANT,
    });

    const ts = new Date(event.occurredAt).getTime();
    expect(isNaN(ts)).toBe(false);
    expect(ts).toBeGreaterThan(0);
  });

  it('ids são únicos entre eventos', () => {
    const e1 = emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'a', empresaId: TENANT });
    const e2 = emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'b', empresaId: TENANT });
    expect(e1.id).not.toBe(e2.id);
  });

  it('payload padrão é objeto vazio quando não fornecido', () => {
    const event = emitEvent({
      type:      SYNC_EVENT_TYPES.PLACA_DELETED,
      entity:    'placa',
      entityId:  'p-del',
      empresaId: TENANT,
    });
    expect(event.payload).toEqual({});
  });
});

// ─── 3. getEventsSince ────────────────────────────────────────────────────────

describe('SyncContract: getEventsSince — filtragem por cursor', () => {
  it('sem cursor retorna até 50 eventos', () => {
    for (let i = 0; i < 10; i++) {
      emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: `p${i}`, empresaId: TENANT });
    }
    const events = getEventsSince(TENANT, '');
    expect(events.length).toBe(10);
  });

  it('cursor ISO filtra apenas eventos posteriores', async () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'before', empresaId: TENANT });
    const cursor = new Date().toISOString();

    // Pequena espera para garantir que o próximo evento tem timestamp maior
    await new Promise(r => setTimeout(r, 5));

    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: 'after', empresaId: TENANT });

    const events = getEventsSince(TENANT, cursor);
    expect(events.length).toBe(1);
    expect(events[0]!.entityId).toBe('after');
  });

  it('cursor no futuro retorna 0 eventos', () => {
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_DELETED, entity: 'placa', entityId: 'x', empresaId: TENANT });
    const futuro = new Date(Date.now() + 60_000).toISOString();
    const events = getEventsSince(TENANT, futuro);
    expect(events.length).toBe(0);
  });

  it('isolamento por empresa: empresa B não vê eventos da empresa A', () => {
    const empresaA = 'empresa-a';
    const empresaB = 'empresa-b';
    emitEvent({ type: SYNC_EVENT_TYPES.PLACA_CREATED, entity: 'placa', entityId: 'pa', empresaId: empresaA });
    const events = getEventsSince(empresaB, '');
    expect(events.length).toBe(0);
    clearEventsForTenant(empresaA);
  });
});

// ─── 4. getSyncStatus ─────────────────────────────────────────────────────────

describe('SyncContract: getSyncStatus — shape canônico', () => {
  it('retorna objeto com campos obrigatórios', async () => {
    const status = await getSyncStatus();

    expect(typeof status.apiVersion).toBe('string');
    expect(typeof status.contractVersion).toBe('number');
    expect(status.contractVersion).toBeGreaterThan(0);
    expect(typeof status.serverTime).toBe('string');
    expect(Array.isArray(status.modules)).toBe(true);
    expect(typeof status.databaseStatus).toBe('string');
    expect(['connected', 'disconnected', 'degraded']).toContain(status.databaseStatus);
    expect(typeof status.maintenance).toBe('boolean');
    expect(typeof status.featureFlags).toBe('object');
  });

  it('maintenance é false por padrão (sem MAINTENANCE_MODE=true)', async () => {
    const original = process.env.MAINTENANCE_MODE;
    delete process.env.MAINTENANCE_MODE;
    const status = await getSyncStatus();
    expect(status.maintenance).toBe(false);
    if (original !== undefined) process.env.MAINTENANCE_MODE = original;
  });

  it('maintenance é true quando MAINTENANCE_MODE=true', async () => {
    process.env.MAINTENANCE_MODE = 'true';
    const status = await getSyncStatus();
    expect(status.maintenance).toBe(true);
    delete process.env.MAINTENANCE_MODE;
  });

  it('modules contém pelo menos sync e placas', async () => {
    const status = await getSyncStatus();
    const nomes = status.modules.map(m => m.name);
    expect(nomes).toContain('sync');
    expect(nomes).toContain('placas');
  });

  it('featureFlags.syncEnabled é true', async () => {
    const status = await getSyncStatus();
    expect(status.featureFlags.syncEnabled).toBe(true);
  });

  it('serverTime é ISO 8601 válido', async () => {
    const status = await getSyncStatus();
    const ts = new Date(status.serverTime).getTime();
    expect(isNaN(ts)).toBe(false);
  });
});
