import { redisManager } from '@shared/infra/redis/redis-manager';
import logger from '@shared/container/logger';

const KEY_PREFIX = 'proj_cache:';

export class RedisCacheAdapter {
  private warnedAboutUnavailable = false;

  isAvailable(): boolean {
    return redisManager.isConnected();
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.isAvailable()) return undefined;
    try {
      const raw = await redisManager.get(`${KEY_PREFIX}${key}`);
      if (raw == null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!this.isAvailable()) {
      this.logUnavailable();
      return;
    }
    try {
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      await redisManager.setEx(`${KEY_PREFIX}${key}`, ttlSeconds, JSON.stringify(value));
    } catch {
      // non-fatal
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await redisManager.del(`${KEY_PREFIX}${key}`);
    } catch {
      // non-fatal
    }
  }

  async delByTenantPrefix(empresaId: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const pattern = `${KEY_PREFIX}${empresaId}:*`;
      const keys = await redisManager.keys(pattern);
      if (keys.length > 0) {
        await redisManager.del(keys);
      }
    } catch {
      // non-fatal
    }
  }

  private logUnavailable(): void {
    if (!this.warnedAboutUnavailable) {
      this.warnedAboutUnavailable = true;
      logger.debug('[RedisCacheAdapter] Redis unavailable — falling back to memory cache');
    }
  }

  resetWarn(): void {
    this.warnedAboutUnavailable = false;
  }
}

export const redisCacheAdapter = new RedisCacheAdapter();
