/**
 * Testes SSE — syncService (COMM-3)
 *
 * Cobre:
 * 1. startSSE busca streamToken e cria EventSource
 * 2. Evento SSE chega ao subscriber correto
 * 3. Evento duplicado (mesmo id) ignorado mesmo via SSE
 * 4. Erro SSE ativa polling fallback
 * 5. reset fecha EventSource
 * 6. SSE não inicia sem token
 * 7. Fallback para polling quando EventSource não disponível
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
    this.readyState = 0; // CONNECTING
    this._listeners = {};
    this.onopen = null;
    this.onerror = null;
    MockEventSource.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }

  // Helper para simular chegada de evento
  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen({});
  }

  simulateEvent(type, data) {
    const e = { data: JSON.stringify(data) };
    (this._listeners[type] ?? []).forEach(h => h(e));
  }

  simulateError() {
    this.readyState = MockEventSource.CLOSED;
    if (this.onerror) this.onerror({});
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

global.EventSource = MockEventSource;

// ─── Mock syncClient ──────────────────────────────────────────────────────────

vi.mock('./syncClient', () => ({
  fetchSyncStatus:   vi.fn().mockResolvedValue({ databaseStatus: 'connected', contractVersion: 1, serverTime: new Date().toISOString(), modules: [], maintenance: false, featureFlags: { syncEnabled: true, realtimeEnabled: true } }),
  fetchSyncSnapshot: vi.fn().mockResolvedValue({ placas: { total: 0, disponiveis: 0, updatedAt: new Date().toISOString() }, regioes: { total: 0, updatedAt: new Date().toISOString() }, dashboard: { totalPlacas: 0, placasDisponiveis: 0, regiaoPrincipal: 'N/A' }, snapshotAt: new Date().toISOString(), syncCursor: '2025-01-01T00:00:00.000Z' }),
  fetchSyncEvents:   vi.fn().mockResolvedValue({ events: [], nextCursor: new Date().toISOString(), count: 0 }),
  fetchStreamToken:  vi.fn().mockResolvedValue({ token: 'stream-tok-abc', expiresAt: new Date(Date.now() + 60_000).toISOString(), ttlMs: 60_000 }),
  buildStreamUrl:    vi.fn().mockReturnValue('http://localhost:4000/api/v1/sync/stream?token=stream-tok-abc'),
}));

vi.mock('../contracts', () => ({
  SYNC_POLL_INTERVAL_MS: 60_000,
  SYNC_EVENT_TYPES: {
    PLACA_CREATED:        'PLACA_CREATED',
    PLACA_STATUS_CHANGED: 'PLACA_STATUS_CHANGED',
    PLACA_DELETED:        'PLACA_DELETED',
    PLACA_UPDATED:        'PLACA_UPDATED',
    REGIAO_UPDATED:       'REGIAO_UPDATED',
    DASHBOARD_INVALIDATED:'DASHBOARD_INVALIDATED',
    SYSTEM_STATUS_CHANGED:'SYSTEM_STATUS_CHANGED',
  },
  isSyncSnapshot: (s) => Boolean(s && s.syncCursor),
  // COMM-6: necessário para o syncService processar cursores
  parseCursorFrontend: (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object' && raw !== null && raw.mode) return raw;
    if (typeof raw === 'string' && !isNaN(new Date(raw).getTime())) {
      return { mode: 'local', value: raw, issuedAt: new Date().toISOString() };
    }
    return null;
  },
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

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

// ─── 1. startSSE cria EventSource ─────────────────────────────────────────────

describe('syncService SSE: startSSE cria EventSource', () => {
  it('boot() com token abre EventSource', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    await syncService.boot();

    // Deve ter criado um EventSource
    expect(MockEventSource.instances.length).toBeGreaterThan(0);
    expect(MockEventSource.instances[0].url).toContain('/sync/stream');
  });

  it('isSSEActive() é true após abertura com sucesso', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    await syncService.boot();

    // Simula abertura da conexão
    MockEventSource.instances[0]?.simulateOpen();

    expect(syncService.isSSEActive()).toBe(true);
    expect(syncService.isConnected()).toBe(true);
  });

  it('polling é parado quando SSE conecta', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    await syncService.boot();
    MockEventSource.instances[0]?.simulateOpen();

    expect(syncService.isPollingActive()).toBe(false);
  });
});

// ─── 2. Evento SSE chega ao subscriber ────────────────────────────────────────

describe('syncService SSE: evento chega ao subscriber', () => {
  it('PLACA_STATUS_CHANGED via SSE notifica subscriber', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    const handler = vi.fn();
    syncService.subscribe('PLACA_STATUS_CHANGED', handler);

    await syncService.boot();
    MockEventSource.instances[0]?.simulateOpen();

    const event = {
      id:         'sse-evt-001',
      type:       'PLACA_STATUS_CHANGED',
      entity:     'placa',
      entityId:   'p-abc',
      empresaId:  'emp1',
      payload:    { disponivel: false },
      occurredAt: new Date().toISOString(),
      version:    1,
    };

    MockEventSource.instances[0]?.simulateEvent('PLACA_STATUS_CHANGED', event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].payload.disponivel).toBe(false);
  });
});

// ─── 3. Deduplicação mantida via SSE ──────────────────────────────────────────

describe('syncService SSE: deduplicação por event.id', () => {
  it('mesmo evento SSE recebido duas vezes é ignorado na segunda', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    const handler = vi.fn();
    syncService.subscribe('PLACA_DELETED', handler);

    await syncService.boot();
    MockEventSource.instances[0]?.simulateOpen();

    const event = {
      id:         'dup-sse-001',
      type:       'PLACA_DELETED',
      entity:     'placa',
      entityId:   'p-del',
      empresaId:  'emp1',
      payload:    {},
      occurredAt: new Date().toISOString(),
      version:    1,
    };

    MockEventSource.instances[0]?.simulateEvent('PLACA_DELETED', event);
    MockEventSource.instances[0]?.simulateEvent('PLACA_DELETED', event); // duplicado

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. Erro SSE ativa polling fallback ───────────────────────────────────────

describe('syncService SSE: fallback para polling em erro', () => {
  it('erro no EventSource ativa polling', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    await syncService.boot();

    // Simula erro no SSE
    MockEventSource.instances[0]?.simulateError();

    // Polling deve estar ativo como fallback
    expect(syncService.isPollingActive()).toBe(true);
    expect(syncService.isConnected()).toBe(false);
  });

  it('lastError é preenchido após erro SSE', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    await syncService.boot();
    MockEventSource.instances[0]?.simulateError();

    expect(syncService.getLastError()).toBe('SSE connection error');
  });
});

// ─── 5. reset fecha EventSource ───────────────────────────────────────────────

describe('syncService SSE: reset encerra EventSource', () => {
  it('reset() fecha o EventSource', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    await syncService.boot();

    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();

    syncService.reset();

    expect(es.readyState).toBe(MockEventSource.CLOSED);
    expect(syncService.isSSEActive()).toBe(false);
    expect(syncService.isBooted()).toBe(false);
  });
});

// ─── 6. SSE não inicia sem token ──────────────────────────────────────────────

describe('syncService SSE: sem token não abre EventSource', () => {
  it('boot() sem token não cria EventSource', async () => {
    await syncService.boot(); // sem token
    expect(MockEventSource.instances.length).toBe(0);
  });
});

// ─── 7. Fallback quando EventSource indisponível ──────────────────────────────

describe('syncService SSE: fallback quando EventSource indisponível', () => {
  it('usa polling quando EventSource não existe no ambiente', async () => {
    localStorageMock.setItem('token', 'jwt-token');
    // Remove EventSource temporariamente
    const origES = global.EventSource;
    // @ts-ignore
    delete global.EventSource;

    vi.resetModules();
    const svc = await import('./syncService');
    await svc.boot();

    expect(svc.isPollingActive()).toBe(true);
    expect(MockEventSource.instances.length).toBe(0);

    svc.reset();
    // @ts-ignore
    global.EventSource = origES;
  });
});
