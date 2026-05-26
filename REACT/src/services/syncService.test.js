/**
 * Testes do syncService — COMM-2
 *
 * Cobre:
 * 1. Boot exige token — sem token não inicia
 * 2. Boot é idempotente — não cria múltiplos intervalos
 * 3. subscribe/unsubscribe funciona corretamente
 * 4. Evento PLACA_STATUS_CHANGED chega ao subscriber correto
 * 5. Evento duplicado (mesmo id) é ignorado
 * 6. Falha de listener não derruba o polling
 * 7. PLACA_DELETED chega ao subscriber
 * 8. reset limpa todo o estado
 * 9. subscribe('*') recebe todos os tipos
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock do localStorage antes de importar o módulo
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock do syncClient — evita chamadas HTTP reais
vi.mock('./syncClient', () => ({
  fetchSyncStatus:   vi.fn().mockResolvedValue({ databaseStatus: 'connected', contractVersion: 1, serverTime: new Date().toISOString(), modules: [], maintenance: false, featureFlags: { syncEnabled: true } }),
  fetchSyncSnapshot: vi.fn().mockResolvedValue({ placas: { total: 0, disponiveis: 0, updatedAt: new Date().toISOString() }, regioes: { total: 0, updatedAt: new Date().toISOString() }, dashboard: { totalPlacas: 0, placasDisponiveis: 0, regiaoPrincipal: 'N/A' }, snapshotAt: new Date().toISOString(), syncCursor: '2025-01-01T00:00:00.000Z' }),
  fetchSyncEvents:   vi.fn().mockResolvedValue({ events: [], nextCursor: new Date().toISOString(), count: 0 }),
}));

// Mock do contracts — valores simples
vi.mock('../contracts', () => ({
  SYNC_POLL_INTERVAL_MS: 60_000, // intervalo alto para não disparar em testes
  SYNC_EVENT_TYPES: {
    PLACA_CREATED:         'PLACA_CREATED',
    PLACA_UPDATED:         'PLACA_UPDATED',
    PLACA_STATUS_CHANGED:  'PLACA_STATUS_CHANGED',
    PLACA_DELETED:         'PLACA_DELETED',
    REGIAO_UPDATED:        'REGIAO_UPDATED',
    DASHBOARD_INVALIDATED: 'DASHBOARD_INVALIDATED',
    SYSTEM_STATUS_CHANGED: 'SYSTEM_STATUS_CHANGED',
  },
  isSyncSnapshot: (s) => Boolean(s && s.syncCursor),
  // COMM-6: parseCursorFrontend necessário para o syncService processar cursores
  parseCursorFrontend: (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object' && raw !== null && raw.mode) return raw;
    if (typeof raw === 'string' && !isNaN(new Date(raw).getTime())) {
      return { mode: 'local', value: raw, issuedAt: new Date().toISOString() };
    }
    return null;
  },
}));

// ─── Import do módulo APÓS mocks ──────────────────────────────────────────────
// Importação dinâmica para garantir que os mocks estejam ativos
let syncService;

beforeEach(async () => {
  vi.useFakeTimers();
  localStorageMock.clear();
  // Reimporta módulo limpo a cada teste para isolar estado
  vi.resetModules();
  syncService = await import('./syncService');
});

afterEach(() => {
  syncService?.reset?.();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─── 1. Token guard ───────────────────────────────────────────────────────────

describe('syncService: token guard', () => {
  it('boot() retorna sem iniciar polling quando não há token', async () => {
    localStorageMock.removeItem('token');
    const result = await syncService.boot();
    expect(result).toEqual({ status: null, snapshot: null });
    expect(syncService.isBooted()).toBe(false);
  });

  it('boot() inicia quando token está presente', async () => {
    localStorageMock.setItem('token', 'fake-jwt-token');
    await syncService.boot();
    expect(syncService.isBooted()).toBe(true);
  });
});

// ─── 2. Idempotência ──────────────────────────────────────────────────────────

describe('syncService: idempotência do boot', () => {
  it('múltiplas chamadas a boot() não criam múltiplos intervalos', async () => {
    localStorageMock.setItem('token', 'tok');
    const spySetInterval = vi.spyOn(global, 'setInterval');

    await syncService.boot();
    await syncService.boot();
    await syncService.boot();

    // setInterval deve ser chamado apenas uma vez
    const syncCalls = spySetInterval.mock.calls.filter(
      // filtra apenas o interval do polling (não outros da lib)
      () => true
    );
    expect(spySetInterval).toHaveBeenCalledTimes(1);
  });
});

// ─── 3. subscribe / unsubscribe ───────────────────────────────────────────────

describe('syncService: subscribe e unsubscribe', () => {
  it('subscribe retorna função de cleanup', async () => {
    localStorageMock.setItem('token', 'tok');
    const handler = vi.fn();
    const unsub = syncService.subscribe('PLACA_CREATED', handler);
    expect(typeof unsub).toBe('function');
  });

  it('handler é chamado quando evento do tipo correto é disparado', async () => {
    localStorageMock.setItem('token', 'tok');
    const handler = vi.fn();
    syncService.subscribe('PLACA_STATUS_CHANGED', handler);

    // Simula poll retornando um evento
    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events: [{
        id:         'evt-001',
        type:       'PLACA_STATUS_CHANGED',
        entity:     'placa',
        entityId:   'placa-abc',
        empresaId:  'emp-1',
        payload:    { disponivel: false },
        occurredAt: new Date().toISOString(),
        version:    1,
      }],
      nextCursor: new Date().toISOString(),
      count: 1,
    });

    await syncService.boot();
    // Avança o timer para disparar o poll
    await vi.runOnlyPendingTimersAsync();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe('PLACA_STATUS_CHANGED');
    expect(handler.mock.calls[0][0].payload.disponivel).toBe(false);
  });

  it('unsub remove o handler — eventos não chegam mais', async () => {
    localStorageMock.setItem('token', 'tok');
    const handler = vi.fn();
    const unsub = syncService.subscribe('PLACA_DELETED', handler);

    // Remove antes de qualquer evento
    unsub();

    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events: [{ id: 'evt-del-1', type: 'PLACA_DELETED', entity: 'placa', entityId: 'x', empresaId: 'e1', payload: {}, occurredAt: new Date().toISOString(), version: 1 }],
      nextCursor: new Date().toISOString(),
      count: 1,
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(handler).not.toHaveBeenCalled();
  });
});

// ─── 4. Deduplicação por event.id ─────────────────────────────────────────────

describe('syncService: deduplicação de eventos', () => {
  it('evento com id já processado não é despachado novamente', async () => {
    localStorageMock.setItem('token', 'tok');
    const handler = vi.fn();
    syncService.subscribe('PLACA_UPDATED', handler);

    const eventoRepetido = {
      id:         'dup-001',
      type:       'PLACA_UPDATED',
      entity:     'placa',
      entityId:   'p1',
      empresaId:  'e1',
      payload:    {},
      occurredAt: new Date().toISOString(),
      version:    1,
    };

    const { fetchSyncEvents } = await import('./syncClient');
    // Mesmo evento retornado duas vezes (simula cursor que não avançou)
    fetchSyncEvents
      .mockResolvedValueOnce({ events: [eventoRepetido], nextCursor: new Date().toISOString(), count: 1 })
      .mockResolvedValueOnce({ events: [eventoRepetido], nextCursor: new Date().toISOString(), count: 1 });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();

    // Handler chamado apenas 1 vez apesar de 2 polls com o mesmo evento
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─── 5. Listener que lança erro não derruba polling ───────────────────────────

describe('syncService: resiliência a erros de listener', () => {
  it('handler que lança exceção não para o polling', async () => {
    localStorageMock.setItem('token', 'tok');

    const badHandler  = vi.fn().mockImplementation(() => { throw new Error('handler explodiu'); });
    const goodHandler = vi.fn();

    syncService.subscribe('PLACA_CREATED', badHandler);
    syncService.subscribe('PLACA_CREATED', goodHandler);

    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValue({
      events: [{ id: 'evt-resilience', type: 'PLACA_CREATED', entity: 'placa', entityId: 'p2', empresaId: 'e1', payload: {}, occurredAt: new Date().toISOString(), version: 1 }],
      nextCursor: new Date().toISOString(),
      count: 1,
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    // O handler ruim foi chamado (e lançou)
    expect(badHandler).toHaveBeenCalled();
    // O handler bom também foi chamado — polling não parou
    expect(goodHandler).toHaveBeenCalled();
  });
});

// ─── 6. Subscribe wildcard ────────────────────────────────────────────────────

describe('syncService: subscribe wildcard "*"', () => {
  it('subscriber "*" recebe todos os tipos de evento', async () => {
    localStorageMock.setItem('token', 'tok');
    const allEvents = vi.fn();
    syncService.subscribe('*', allEvents);

    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockResolvedValueOnce({
      events: [
        { id: 'w1', type: 'PLACA_CREATED',        entity: 'placa', entityId: 'a', empresaId: 'e', payload: {}, occurredAt: new Date().toISOString(), version: 1 },
        { id: 'w2', type: 'PLACA_STATUS_CHANGED',  entity: 'placa', entityId: 'b', empresaId: 'e', payload: {}, occurredAt: new Date().toISOString(), version: 1 },
        { id: 'w3', type: 'DASHBOARD_INVALIDATED', entity: 'dashboard', entityId: '-', empresaId: 'e', payload: {}, occurredAt: new Date().toISOString(), version: 1 },
      ],
      nextCursor: new Date().toISOString(),
      count: 3,
    });

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(allEvents).toHaveBeenCalledTimes(3);
  });
});

// ─── 7. reset ─────────────────────────────────────────────────────────────────

describe('syncService: reset', () => {
  it('reset limpa estado e para polling', async () => {
    localStorageMock.setItem('token', 'tok');
    await syncService.boot();
    expect(syncService.isBooted()).toBe(true);

    syncService.reset();

    expect(syncService.isBooted()).toBe(false);
    expect(syncService.getCursor()).toBeNull();
    expect(syncService.getSnapshot()).toBeNull();
    expect(syncService.getLastError()).toBeNull();
  });

  it('depois de reset, boot() inicia novamente normalmente', async () => {
    localStorageMock.setItem('token', 'tok');
    await syncService.boot();
    syncService.reset();

    await syncService.boot();
    expect(syncService.isBooted()).toBe(true);
  });
});

// ─── 8. Estado rico ───────────────────────────────────────────────────────────

describe('syncService: estado connected e lastSyncAt', () => {
  it('isConnected é true após poll bem-sucedido', async () => {
    localStorageMock.setItem('token', 'tok');
    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();
    expect(syncService.isConnected()).toBe(true);
    expect(syncService.getLastSyncAt()).not.toBeNull();
    expect(syncService.getLastError()).toBeNull();
  });

  it('isConnected é false e lastError é preenchido após falha', async () => {
    localStorageMock.setItem('token', 'tok');
    const { fetchSyncEvents } = await import('./syncClient');
    fetchSyncEvents.mockRejectedValueOnce(new Error('network error'));

    await syncService.boot();
    await vi.runOnlyPendingTimersAsync();

    expect(syncService.isConnected()).toBe(false);
    expect(syncService.getLastError()).toBe('network error');
  });
});
