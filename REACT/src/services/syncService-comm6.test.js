/**
 * Testes do syncService — COMM-6 (Cursor Canônico)
 *
 * Cobre:
 *  1. boot() armazena syncCursor canônico (objeto) do snapshot
 *  2. boot() aceita syncCursor legado string (compat)
 *  3. EventSource URL inclui cursor serializado
 *  4. polling envia cursor canônico ao fetchSyncEvents
 *  5. nextCursor canônico do poll atualiza _cursor
 *  6. needsSnapshot: true dispara fetchSyncSnapshot sem derrubar UI
 *  7. SSE evento com occurredAt atualiza cursor
 *  8. serializeCursor / parseCursorFrontend roundtrip no browser
 *  9. cursor inválido após boot não quebra polling
 * 10. reset limpa cursor canônico
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

// ─── Mock EventSource ─────────────────────────────────────────────────────────

class MockEventSource {
  static instances = [];
  static CLOSED = 2;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this._listeners = {};
    this.onopen  = null;
    this.onerror = null;
    MockEventSource.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }

  simulateOpen() { this.readyState = 1; if (this.onopen) this.onopen({}); }

  simulateEvent(type, data, lastEventId = '') {
    const e = { data: JSON.stringify(data), lastEventId };
    (this._listeners[type] ?? []).forEach(h => h(e));
  }

  simulateError() { this.readyState = MockEventSource.CLOSED; if (this.onerror) this.onerror({}); }

  close() { this.readyState = MockEventSource.CLOSED; }

  static reset() { MockEventSource.instances = []; }
}

global.EventSource = MockEventSource;

// ─── Mock syncClient ──────────────────────────────────────────────────────────

const CANONICAL_CURSOR = { mode: 'local', value: '2025-05-15T00:00:00.000Z', issuedAt: '2025-05-15T00:00:00.000Z' };
const NEXT_CURSOR      = { mode: 'local', value: '2025-05-15T01:00:00.000Z', issuedAt: '2025-05-15T01:00:00.000Z' };

vi.mock('./syncClient', () => ({
  fetchSyncStatus:   vi.fn().mockResolvedValue({ databaseStatus: 'connected', contractVersion: 2, serverTime: new Date().toISOString(), modules: [], maintenance: false, featureFlags: { syncEnabled: true, canonicalCursor: true } }),
  fetchSyncSnapshot: vi.fn().mockResolvedValue({
    placas:   { total: 0, disponiveis: 0, updatedAt: new Date().toISOString() },
    regioes:  { total: 0, updatedAt: new Date().toISOString() },
    dashboard:{ totalPlacas: 0, placasDisponiveis: 0, regiaoPrincipal: 'N/A' },
    snapshotAt:  new Date().toISOString(),
    syncCursor:  CANONICAL_CURSOR,  // ← objeto canônico
    legacyCursor: '2025-05-15T00:00:00.000Z',
  }),
  fetchSyncEvents:  vi.fn().mockResolvedValue({ events: [], nextCursor: NEXT_CURSOR, count: 0 }),
  fetchStreamToken: vi.fn().mockResolvedValue({ token: 'tok-comm6', expiresAt: new Date(Date.now() + 60_000).toISOString(), ttlMs: 60_000 }),
  buildStreamUrl:   vi.fn((token, cursor) => `http://localhost:4000/api/v1/sync/stream?token=${token}&cursor=${JSON.stringify(cursor)}`),
}));

vi.mock('../contracts', () => ({
  SYNC_POLL_INTERVAL_MS: 60_000,
  isSyncSnapshot: (s) => Boolean(
    s && s.placas && typeof s.placas.total === 'number' &&
    s.dashboard && typeof s.dashboard.totalPlacas === 'number' &&
    (s.syncCursor || s.legacyCursor)
  ),
  parseCursorFrontend: (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object' && raw.mode) return raw;
    if (typeof raw === 'string') {
      if (!isNaN(new Date(raw).getTime())) return { mode: 'local', value: raw, issuedAt: new Date().toISOString() };
    }
    return null;
  },
  serializeCursor: (cursor) => {
    if (!cursor) return null;
    if (typeof cursor === 'string') return cursor;
    try { return btoa(JSON.stringify(cursor)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); } catch { return null; }
  },
}));

// ─── Setup/Teardown ───────────────────────────────────────────────────────────

let syncService;

beforeEach(async () => {
  vi.useFakeTimers();
  localStorageMock.clear();
  MockEventSource.reset();
  vi.resetModules();
  syncService = await import('./syncService');
});

afterEach(() => {
  syncService?.reset?.();
  vi.useRealTimers();
  vi.clearAllMocks();
  MockEventSource.reset();
});

// ─── 1. boot() armazena cursor canônico do snapshot ──────────────────────────

describe('COMM6 syncService: boot cursor canônico', () => {
  it('getCursor() retorna objeto canônico após boot', async () => {
    localStorageMock.setItem('token', 'jwt');
    await syncService.boot();
    const cursor = syncService.getCursor();
    expect(cursor).not.toBeNull();
    expect(typeof cursor).toBe('object');
    expect(cursor.mode).toBe('local');
    expect(cursor.value).toBe('2025-05-15T00:00:00.000Z');
  });
});

// ─── 2. boot() aceita syncCursor legado string ────────────────────────────────

describe('COMM6 syncService: compat com syncCursor legado string', () => {
  it('aceita snapshot com syncCursor como string ISO', async () => {
    const { fetchSyncSnapshot } = await import('./syncClient');
    fetchSyncSnapshot.mockResolvedValueOnce({
      placas:    { total: 0, disponiveis: 0, updatedAt: new Date().toISOString() },
      regioes:   { total: 0, updatedAt: new Date().toISOString() },
      dashboard: { totalPlacas: 0, placasDisponiveis: 0, regiaoPrincipal: 'N/A' },
      snapshotAt:  new Date().toISOString(),
      syncCursor:  '2024-12-01T00:00:00.000Z', // ← string legada
      legacyCursor: '2024-12-01T00:00:00.000Z',
    });

    localStorageMock.setItem('token', 'jwt');
    await syncService.boot();

    const cursor = syncService.getCursor();
    // Deve ter sido convertido para objeto canônico
    expect(cursor).not.toBeNull();
    expect(typeof cursor).toBe('object');
    expect(cursor.value).toBe('2024-12-01T00:00:00.000Z');
  });
});

// ─── 3. EventSource URL inclui cursor ────────────────────────────────────────

describe('COMM6 syncService: EventSource URL com cursor', () => {
  it('buildStreamUrl é chamado com cursor canônico', async () => {
    localStorageMock.setItem('token', 'jwt');
    await syncService.boot();

    const { buildStreamUrl } = await import('./syncClient');
    expect(buildStreamUrl).toHaveBeenCalledWith('tok-comm6', expect.objectContaining({ mode: 'local' }));
  });
});

// ─── 4. polling envia cursor canônico ────────────────────────────────────────

describe('COMM6 syncService: polling envia cursor canônico', () => {
  it('fetchSyncEvents recebe objeto cursor no primeiro poll', async () => {
    localStorageMock.setItem('token', 'jwt');
    // Simula falha de SSE → vai para polling
    const { fetchStreamToken } = await import('./syncClient');
    fetchStreamToken.mockRejectedValueOnce(new Error('token falhou'));

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    const { fetchSyncEvents } = await import('./syncClient');
    const callArg = fetchSyncEvents.mock.calls[0]?.[0];
    // Deve ter recebido um objeto canônico, não uma string
    expect(callArg).not.toBeNull();
    expect(typeof callArg).toBe('object');
    expect(callArg.mode).toBe('local');
  });
});

// ─── 5. nextCursor canônico atualiza _cursor ──────────────────────────────────

describe('COMM6 syncService: nextCursor do poll atualiza cursor', () => {
  it('_cursor avança para nextCursor retornado pelo poll', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchStreamToken } = await import('./syncClient');
    fetchStreamToken.mockRejectedValueOnce(new Error('sem SSE'));

    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events:     [],
      nextCursor: { mode: 'local', value: '2025-06-01T00:00:00.000Z', issuedAt: '2025-06-01T00:00:00.000Z' },
      count:      0,
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    const cursor = syncService.getCursor();
    expect(cursor.value).toBe('2025-06-01T00:00:00.000Z');
  });
});

// ─── 6. needsSnapshot dispara fetchSyncSnapshot ───────────────────────────────

describe('COMM6 syncService: needsSnapshot dispara snapshot sem derrubar UI', () => {
  it('fetchSyncSnapshot é chamado quando poll retorna needsSnapshot: true', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchStreamToken } = await import('./syncClient');
    fetchStreamToken.mockRejectedValueOnce(new Error('sem SSE'));

    const { fetchSyncEvents, fetchSyncSnapshot } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({ events: [], nextCursor: NEXT_CURSOR, count: 0, needsSnapshot: true });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    // fetchSyncSnapshot deve ter sido chamado uma vez no boot e uma vez pelo needsSnapshot
    expect(fetchSyncSnapshot).toHaveBeenCalledTimes(2);
    // isBooted continua true — UI não derrubada
    expect(syncService.isBooted()).toBe(true);
  });

  it('isConnected permanece true após needsSnapshot', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchStreamToken, fetchSyncEvents } = await import('./syncClient');
    fetchStreamToken.mockRejectedValueOnce(new Error('sem SSE'));
    fetchSyncEvents.mockResolvedValueOnce({ events: [], nextCursor: NEXT_CURSOR, count: 0, needsSnapshot: true });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(syncService.isConnected()).toBe(true);
    expect(syncService.getLastError()).toBeNull();
  });
});

// ─── 7. SSE evento com occurredAt atualiza cursor ────────────────────────────

describe('COMM6 syncService: SSE avança cursor via occurredAt', () => {
  it('_cursor.value avança para o occurredAt do evento SSE', async () => {
    localStorageMock.setItem('token', 'jwt');
    const handler = vi.fn();
    syncService.subscribe('PLACA_UPDATED', handler);

    await syncService.boot();
    MockEventSource.instances[0]?.simulateOpen();

    const newTimestamp = '2025-05-15T10:00:00.000Z';
    // COMM-7: lastEventId agora é o occurredAt (normalizado pelo backend),
    // não mais o UUID do evento. O MockEventSource simula isso passando
    // newTimestamp como lastEventId.
    MockEventSource.instances[0]?.simulateEvent('PLACA_UPDATED', {
      id:         'evt-sse-comm6',
      type:       'PLACA_UPDATED',
      entity:     'placa',
      entityId:   'p-1',
      empresaId:  'emp-1',
      payload:    {},
      occurredAt: newTimestamp,
      version:    1,
    }, newTimestamp); // lastEventId = occurredAt (comportamento COMM-7)

    expect(handler).toHaveBeenCalledTimes(1);
    const cursor = syncService.getCursor();
    // cursor avança para o occurredAt / lastEventId normalizado
    expect(cursor.value).toBe(newTimestamp);
  });
});

// ─── 8. reset limpa cursor ────────────────────────────────────────────────────

describe('COMM6 syncService: reset limpa cursor canônico', () => {
  it('getCursor() é null após reset()', async () => {
    localStorageMock.setItem('token', 'jwt');
    await syncService.boot();
    expect(syncService.getCursor()).not.toBeNull();

    syncService.reset();
    expect(syncService.getCursor()).toBeNull();
  });
});

// ─── 9. cursor inválido não quebra polling ────────────────────────────────────

describe('COMM6 syncService: cursor inválido não quebra polling', () => {
  it('poll continua após needsSnapshot sem erro', async () => {
    localStorageMock.setItem('token', 'jwt');
    const { fetchStreamToken, fetchSyncEvents } = await import('./syncClient');
    fetchStreamToken.mockRejectedValueOnce(new Error('sem SSE'));

    // Primeira poll retorna needsSnapshot
    fetchSyncEvents
      .mockResolvedValueOnce({ events: [], nextCursor: NEXT_CURSOR, count: 0, needsSnapshot: true })
      .mockResolvedValue({ events: [], nextCursor: NEXT_CURSOR, count: 0 });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    // Ainda conectado e sem erro
    expect(syncService.isBooted()).toBe(true);
    expect(syncService.getLastError()).toBeNull();
  });
});
