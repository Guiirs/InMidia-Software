import { redisCacheAdapter, type RedisCacheAdapter } from './redis-cache-adapter';

export const CACHE_TTL_MS = {
  DASHBOARD: 60_000,
  INVENTORY_SUMMARY: 30_000,
  AVAILABILITY_BATCH: 15_000,
  PUBLIC_PLATES: 60_000,
} as const;

export type ProjectionCacheMode = 'memory' | 'redis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  mode: ProjectionCacheMode;
  redisAvailable: boolean;
}

export interface ProjectionCacheOptions {
  mode?: ProjectionCacheMode;
  redis?: RedisCacheAdapter;
}

export class ProjectionCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private readonly mode: ProjectionCacheMode;
  private readonly redisAdapter: RedisCacheAdapter | undefined;

  constructor(options: ProjectionCacheOptions = {}) {
    this.mode = options.mode ?? ((process.env.PROJECTION_CACHE_MODE as ProjectionCacheMode) ?? 'memory');
    this.redisAdapter = this.mode === 'redis' ? (options.redis ?? redisCacheAdapter) : undefined;
  }

  get<T>(key: string): T | undefined {
    try {
      // L1: memory
      const entry = this.store.get(key) as CacheEntry<T> | undefined;
      if (entry) {
        if (Date.now() <= entry.expiresAt) {
          this.hits += 1;
          return entry.value;
        }
        this.store.delete(key);
      }
      this.misses += 1;
      return undefined;
    } catch {
      this.misses += 1;
      return undefined;
    }
  }

  // Async variant that checks L2 (Redis) on L1 miss
  async getAsync<T>(key: string): Promise<T | undefined> {
    // L1 first
    const l1 = this.get<T>(key);
    if (l1 !== undefined) return l1;

    // L2: Redis (on miss and mode=redis)
    if (this.redisAdapter?.isAvailable()) {
      try {
        const l2 = await this.redisAdapter.get<T>(key);
        if (l2 !== undefined) {
          // Populate L1 with remaining TTL estimate (use AVAILABILITY_BATCH as safe default)
          this.setL1(key, l2, CACHE_TTL_MS.AVAILABILITY_BATCH);
          this.hits += 1;
          this.misses -= 1; // fix the L1 miss we already counted
          return l2;
        }
      } catch {
        // Redis failure — continue with miss
      }
    }

    return undefined;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    try {
      this.setL1(key, value, ttlMs);
      // Fire-and-forget L2 write (only when Redis is reachable)
      if (this.redisAdapter?.isAvailable()) {
        void this.redisAdapter.set(key, value, ttlMs).catch(() => {});
      }
    } catch {
      // non-fatal
    }
  }

  invalidate(key: string): void {
    this.store.delete(key);
    if (this.redisAdapter?.isAvailable()) {
      void this.redisAdapter.del(key).catch(() => {});
    }
  }

  invalidateTenant(empresaId: string): void {
    // L1: iterate and delete matching keys
    const prefix = `${empresaId}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    // L2: Redis pattern delete (only when reachable)
    if (this.redisAdapter?.isAvailable()) {
      void this.redisAdapter.delByTenantPrefix(empresaId).catch(() => {});
    }
  }

  stats(): CacheStats {
    this.evictExpired();
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(4)) : 0,
      mode: this.mode,
      redisAvailable: this.redisAdapter?.isAvailable() ?? false,
    };
  }

  getMode(): ProjectionCacheMode {
    return this.mode;
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  private setL1<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

// Singleton — mode determined by env at startup
export const projectionCacheService = new ProjectionCacheService();

export function makeCacheKey(...parts: string[]): string {
  return parts.join(':');
}

export function hashPlateIds(ids: string[]): string {
  const sorted = [...ids].sort();
  let h = 0;
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      h = Math.imul(31, h) + id.charCodeAt(i);
    }
  }
  return (h >>> 0).toString(16);
}

export function timeBucket(ttlMs: number): number {
  return Math.floor(Date.now() / ttlMs);
}
