/**
 * Redis bootstrap — single entry-point that triggers redisManager.connect().
 *
 * This file MUST be imported early in app.ts so the connection starts
 * before any service (QueueService, TokenBlacklist, etc.) checks state.
 *
 * Diagnostic logs are intentionally verbose to aid production debugging.
 */

import config from '@config/config';
import { redisManager } from '@shared/infra/redis/redis-manager';
import logger from '@shared/container/logger';

// ── Diagnostic: show raw and parsed values without exposing secrets ──────────
const rawEnabled = process.env.REDIS_ENABLED;
const rawUrl     = process.env.REDIS_URL;

logger.info(
  `[RedisConfig] REDIS_ENABLED — raw="${rawEnabled ?? '(não definido)'}" ` +
  `parsed=${config.redisEnabled}`
);
logger.info(
  `[RedisConfig] REDIS_URL — ${rawUrl ? 'presente' : '⚠️ AUSENTE/undefined'} ` +
  `(config.redisUrl=${config.redisUrl ? config.redisUrl.replace(/\/\/.*@/, '//<credentials>@') : 'UNDEFINED'})`
);

if (!rawEnabled) {
  logger.warn(
    '[RedisConfig] REDIS_ENABLED não está definido no ambiente — ' +
    'usando padrão true. Defina explicitamente no .env ou Coolify.'
  );
}

if (!rawUrl) {
  logger.warn(
    '[RedisConfig] REDIS_URL não está definido no ambiente — ' +
    `usando fallback "${config.redisUrl}". ` +
    'Em Docker/Coolify, 127.0.0.1 NÃO funciona — use o hostname do serviço Redis.'
  );
}

// ── Boot the shared client ───────────────────────────────────────────────────
// connect() is fire-and-forget (never rejects). All services that depend on
// Redis must use waitUntilReady() or listen to the 'ready' event.
redisManager.connect(config.redisUrl, config.redisEnabled);

// ── Compatibility shim ───────────────────────────────────────────────────────
const RedisConfig = {
  isEnabled:  () => config.redisEnabled && redisManager.isConnected(),
  connect:    async () => { /* no-op: already booted above */ },
  disconnect: async () => redisManager.disconnect(),
  ping:       async () => redisManager.ping(),
};

export { redisManager };
export default RedisConfig;
