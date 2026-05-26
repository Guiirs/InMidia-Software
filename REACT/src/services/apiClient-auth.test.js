import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/ToastNotification/ToastNotification', () => ({
  showToastGlobal: vi.fn(),
}));

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('apiClient auth expiration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
    vi.resetModules();
    global.window = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    global.CustomEvent = class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  });

  it('dispara auth:expired para 401 TOKEN_EXPIRED e nao faz retry', async () => {
    const { default: apiClient } = await import('./apiClient');
    apiClient.defaults.adapter = vi.fn().mockRejectedValue({
      response: {
        status: 401,
        data: { success: false, code: 'TOKEN_EXPIRED', message: 'Sessao expirada. Faca login novamente.' },
      },
      config: { url: '/sync/stream-token', method: 'post', headers: {} },
    });

    await expect(apiClient.post('/sync/stream-token')).rejects.toThrow(/Sess/);

    expect(apiClient.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(global.window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth:expired' })
    );
  });
});
