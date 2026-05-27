/**
 * Redis configuration façade.
 *
 * Delegates to the centralized RedisManager.
 * `REDIS_ENABLED` is now env-var driven (default: true in production).
 * Kept as a thin compatibility shim so existing imports of RedisConfig still work.
 */

import config from '@config/config';
import { redisManager } from '@shared/infra/redis/redis-manager';

// Boot the shared client when this module is first imported.
// connect() is fire-and-forget — the app never crashes if Redis is unavailable.
redisManager.connect(config.redisUrl, config.redisEnabled);

/** Compatibility shim — preserved so callers of RedisConfig.isEnabled() still compile. */
const RedisConfig = {
  isEnabled: () => config.redisEnabled && redisManager.isConnected(),

  /** @deprecated Use redisManager directly */
  connect:    async () => { /* already booted above */ },

  /** @deprecated Use redisManager directly */
  disconnect: async () => redisManager.disconnect(),

  /** @deprecated Use redisManager directly */
  getClient:  () => {
    if (!redisManager.isConnected()) {
      throw new Error('Redis client not available');
    }
    // Callers that need the raw client should import redisManager instead
    throw new Error('Use redisManager directly — getClient() removed from shim');
  },

  ping: async () => redisManager.ping(),
};

export { redisManager };
export default RedisConfig;
