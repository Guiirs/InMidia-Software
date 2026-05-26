import { Request, Response, NextFunction } from 'express';
import cacheService from '@shared/container/cache.service';
import logger from '@shared/container/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  skipCache?: (req: Request) => boolean;
}

export const cacheMiddleware = (options: CacheOptions = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyPrefix = 'api',
    skipCache
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip cache for non-GET requests or if skipCache function returns true
    if (req.method !== 'GET' || (skipCache && skipCache(req))) {
      return next();
    }

    // Generate cache key
    const cacheKey = `${keyPrefix}:${req.originalUrl}`;

    try {
      // Try to get cached response
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        logger.debug(`[CacheMiddleware] Cache HIT for ${cacheKey}`);
        res.set('X-Cache', 'HIT');
        res.json(cachedData);
        return;
      }

      // Cache miss - intercept the response
      logger.debug(`[CacheMiddleware] Cache MISS for ${cacheKey}`);
      res.set('X-Cache', 'MISS');

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache the response
      res.json = function(data: any) {
        // Only cache successful responses (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, ttl).catch((err) => {
            logger.warn(`[CacheMiddleware] Failed to cache response for ${cacheKey}:`, err.message);
          });
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error: any) {
      logger.warn(`[CacheMiddleware] Cache error for ${cacheKey}:`, error.message);
      // Continue without caching on error
      next();
    }
  };
};

// Specific middleware for read-heavy endpoints
export const placasCacheMiddleware = cacheMiddleware({
  ttl: 600, // 10 minutes for placas
  keyPrefix: 'placas',
  skipCache: (req) => {
    // Skip cache if user has admin role or specific query params
    return ['admin', 'admin_empresa', 'superadmin'].includes(req.user?.role ?? '') || req.query.force === 'true';
  }
});

export const regioesCacheMiddleware = cacheMiddleware({
  ttl: 1800, // 30 minutes for regioes (less frequently updated)
  keyPrefix: 'regioes',
  skipCache: (req) => {
    // Skip cache if user has admin role
    return ['admin', 'admin_empresa', 'superadmin'].includes(req.user?.role ?? '');
  }
});