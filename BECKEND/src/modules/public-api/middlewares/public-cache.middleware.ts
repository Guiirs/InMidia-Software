import type { Request, Response, NextFunction } from 'express';

const PUBLIC_API_VERSION = 'v1';

/**
 * Adds CDN-friendly cache headers to public API GET responses.
 *
 * s-maxage is intentionally longer than max-age: Cloudflare caches for longer
 * while browsers revalidate sooner, reducing stale reads on the client side.
 * Vary on x-api-key ensures each partner's responses are cached independently.
 *
 * Surrogate-Control: max-age is the Cloudflare-specific TTL override (takes
 * priority over Cache-Control s-maxage on Cloudflare Enterprise; on free/pro
 * s-maxage is used instead — both are set for compatibility).
 *
 * Not applied to POST/PUT/PATCH/DELETE — only cacheable methods.
 */
export function publicCacheHeaders(maxAgeSeconds = 60, sMaxAgeSeconds = 300) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Tag every public API response with the API version for client diagnostics.
    res.setHeader('X-Public-Api-Version', PUBLIC_API_VERSION);

    if (req.method === 'GET' || req.method === 'HEAD') {
      res.setHeader(
        'Cache-Control',
        `public, max-age=${maxAgeSeconds}, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=30`,
      );
      // Surrogate-Control: Cloudflare reads this for edge TTL; strip before sending to browser.
      // On Cloudflare free/pro this header is forwarded as-is (not stripped) — harmless.
      res.setHeader('Surrogate-Control', `max-age=${sMaxAgeSeconds}`);
      // Cache is per API key — different partners must not receive each other's data.
      res.vary('x-api-key');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}

/** Short cache for high-frequency, low-volatility endpoints (inventory list, geo). */
export const shortCache = publicCacheHeaders(60, 300);

/** Availability changes more frequently — shorter window. */
export const availabilityCache = publicCacheHeaders(30, 60);

/** Media assets are stable — cache longer. */
export const mediaCache = publicCacheHeaders(300, 3600);
