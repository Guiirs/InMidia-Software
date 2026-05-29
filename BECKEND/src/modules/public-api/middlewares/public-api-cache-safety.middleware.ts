import type { Request, Response, NextFunction } from 'express';
import logger from '@shared/container/logger';

/**
 * Query param names that should never carry API keys.
 * If found, the request is rejected with 400 — credentials in URLs get
 * logged by servers, CDNs, and browser history.
 */
const BLOCKED_API_KEY_PARAMS = ['apiKey', 'api_key', 'x-api-key', 'key', 'token'];

/**
 * Central safety middleware for public API routes authenticated by x-api-key.
 *
 * Enforces three invariants before the request reaches any handler:
 *
 *   1. Vary: x-api-key is set unconditionally — guarantees that every
 *      downstream CDN/proxy cache key includes the API key, so tenant A's
 *      response can never be served to tenant B even if Cache-Control is public.
 *
 *   2. Vary: Origin is appended when an Origin header is present — ensures
 *      CORS-preflight caching is keyed per origin.
 *
 *   3. apiKey via query string is rejected with HTTP 400 — credentials in
 *      the URL are logged by proxies, CDNs, access logs, and browser history.
 *      Clients must use the x-api-key header instead.
 *
 * Place this middleware BEFORE authentication and cache middlewares on any
 * router that serves authenticated, tenant-scoped data.
 */
export function publicApiCacheSafetyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // ── 1. Block API key in query string ────────────────────────────────────────
  for (const param of BLOCKED_API_KEY_PARAMS) {
    if (req.query[param] !== undefined) {
      logger.warn('[CacheSafety] apiKey via query string rejected', {
        param,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(400).json({
        success: false,
        error: {
          code: 'DEPRECATED_AUTH_METHOD',
          message: `Authentication via query parameter "${param}" is not supported. Use the x-api-key header.`,
        },
      });
      return;
    }
  }

  // ── 2. Vary: x-api-key — every authenticated response must include this ────
  // res.vary() appends without duplicating; safe to call multiple times.
  res.vary('x-api-key');

  // ── 3. Vary: Origin — when request carries an Origin (CORS context) ─────────
  if (req.header('origin')) {
    res.vary('Origin');
  }

  next();
}
