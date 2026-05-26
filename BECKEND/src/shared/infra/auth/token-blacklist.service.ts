/**
 * JWT Token Blacklist Service
 * Redis-backed com fallback in-memory para desenvolvimento sem Redis.
 * Garante revogação imediata de tokens mesmo dentro do período de validade.
 */

import { createClient, RedisClientType } from 'redis';
import logger from '@shared/container/logger';

const BLACKLIST_PREFIX = 'jwt:blacklist:';
const FAMILY_REVOKE_PREFIX = 'session:family:revoked:';

class TokenBlacklistService {
  private redis: RedisClientType | null = null;
  private available = false;
  // Fallback in-memory para quando Redis não está disponível
  private memoryStore = new Map<string, number>(); // jti -> expiresAt (unix ms)

  async connect(redisUrl: string): Promise<void> {
    try {
      this.redis = createClient({ url: redisUrl }) as RedisClientType;

      this.redis.on('error', (err: Error) => {
        logger.warn('[TokenBlacklist] Redis error:', err.message);
        this.available = false;
      });

      this.redis.on('ready', () => {
        this.available = true;
        logger.info('[TokenBlacklist] Redis conectado — revogação distribuída ativa');
      });

      await this.redis.connect();
      this.available = true;
    } catch (err: any) {
      logger.warn('[TokenBlacklist] Redis indisponível — usando fallback in-memory:', err.message);
      this.available = false;
    }
  }

  /**
   * Adiciona token à blacklist.
   * @param jti  JWT ID (campo `jti` do payload) ou o próprio token como fallback
   * @param ttlSeconds  Tempo de vida restante do token em segundos
   */
  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return; // Já expirado, não precisa blacklistar

    if (this.available && this.redis) {
      try {
        await this.redis.setEx(`${BLACKLIST_PREFIX}${jti}`, ttlSeconds, '1');
        return;
      } catch (err: any) {
        logger.warn('[TokenBlacklist] Falha ao revogar no Redis, usando fallback:', err.message);
      }
    }

    // Fallback in-memory
    this.memoryStore.set(jti, Date.now() + ttlSeconds * 1000);
    this.pruneMemoryStore();
  }

  /**
   * Verifica se o token está revogado.
   */
  async isRevoked(jti: string): Promise<boolean> {
    if (this.available && this.redis) {
      try {
        const val = await this.redis.get(`${BLACKLIST_PREFIX}${jti}`);
        return val !== null;
      } catch (err: any) {
        logger.warn('[TokenBlacklist] Falha ao verificar blacklist Redis:', err.message);
      }
    }

    // Fallback in-memory
    const exp = this.memoryStore.get(jti);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.memoryStore.delete(jti);
      return false;
    }
    return true;
  }

  /**
   * Marca uma família de refresh tokens como revogada (reuse attack).
   */
  async revokeFamily(family: string, ttlSeconds = 7 * 24 * 3600): Promise<void> {
    if (this.available && this.redis) {
      try {
        await this.redis.setEx(`${FAMILY_REVOKE_PREFIX}${family}`, ttlSeconds, '1');
        return;
      } catch (err: any) {
        logger.warn('[TokenBlacklist] Falha ao revogar família Redis:', err.message);
      }
    }
    this.memoryStore.set(`fam:${family}`, Date.now() + ttlSeconds * 1000);
  }

  async isFamilyRevoked(family: string): Promise<boolean> {
    if (this.available && this.redis) {
      try {
        const val = await this.redis.get(`${FAMILY_REVOKE_PREFIX}${family}`);
        return val !== null;
      } catch {}
    }
    const exp = this.memoryStore.get(`fam:${family}`);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.memoryStore.delete(`fam:${family}`);
      return false;
    }
    return true;
  }

  isRedisAvailable(): boolean {
    return this.available;
  }

  private pruneMemoryStore(): void {
    if (this.memoryStore.size < 1000) return;
    const now = Date.now();
    for (const [key, exp] of this.memoryStore.entries()) {
      if (now > exp) this.memoryStore.delete(key);
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis && this.available) {
      await this.redis.quit();
    }
  }
}

export const tokenBlacklist = new TokenBlacklistService();
