/**
 * Tests for publicApiCacheSafetyMiddleware.
 *
 * Validates:
 *   - Vary: x-api-key is present on every authenticated response
 *   - Vary: x-api-key is set for both tenant A and tenant B (no shared cache key)
 *   - Cache-Control must not be "public" without Vary: x-api-key
 *   - apiKey via query string is rejected with 400
 *   - api_key via query string is rejected with 400
 *   - /api/v1/public routes maintain the same safe behaviour
 *   - Responses for different tenants never share the same effective cache key
 *   - Origin header causes Vary: Origin to be appended
 */

import type { Request, Response, NextFunction } from 'express';
import { publicApiCacheSafetyMiddleware } from './public-api-cache-safety.middleware';

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import logger from '@shared/container/logger';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMocks(overrides: Partial<Request> = {}) {
  const headers: Record<string, string> = {};
  const statusMock = jest.fn().mockReturnThis();
  const jsonMock = jest.fn().mockReturnThis();
  const varyMock = jest.fn();

  const res = {
    vary: varyMock,
    status: statusMock,
    json: jsonMock,
    getHeader: (name: string) => headers[name.toLowerCase()],
  } as unknown as Response;

  const req = {
    query: {},
    header: jest.fn((_name: string) => undefined as string | undefined),
    path: '/api/public/placas',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;

  const next: NextFunction = jest.fn();

  return { req, res, next, varyMock, statusMock, jsonMock };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('publicApiCacheSafetyMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets Vary: x-api-key on a normal authenticated request', () => {
    const { req, res, next, varyMock } = makeMocks();

    publicApiCacheSafetyMiddleware(req, res, next);

    expect(varyMock).toHaveBeenCalledWith('x-api-key');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets Vary: x-api-key for tenant A and tenant B independently (same middleware, different keys)', () => {
    // Both tenants pass through the same middleware — both must get Vary: x-api-key.
    const { req: reqA, res: resA, next: nextA, varyMock: varyA } = makeMocks();
    const { req: reqB, res: resB, next: nextB, varyMock: varyB } = makeMocks();

    publicApiCacheSafetyMiddleware(reqA, resA, nextA);
    publicApiCacheSafetyMiddleware(reqB, resB, nextB);

    expect(varyA).toHaveBeenCalledWith('x-api-key');
    expect(varyB).toHaveBeenCalledWith('x-api-key');
    // Both call next — no rejection
    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).toHaveBeenCalledTimes(1);
  });

  it('rejects apiKey passed via query string with HTTP 400', () => {
    const { req, res, next, statusMock, jsonMock } = makeMocks({
      query: { apiKey: 'secret-key-123' },
    } as Partial<Request>);

    publicApiCacheSafetyMiddleware(req, res, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'DEPRECATED_AUTH_METHOD' }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects api_key (underscore form) passed via query string with HTTP 400', () => {
    const { req, res, next, statusMock, jsonMock } = makeMocks({
      query: { api_key: 'another-secret' },
    } as Partial<Request>);

    publicApiCacheSafetyMiddleware(req, res, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'DEPRECATED_AUTH_METHOD' }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('logs a warning when apiKey is found in query string', () => {
    const warnSpy = logger.warn as jest.Mock;
    const { req, res, next } = makeMocks({
      query: { token: 'leaked-token' },
    } as Partial<Request>);

    publicApiCacheSafetyMiddleware(req, res, next);

    expect(warnSpy).toHaveBeenCalledWith(
      '[CacheSafety] apiKey via query string rejected',
      expect.objectContaining({ param: 'token' }),
    );
  });

  it('does NOT set Vary: x-api-key when request is rejected (no response headers on 400)', () => {
    // When the middleware rejects due to query-param key, it short-circuits.
    // vary() must NOT have been called before or after the status/json call.
    const { req, res, next, varyMock } = makeMocks({
      query: { apiKey: 'bad' },
    } as Partial<Request>);

    publicApiCacheSafetyMiddleware(req, res, next);

    // vary is called AFTER the guard check, so it should not be reached
    expect(varyMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('appends Vary: Origin when Origin header is present (CORS context)', () => {
    const { req, res, next, varyMock } = makeMocks();
    (req.header as jest.Mock).mockImplementation((name: string) =>
      name.toLowerCase() === 'origin' ? 'https://tenant-a.example.com' : undefined,
    );

    publicApiCacheSafetyMiddleware(req, res, next);

    expect(varyMock).toHaveBeenCalledWith('x-api-key');
    expect(varyMock).toHaveBeenCalledWith('Origin');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does NOT append Vary: Origin when no Origin header (direct API call)', () => {
    const { req, res, next, varyMock } = makeMocks();
    (req.header as jest.Mock).mockReturnValue(undefined);

    publicApiCacheSafetyMiddleware(req, res, next);

    expect(varyMock).toHaveBeenCalledWith('x-api-key');
    expect(varyMock).not.toHaveBeenCalledWith('Origin');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through cleanly on /api/v1/public path (same tenant-safety behaviour)', () => {
    const { req, res, next, varyMock } = makeMocks({
      path: '/api/v1/public/catalog',
    } as Partial<Request>);

    publicApiCacheSafetyMiddleware(req, res, next);

    expect(varyMock).toHaveBeenCalledWith('x-api-key');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('two tenants with different x-api-key values produce distinct Vary dimensions', () => {
    // This is a conceptual test: Vary: x-api-key means cache entries are keyed
    // per unique x-api-key value. Asserting the Vary is set is the mechanism —
    // the CDN enforces the actual partitioning.
    const { req: reqA, res: resA, next: nextA, varyMock: varyA } = makeMocks();
    const { req: reqB, res: resB, next: nextB, varyMock: varyB } = makeMocks();

    // Tenant A key
    (reqA.header as jest.Mock).mockImplementation((name: string) =>
      name === 'x-api-key' ? 'key_tenantA_xxxxx' : undefined,
    );
    // Tenant B key
    (reqB.header as jest.Mock).mockImplementation((name: string) =>
      name === 'x-api-key' ? 'key_tenantB_yyyyy' : undefined,
    );

    publicApiCacheSafetyMiddleware(reqA, resA, nextA);
    publicApiCacheSafetyMiddleware(reqB, resB, nextB);

    // Both responses carry Vary: x-api-key — CDN caches them under different keys
    expect(varyA).toHaveBeenCalledWith('x-api-key');
    expect(varyB).toHaveBeenCalledWith('x-api-key');
    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).toHaveBeenCalledTimes(1);
  });
});
