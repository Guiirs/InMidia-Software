/**
 * JWT Token Blacklist Service
 *
 * Uses the shared RedisManager with in-memory fallback.
 * Reactive: automatically uses Redis once it connects, falls back to memory when degraded.
 * Every public method is safe — NEVER throws.
 */

import { redisManager } from '@shared/infra/redis/redis-manager';
import logger from '@shared/container/logger';

const BLACKLIST_PREFIX     = 'jwt:blacklist:';
const FAMILY_REVOKE_PREFIX = 'session:family:revoked:';

// In-memory fallback: key → expiry timestamp (ms)
const memStore = new Map<string, number>();

function memGet(key: string): boolean {
  const exp = memStore.get(key);
  if (!exp) return false;
  if (Date.now() > exp) { memStore.delete(key); return false; }
  return true;
}

function memSet(key: string, ttlSeconds: number): void {
  memStore.set(key, Date.now() + ttlSeconds * 1_000);
  if (memStore.size > 2_000) {
    const now = Date.now();
    for (const [k, v] of memStore) if (now > v) memStore.delete(k);
  }
}

class TokenBlacklistService {
  /**
   * connect() kept for backwards-compat — now a no-op.
   * The shared redisManager is booted by config/redis.ts import in app.ts.
   */
  async connect(_redisUrl: string): Promise<void> { /* no-op */ }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;

    const stored = await redisManager.setEx(`${BLACKLIST_PREFIX}${jti}`, ttlSeconds, '1');
    if (!stored) {
      logger.debug(`[TokenBlacklist] Redis indisponível (${redisManager.getState()}) — fallback memory para revoke jti=${jti}`);
      memSet(jti, ttlSeconds);
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    const val = await redisManager.get(`${BLACKLIST_PREFIX}${jti}`);
    if (val !== null) return true;

    // Redis online but key absent = not revoked
    if (redisManager.isConnected()) return false;

    // Redis offline — check in-memory fallback
    return memGet(jti);
  }

  async revokeFamily(family: string, ttlSeconds = 7 * 24 * 3_600): Promise<void> {
    const stored = await redisManager.setEx(`${FAMILY_REVOKE_PREFIX}${family}`, ttlSeconds, '1');
    if (!stored) memSet(`fam:${family}`, ttlSeconds);
  }

  async isFamilyRevoked(family: string): Promise<boolean> {
    const val = await redisManager.get(`${FAMILY_REVOKE_PREFIX}${family}`);
    if (val !== null) return true;
    if (redisManager.isConnected()) return false;
    return memGet(`fam:${family}`);
  }

  isRedisAvailable(): boolean { return redisManager.isConnected(); }

  async disconnect(): Promise<void> { /* shared client — not owned here */ }
}

export const tokenBlacklist = new TokenBlacklistService();

// Diagnostic: log state when this module is first imported.
// "aguardando" is EXPECTED immediately after import — Redis connects ~100 ms later.
// The service is reactive and will use Redis as soon as it connects.
logger.info(
  `[TokenBlacklist] Inicializado — Redis state=${redisManager.getState()} ` +
  '(se "connecting/degraded", aguarda conexão e usa Redis automaticamente quando disponível)'
);
