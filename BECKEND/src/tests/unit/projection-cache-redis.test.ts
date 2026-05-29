/**
 * Tests for ProjectionCacheService in redis mode using a mocked RedisCacheAdapter.
 * No actual Redis connection required.
 */

import {
  ProjectionCacheService,
  CACHE_TTL_MS,
} from '../../shared/infra/cache/projection-cache.service';
import type { RedisCacheAdapter } from '../../shared/infra/cache/redis-cache-adapter';

// ── Mock RedisCacheAdapter ────────────────────────────────────────────────

function makeMockRedis(available = true): jest.Mocked<RedisCacheAdapter> {
  const store = new Map<string, { value: unknown; expiresAt: number }>();

  return {
    isAvailable: jest.fn(() => available),
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry || Date.now() > entry.expiresAt) return undefined;
      return entry.value as any;
    }),
    set: jest.fn(async (key: string, value: unknown, ttlMs: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }),
    del: jest.fn(async (key: string) => { store.delete(key); }),
    delByTenantPrefix: jest.fn(async (empresaId: string) => {
      const prefix = `${empresaId}:`;
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) store.delete(k);
      }
    }),
    resetWarn: jest.fn(),
    // Expose store for test assertions
    _store: store,
  } as any;
}

describe('ProjectionCacheService — memory mode (default)', () => {
  let cache: ProjectionCacheService;

  beforeEach(() => {
    cache = new ProjectionCacheService({ mode: 'memory' });
  });

  it('get/set round-trip', () => {
    cache.set('k1', { plates: 42 }, 5_000);
    expect(cache.get('k1')).toEqual({ plates: 42 });
  });

  it('reports mode=memory in stats', () => {
    expect(cache.stats().mode).toBe('memory');
    expect(cache.stats().redisAvailable).toBe(false);
  });

  it('does not call any Redis adapter', () => {
    const mockRedis = makeMockRedis(true);
    // Even if we pass a redis adapter, mode=memory ignores it
    const memCache = new ProjectionCacheService({ mode: 'memory', redis: mockRedis as any });
    memCache.set('test', 'val', 5_000);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });
});

describe('ProjectionCacheService — redis mode with available Redis', () => {
  let cache: ProjectionCacheService;
  let mockRedis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    mockRedis = makeMockRedis(true);
    cache = new ProjectionCacheService({ mode: 'redis', redis: mockRedis as any });
  });

  it('reports mode=redis and redisAvailable=true in stats', () => {
    const stats = cache.stats();
    expect(stats.mode).toBe('redis');
    expect(stats.redisAvailable).toBe(true);
  });

  it('set writes to L1 (memory) synchronously', () => {
    cache.set('k1', 'value', 5_000);
    // L1 hit — no need to await Redis
    expect(cache.get('k1')).toBe('value');
  });

  it('set fire-and-forgets L2 write to Redis', async () => {
    cache.set('k2', { foo: 'bar' }, CACHE_TTL_MS.AVAILABILITY_BATCH);
    // Give microtasks a chance to run
    await new Promise((r) => setImmediate(r));
    expect(mockRedis.set).toHaveBeenCalledWith('k2', { foo: 'bar' }, CACHE_TTL_MS.AVAILABILITY_BATCH);
  });

  it('getAsync returns L1 hit without calling Redis', async () => {
    cache.set('k3', 'l1-value', 5_000);
    const result = await cache.getAsync('k3');
    expect(result).toBe('l1-value');
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('getAsync falls back to Redis on L1 miss', async () => {
    mockRedis.get.mockResolvedValueOnce('redis-value' as any);
    const result = await cache.getAsync<string>('missing-in-l1');
    expect(result).toBe('redis-value');
    expect(mockRedis.get).toHaveBeenCalledWith('missing-in-l1');
  });

  it('getAsync populates L1 from Redis hit', async () => {
    mockRedis.get.mockResolvedValueOnce({ data: 'from-redis' } as any);
    await cache.getAsync('populate-test');
    // Second call should hit L1 without going to Redis again
    mockRedis.get.mockClear();
    const l1Hit = cache.get('populate-test');
    expect(l1Hit).toEqual({ data: 'from-redis' });
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('invalidate removes from L1 and Redis', async () => {
    cache.set('del-key', 'value', 5_000);
    cache.invalidate('del-key');
    expect(cache.get('del-key')).toBeUndefined();
    await new Promise((r) => setImmediate(r));
    expect(mockRedis.del).toHaveBeenCalledWith('del-key');
  });

  it('invalidateTenant removes L1 keys and calls Redis delByTenantPrefix', async () => {
    cache.set('tenant-abc:commercial:h1', 'data1', 5_000);
    cache.set('tenant-abc:dashboard:h2', 'data2', 5_000);
    cache.set('tenant-xyz:commercial:h3', 'data3', 5_000);

    cache.invalidateTenant('tenant-abc');

    expect(cache.get('tenant-abc:commercial:h1')).toBeUndefined();
    expect(cache.get('tenant-xyz:commercial:h3')).toBe('data3');
    await new Promise((r) => setImmediate(r));
    expect(mockRedis.delByTenantPrefix).toHaveBeenCalledWith('tenant-abc');
  });
});

describe('ProjectionCacheService — redis mode with unavailable Redis', () => {
  let cache: ProjectionCacheService;
  let mockRedis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    mockRedis = makeMockRedis(false); // Redis unavailable
    cache = new ProjectionCacheService({ mode: 'redis', redis: mockRedis as any });
  });

  it('reports redisAvailable=false in stats', () => {
    expect(cache.stats().redisAvailable).toBe(false);
  });

  it('still serves L1 reads when Redis is down', () => {
    cache.set('k1', 'val', 5_000);
    expect(cache.get('k1')).toBe('val');
  });

  it('getAsync returns undefined on L1 miss (Redis unavailable)', async () => {
    const result = await cache.getAsync('missing');
    expect(result).toBeUndefined();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('does not call Redis del when unavailable', async () => {
    cache.set('k2', 'val', 5_000);
    cache.invalidate('k2');
    await new Promise((r) => setImmediate(r));
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

describe('ProjectionCacheService — mode determined by env var', () => {
  const originalEnv = process.env.PROJECTION_CACHE_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PROJECTION_CACHE_MODE;
    } else {
      process.env.PROJECTION_CACHE_MODE = originalEnv;
    }
  });

  it('defaults to memory when env var is not set', () => {
    delete process.env.PROJECTION_CACHE_MODE;
    const svc = new ProjectionCacheService();
    expect(svc.getMode()).toBe('memory');
  });

  it('uses memory when env var is memory', () => {
    process.env.PROJECTION_CACHE_MODE = 'memory';
    const svc = new ProjectionCacheService();
    expect(svc.getMode()).toBe('memory');
  });

  it('uses redis when env var is redis', () => {
    process.env.PROJECTION_CACHE_MODE = 'redis';
    const mockRedis = makeMockRedis(true);
    const svc = new ProjectionCacheService({ redis: mockRedis as any });
    expect(svc.getMode()).toBe('redis');
  });
});
