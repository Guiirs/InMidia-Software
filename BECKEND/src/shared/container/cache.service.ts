/**
 * Cache Service
 * Redis caching singleton
 */
import logger from './logger';
import { RedisClientType, createClient } from 'redis';

let redisClient: RedisClientType | null = null;
let isRedisAvailable = false;

async function initializeRedis(): Promise<void> {
  try {
    if (!process.env.REDIS_HOST && process.env.NODE_ENV !== 'production') {
      logger.info('[CacheService] Redis não configurado. Cache desabilitado (modo desenvolvimento).');
      return;
    }

    const config = {
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10)
      },
      password: process.env.REDIS_PASSWORD || undefined
    };

    redisClient = createClient(config) as RedisClientType;

    redisClient.on('error', (err: Error) => {
      logger.error('[CacheService] Erro de conexão Redis:', err.message);
      isRedisAvailable = false;
    });

    redisClient.on('connect', () => {
      logger.info('[CacheService] ✅ Conectado ao Redis.');
      isRedisAvailable = true;
    });

    redisClient.on('ready', () => {
      logger.info('[CacheService] Redis pronto para uso.');
      isRedisAvailable = true;
    });

    await redisClient.connect();
    
  } catch (error) {
    const err = error as Error;
    logger.warn('[CacheService] Redis não disponível:', err.message);
    logger.info('[CacheService] Continuando sem cache (fallback para DB).');
    isRedisAvailable = false;
  }
}

async function get(key: string): Promise<unknown> {
  if (!isRedisAvailable || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (!value) return null;
    
    logger.debug(`[CacheService] Cache HIT: ${key}`);
    return JSON.parse(value);
  } catch (error) {
    const err = error as Error;
    logger.warn(`[CacheService] Erro ao ler cache ${key}:`, err.message);
    return null;
  }
}

async function set(key: string, value: unknown, ttl: number = parseInt(process.env.CACHE_TTL || '300', 10)): Promise<void> {
  if (!isRedisAvailable || !redisClient) {
    return;
  }

  try {
    const serialized = JSON.stringify(value);
    await redisClient.setEx(key, ttl, serialized);
    logger.debug(`[CacheService] Cache SET: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    const err = error as Error;
    logger.warn(`[CacheService] Erro ao escrever cache ${key}:`, err.message);
  }
}

async function del(keys: string | string[]): Promise<void> {
  if (!isRedisAvailable || !redisClient) {
    return;
  }

  try {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    await redisClient.del(keysArray);
    logger.debug(`[CacheService] Cache DEL: ${keysArray.join(', ')}`);
  } catch (error) {
    const err = error as Error;
    logger.warn(`[CacheService] Erro ao deletar cache:`, err.message);
  }
}

async function invalidatePattern(pattern: string) {
  if (!isRedisAvailable || !redisClient) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`[CacheService] Invalidadas ${keys.length} chaves com padrão: ${pattern}`);
    }
  } catch (error: any) {
    logger.warn(`[CacheService] Erro ao invalidar padrão ${pattern}:`, error.message);
  }
}

function isAvailable(): boolean {
  return isRedisAvailable;
}

async function disconnect() {
  if (redisClient && isRedisAvailable) {
    await redisClient.quit();
    logger.info('[CacheService] Desconectado do Redis.');
  }
}

export default {
  initializeRedis,
  get,
  set,
  del,
  invalidatePattern,
  isAvailable,
  disconnect
};
