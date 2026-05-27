/**
 * JWT Token Blacklist Service
 *
 * Uses the shared RedisManager with in-memory fallback.
 * Contract: every public method returns a value — NEVER throws.
 * The auth middleware must never get a 500 due to Redis being offline.
 */

import { redisManager } from '@shared/infra/redis/redis-manager';
import logger from '@shared/container/logger';

const BLACKLIST_PREFIX    = 'jwt:blacklist:';
const FAMILY_REVOKE_PREFIX = 'session:family:revoked:';

// In-memory fallback: jti/family-key → expiry timestamp (ms)
const memStore = new Map<string, number>();

function memGet(key: string): boolean {
  const exp = memStore.get(key);
  if (!exp) return false;
  if (Date.now() > exp) { memStore.delete(key); return false; }
  return true;
}

function memSet(key: string, ttlSeconds: number): void {
  memStore.set(key, Date.now() + ttlSeconds * 1_000);
  // Prune when store grows too large (>2000 entries)
  if (memStore.size > 2_000) {
    const now = Date.now();
    for (const [k, v] of memStore) if (now > v) memStore.delete(k);
  }
}

class TokenBlacklistService {
  /**
   * connect() kept for backwards-compat with app.ts — now a no-op because
   * the shared redisManager is booted by config/redis.ts on first import.
   */
  async connect(_redisUrl: string): Promise<void> {
    // No-op: redisManager is initialized centrally via config/redis.ts
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;

    const stored = await redisManager.setEx(
      `${BLACKLIST_PREFIX}${jti}`,
      ttlSeconds,
      '1',
    );

    if (!stored) {
      // Redis unavailable — fall back to in-memory
      memSet(jti, ttlSeconds);
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    const val = await redisManager.get(`${BLACKLIST_PREFIX}${jti}`);

    if (val !== null) return true;         // Redis says revoked
    if (redisManager.isConnected()) return false; // Redis online, not in blacklist

    // Redis offline — check in-memory fallback
    return memGet(jti);
  }

  async revokeFamily(family: string, ttlSeconds = 7 * 24 * 3_600): Promise<void> {
    const stored = await redisManager.setEx(
      `${FAMILY_REVOKE_PREFIX}${family}`,
      ttlSeconds,
      '1',
    );
    if (!stored) memSet(`fam:${family}`, ttlSeconds);
  }

  async isFamilyRevoked(family: string): Promise<boolean> {
    const val = await redisManager.get(`${FAMILY_REVOKE_PREFIX}${family}`);
    if (val !== null) return true;
    if (redisManager.isConnected()) return false;
    return memGet(`fam:${family}`);
  }

  isRedisAvailable(): boolean {
    return redisManager.isConnected();
  }

  async disconnect(): Promise<void> {
    // Shared client — do not disconnect from here
  }
}

export const tokenBlacklist = new TokenBlacklistService();

// Startup log — replaces the old connect() call in app.ts
logger.info(
  `[TokenBlacklist] Inicializado — Redis: ${redisManager.isConnected() ? 'conectado' : 'aguardando'}`
);
