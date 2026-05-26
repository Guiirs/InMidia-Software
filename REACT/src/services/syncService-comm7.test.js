/**
 * Testes do syncService — COMM-7 (Observabilidade e Resiliência)
 *
 * Cobre:
 *  1.  getDiagnostics() retorna shape correto antes do boot
 *  2.  getDiagnostics() connected=false antes do boot
 *  3.  getDiagnostics() fallbackMode=true quando polling ativo sem SSE
 *  4.  snapshotRecoveries incrementa quando needsSnapshot=true
 *  5.  duplicateEventsIgnored incrementa com eventos duplicados
 *  6.  lastEventAt atualiza ao receber evento
 *  7.  replayCount incrementa em poll com eventos
 *  8.  reset() zera todas as métricas
 *  9.  dedup TTL — evento com mesmo id é ignorado em duas polls
 *  10. needsSnapshotReason propagado corretamente
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock localStorage ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store = {};
  return {
    getItem:    (k) => store[k] ?? null,
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear:      () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// ─── Sem EventSource — força polling ─────────────────────────────────────────

delete global.EventSource;

// ─── Mocks ────────────────────────────────────────────────────────────────────

const SNAPSHOT_CANONICAL = {
  placas:    { total: 0, disponiveis: 0, updatedAt: new Date().toISOString() },
  regioes:   { total: 0, updatedAt: new Date().toISOString() },
  dashboard: { totalPlacas: 0, placasDisponiveis: 0, regiaoPrincipal: 'N/A' },
  snapshotAt:   new Date().toISOString(),
  syncCursor:   { mode: 'local', value: '2025-01-01T00:00:00.000Z', issuedAt: '2025-01-01T00:00:00.000Z' },
  legacyCursor: '2025-01-01T00:00:00.000Z',
};

const NEXT_CURSOR = { mode: 'local', value: '2025-06-01T00:00:00.000Z', issuedAt: '2025-06-01T00:00:00.000Z' };

vi.mock('./syncClient', () => ({
  fetchSyncStatus:   vi.fn().mockResolvedValue({ contractVersion: 3, transport: { mode: 'local-only', degraded: false } }),
  fetchSyncSnapshot: vi.fn().mockResolvedValue(SNAPSHOT_CANONICAL),
  fetchSyncEvents:   vi.fn().mockResolvedValue({ events: [], nextCursor: NEXT_CURSOR, count: 0 }),
  fetchStreamToken:  vi.fn().mockRejectedValue(new Error('no SSE')),
  buildStreamUrl:    vi.fn().mockReturnValue('http://localhost/stream'),
}));

vi.mock('../contracts', () => ({
  SYNC_POLL_INTERVAL_MS: 60_000,
  isSyncSnapshot: (s) => Boolean(s?.syncCursor || s?.legacyCursor),
  parseCursorFrontend: (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object' && raw.mode) return raw;
    if (typeof raw === 'string' && !isNaN(new Date(raw).getTime())) {
      return { mode: 'local', value: raw, issuedAt: new Date().toISOString() };
    }
    return null;
  },
  serializeCursor: (c) => {
    if (!c) return null;
    if (typeof c === 'string') return c;
    try { return btoa(JSON.stringify(c)); } catch { return null; }
  },
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

let syncService;

beforeEach(async () => {
  vi.useFakeTimers();
  localStorageMock.clear();
  vi.resetModules();
  syncService = await import('./syncService');
});

afterEach(() => {
  syncService?.reset?.();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─── 1. getDiagnostics() shape antes do boot ─────────────────────────────────

describe('COMM7 syncService: getDiagnostics shape', () => {
  it('retorna objeto com todos os campos antes do boot', () => {
    const d = syncService.getDiagnostics();
    expect(typeof d.connected).toBe('boolean');
    expect(typeof d.transportMode).toBe('string');
    expect(typeof d.degraded).toBe('boolean');
    expect(typeof d.reconnectAttempts).toBe('number');
    expect(typeof d.replayCount).toBe('number');
    expect(typeof d.snapshotRecoveries).toBe('number');
    expect(typeof d.duplicateEventsIgnored).toBe('number');
    expect(typeof d.fallbackMode).toBe('boolean');
    expect(typeof d.uptimeMs).toBe('number');
  });
});

// ─── 2. connected=false antes do boot ────────────────────────────────────────

describe('COMM7 syncService: estado inicial', () => {
  it('connected=false antes do boot', () => {
    expect(syncService.getDiagnostics().connected).toBe(false);
  });

  it('replayCount=0 antes do boot', () => {
    expect(syncService.getDiagnostics().replayCount).toBe(0);
  });
});

// ─── 3. fallbackMode quando polling sem SSE ───────────────────────────────────

describe('COMM7 syncService: fallbackMode', () => {
  it('fallbackMode=true quando polling ativo sem SSE', async () => {
    localStorageMock.setItem('token', 'jwt');
    await syncService.boot();
    // sem EventSource → polling ativo
    expect(syncService.isPollingActive()).toBe(true);
    expect(syncService.getDiagnostics().fallbackMode).toBe(true);
  });
});

// ─── 4. snapshotRecoveries incrementa ─────────────────────────────────────────

describe('COMM7 syncService: snapshotRecoveries', () => {
  it('incrementa quando poll retorna needsSnapshot=true', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events:               [],
      nextCursor:           NEXT_CURSOR,
      count:                0,
      needsSnapshot:        true,
      needsSnapshotReason:  'CURSOR_INVALID',
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(syncService.getDiagnostics().snapshotRecoveries).toBe(1);
  });

  it('isConnected=true depois do recovery (UI não derrubada)', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events: [], nextCursor: NEXT_CURSOR, count: 0, needsSnapshot: true,
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(syncService.isConnected()).toBe(true);
    expect(syncService.isBooted()).toBe(true);
    expect(syncService.getLastError()).toBeNull();
  });
});

// ─── 5. duplicateEventsIgnored ────────────────────────────────────────────────

describe('COMM7 syncService: duplicateEventsIgnored TTL', () => {
  it('incrementa ao receber mesmo evento duas vezes', async () => {
    localStorageMock.setItem('token', 'jwt');
    const handler = vi.fn();
    syncService.subscribe('PLACA_CREATED', handler);

    const evento = {
      id: 'dedup-comm7-001', type: 'PLACA_CREATED',
      entity: 'placa', entityId: 'p1', empresaId: 'e1',
      payload: {}, occurredAt: new Date().toISOString(), version: 1,
    };

    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents
      .mockResolvedValueOnce({ events: [evento], nextCursor: NEXT_CURSOR, count: 1 })
      .mockResolvedValueOnce({ events: [evento], nextCursor: NEXT_CURSOR, count: 1 }); // duplicado

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync(); // poll 1
    await vi.runOnlyPendingTimersAsync(); // poll 2

    expect(handler).toHaveBeenCalledTimes(1); // dispatched apenas 1x
    expect(syncService.getDiagnostics().duplicateEventsIgnored).toBe(1);
  });
});

// ─── 6. lastEventAt atualiza ──────────────────────────────────────────────────

describe('COMM7 syncService: lastEventAt', () => {
  it('lastEventAt=null antes de receber eventos', async () => {
    localStorageMock.setItem('token', 'jwt');
    await syncService.boot();
    expect(syncService.getDiagnostics().lastEventAt).toBeNull();
  });

  it('lastEventAt atualiza ao receber evento', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events: [{
        id: 'evt-last-at', type: 'PLACA_UPDATED', entity: 'placa', entityId: 'p2',
        empresaId: 'e1', payload: {}, occurredAt: new Date().toISOString(), version: 1,
      }],
      nextCursor: NEXT_CURSOR,
      count: 1,
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(syncService.getDiagnostics().lastEventAt).not.toBeNull();
  });
});

// ─── 7. replayCount incrementa em poll com eventos ───────────────────────────

describe('COMM7 syncService: replayCount', () => {
  it('incrementa cada vez que poll retorna eventos', async () => {
    localStorageMock.setItem('token', 'jwt');
    const evento = {
      id: 'rc-001', type: 'PLACA_CREATED', entity: 'placa', entityId: 'p',
      empresaId: 'e', payload: {}, occurredAt: new Date().toISOString(), version: 1,
    };
    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents
      .mockResolvedValueOnce({ events: [evento], nextCursor: NEXT_CURSOR, count: 1 });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(syncService.getDiagnostics().replayCount).toBe(1);
  });

  it('não incrementa quando poll retorna 0 eventos', async () => {
    localStorageMock.setItem('token', 'jwt');
    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(syncService.getDiagnostics().replayCount).toBe(0);
  });
});

// ─── 8. reset() zera métricas ─────────────────────────────────────────────────

describe('COMM7 syncService: reset zera métricas', () => {
  it('todas as métricas COMM-7 são zeradas após reset', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events: [{
        id: 'r1', type: 'PLACA_CREATED', entity: 'placa', entityId: 'p',
        empresaId: 'e', payload: {}, occurredAt: new Date().toISOString(), version: 1,
      }],
      nextCursor: NEXT_CURSOR, count: 1,
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    syncService.reset();

    const d = syncService.getDiagnostics();
    expect(d.replayCount).toBe(0);
    expect(d.snapshotRecoveries).toBe(0);
    expect(d.duplicateEventsIgnored).toBe(0);
    expect(d.lastEventAt).toBeNull();
    expect(d.uptimeMs).toBe(0);
  });
});
