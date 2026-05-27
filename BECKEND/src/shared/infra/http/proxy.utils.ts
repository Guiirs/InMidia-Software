/**
 * Proxy-safe request utilities.
 *
 * All functions assume `app.set('trust proxy', true)` is active (set in app.ts).
 * They provide a single, consistent way to read headers that proxies (Cloudflare,
 * OLS, Traefik, Coolify) rewrite or duplicate — instead of scattering the same
 * header-parsing logic across controllers.
 */

import { Request } from 'express';

/**
 * Real client IP, respecting the proxy chain.
 *
 * Priority:
 *   1. CF-Connecting-IP  — set by Cloudflare, can't be spoofed externally
 *   2. req.ip            — resolved by Express from X-Forwarded-For with trust proxy
 *   3. X-Forwarded-For   — leftmost entry (real client)
 *   4. 'unknown'
 */
export function getClientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'] as string | undefined;
  if (cf) return cf.trim();

  if (req.ip) return req.ip;

  const xff = req.headers['x-forwarded-for'] as string | undefined;
  if (xff) return xff.split(',')[0]!.trim();

  return 'unknown';
}

/**
 * True when the original request arrived over HTTPS.
 * Works behind Cloudflare → OLS → Docker with trust proxy enabled.
 */
export function isSecureRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

/**
 * Normalized request origin, stripping duplicates injected by OLS/Traefik.
 * OLS may forward "https://x.com, https://x.com" — we take only the first segment.
 * Returns null for server-to-server requests without an Origin header.
 */
export function getRequestOrigin(req: Request): string | null {
  const raw = req.headers['origin'] as string | undefined;
  if (!raw) return null;
  return raw.split(',')[0]!.trim().replace(/\/+$/, '');
}

/**
 * Request ID for distributed tracing.
 * The request-id middleware in app.ts guarantees x-request-id is always set.
 */
export function getRequestId(req: Request): string {
  return (req.headers['x-request-id'] as string) || 'unknown';
}

/**
 * Effective hostname, preferring the proxy-forwarded host over the socket host.
 */
export function getEffectiveHost(req: Request): string {
  const fwdHost = req.headers['x-forwarded-host'] as string | undefined;
  return fwdHost?.split(',')[0]?.trim() || req.hostname || 'unknown';
}
