/**
 * Cache Service
 *
 * Thin wrapper over the shared RedisManager.
 * All methods are fire-and-forget safe — they never throw.
 * Cache miss (Redis offline) silently degrades to DB lookup.
 */

import { redisManager } from '@shared/infra/redis/redis-manager';
import logger from './logger';

const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || '300', 10);

/** No-op boot — redisManager is initialized via config/redis.ts import chain. */
async function initializeRedis(): Promise<void> {}

async function get(key: string): Promise<unknown> {
  const raw = await redisManager.get(key);
  if (!raw) return null;

  try {
    logger.debug(`[CacheService] HIT: ${key}`);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function set(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await redisManager.setEx(key, ttl, serialized);
    logger.debug(`[CacheService] SET: ${key} (TTL: ${ttl}s)`);
  } catch (e: any) {
    logger.warn(`[CacheService] set falhou para ${key}: ${e.message}`);
  }
}

async function del(keys: string | string[]): Promise<void> {
  const arr = Array.isArray(keys) ? keys : [keys];
  for (const k of arr) await redisManager.del(k);
  logger.debug(`[CacheService] DEL: ${arr.join(', ')}`);
}

async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await redisManager.keys(pattern);
  if (keys.length > 0) {
    for (const k of keys) await redisManager.del(k);
    logger.info(`[CacheService] Invalidadas ${keys.length} chaves: ${pattern}`);
  }
}

function isAvailable(): boolean {
  return redisManager.isConnected();
}

async function disconnect(): Promise<void> {
  // Shared client — owned by RedisManager, not this service
}

export default {
  initializeRedis,
  get,
  set,
  del,
  invalidatePattern,
  isAvailable,
  disconnect,
};
