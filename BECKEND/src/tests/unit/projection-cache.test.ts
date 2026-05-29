import {
  ProjectionCacheService,
  projectionCacheService,
  makeCacheKey,
  hashPlateIds,
  timeBucket,
  CACHE_TTL_MS,
} from '../../shared/infra/cache/projection-cache.service';

describe('ProjectionCacheService', () => {
  let cache: ProjectionCacheService;

  beforeEach(() => {
    cache = new ProjectionCacheService();
  });

  describe('get/set basics', () => {
    it('returns undefined for missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('stores and retrieves a value', () => {
      cache.set('k1', { foo: 'bar' }, 5_000);
      expect(cache.get('k1')).toEqual({ foo: 'bar' });
    });

    it('returns undefined after TTL expires', () => {
      cache.set('k2', 42, 1); // 1ms TTL
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.get('k2')).toBeUndefined();
          resolve();
        }, 10);
      });
    });

    it('overwrites existing key', () => {
      cache.set('k3', 'first', 5_000);
      cache.set('k3', 'second', 5_000);
      expect(cache.get('k3')).toBe('second');
    });
  });

  describe('invalidate', () => {
    it('removes a specific key', () => {
      cache.set('k4', 'value', 5_000);
      cache.invalidate('k4');
      expect(cache.get('k4')).toBeUndefined();
    });

    it('invalidateTenant removes all keys for that tenant', () => {
      cache.set('tenant-abc:commercial:hash1', 'data1', 5_000);
      cache.set('tenant-abc:commercial:hash2', 'data2', 5_000);
      cache.set('tenant-xyz:commercial:hash3', 'data3', 5_000);

      cache.invalidateTenant('tenant-abc');

      expect(cache.get('tenant-abc:commercial:hash1')).toBeUndefined();
      expect(cache.get('tenant-abc:commercial:hash2')).toBeUndefined();
      expect(cache.get('tenant-xyz:commercial:hash3')).toBe('data3');
    });
  });

  describe('stats', () => {
    it('tracks hits and misses', () => {
      cache.set('hit-key', 'value', 5_000);
      cache.get('hit-key');   // hit
      cache.get('miss-key');  // miss

      const stats = cache.stats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('reflects store size after eviction', () => {
      cache.set('evict', 'x', 1); // expires immediately
      // Force eviction via stats()
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const stats = cache.stats();
          expect(stats.size).toBe(0);
          resolve();
        }, 10);
      });
    });
  });

  describe('clear', () => {
    it('empties the store and resets stats', () => {
      cache.set('a', 1, 5_000);
      cache.get('a'); // hit
      cache.clear();
      expect(cache.stats()).toMatchObject({ size: 0, hits: 0, misses: 0 });
    });
  });

  describe('resilience', () => {
    it('does not throw when getting a non-existent key', () => {
      expect(() => cache.get('does-not-exist')).not.toThrow();
    });
  });
});

describe('makeCacheKey', () => {
  it('joins parts with colon', () => {
    expect(makeCacheKey('tenant', 'commercial', 'abc123')).toBe('tenant:commercial:abc123');
  });
});

describe('hashPlateIds', () => {
  it('produces consistent output for same ids', () => {
    const ids = ['aaa', 'bbb', 'ccc'];
    expect(hashPlateIds(ids)).toBe(hashPlateIds(ids));
  });

  it('is order-independent', () => {
    expect(hashPlateIds(['a', 'b', 'c'])).toBe(hashPlateIds(['c', 'a', 'b']));
  });

  it('produces different hash for different ids', () => {
    expect(hashPlateIds(['a', 'b'])).not.toBe(hashPlateIds(['a', 'c']));
  });

  it('handles empty array', () => {
    expect(() => hashPlateIds([])).not.toThrow();
  });
});

describe('timeBucket', () => {
  it('returns same bucket within TTL window', () => {
    const ttl = CACHE_TTL_MS.AVAILABILITY_BATCH;
    const b1 = timeBucket(ttl);
    const b2 = timeBucket(ttl);
    expect(b1).toBe(b2);
  });

  it('returns a positive integer', () => {
    expect(timeBucket(CACHE_TTL_MS.DASHBOARD)).toBeGreaterThan(0);
  });
});

describe('CACHE_TTL_MS', () => {
  it('has expected TTL values', () => {
    expect(CACHE_TTL_MS.DASHBOARD).toBe(60_000);
    expect(CACHE_TTL_MS.INVENTORY_SUMMARY).toBe(30_000);
    expect(CACHE_TTL_MS.AVAILABILITY_BATCH).toBe(15_000);
    expect(CACHE_TTL_MS.PUBLIC_PLATES).toBe(60_000);
  });
});

describe('projectionCacheService singleton', () => {
  afterEach(() => {
    projectionCacheService.clear();
  });

  it('is shared across imports', () => {
    projectionCacheService.set('shared', 'value', 5_000);
    expect(projectionCacheService.get('shared')).toBe('value');
  });
});
