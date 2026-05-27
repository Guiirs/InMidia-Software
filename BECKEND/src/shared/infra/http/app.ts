// Load environment variables FIRST — must run before any config import reads process.env
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction, Application } from 'express';
// cors package removed — manual CORS middleware below ensures single-header write
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

// Config
import swaggerConfig from '@config/swaggerConfig';
import logger from '@shared/container/logger';
import config from '@config/config';
import { classifyHttpResponse, formatHttpAccessLog, resolveHttpSlowMs } from './http-access-log';

// ── Redis bootstrap — MUST be imported before any service that uses Redis ──
// This triggers redisManager.connect() via config/redis.ts side-effects.
// Without this import, redisManager.connect() is never called.
import '@config/redis';

// Gateway
import { bootstrapGateway, getGatewayInfo } from '@gateway/index';

// Middlewares
import { errorHandler, sanitize, globalRateLimiter, sseRateLimiter, uploadRateLimiter, publicApiRateLimiter } from './middlewares';
import { metricsMiddleware, getMetrics } from '@shared/infra/monitoring/metrics';
import { renderSyncPrometheusMetrics } from '@modules/sync/sync.service';

// Services that use Redis — imported AFTER @config/redis so redisManager is already booting
import '@shared/infra/auth/token-blacklist.service';

// Utils
import AppError from '@shared/container/AppError';

// Initialize Express app
const app: Application = express();

// ─── Trust Proxy ─────────────────────────────────────────────────────────────
//
// Controlled by TRUST_PROXY_HOPS env var — never use `true` with express-rate-limit
// because it trusts any X-Forwarded-For value and triggers ERR_ERL_PERMISSIVE_TRUST_PROXY.
//
// Values:
//   0 (local dev)  → trust proxy: false  — req.ip = socket address (127.0.0.1)
//   1              → trust proxy: 1      — trust one hop (single reverse proxy)
//   2 (production) → trust proxy: 2      — Cloudflare (hop 1) + OLS (hop 2)
//
// Production chain: browser → Cloudflare → OLS → Docker/backend
// CF-Connecting-IP is always preferred in getClientIp() regardless of this setting.
{
  const hops = parseInt(process.env.TRUST_PROXY_HOPS || '0', 10);
  if (hops > 0) {
    app.set('trust proxy', hops);
    logger.info(`[App] trust proxy = ${hops} (TRUST_PROXY_HOPS=${hops})`);
  } else {
    app.set('trust proxy', false);
    logger.info('[App] trust proxy = false (local dev — TRUST_PROXY_HOPS=0 or unset)');
  }
}

// ─── CORS — must be the FIRST app.use() call ────────────────────────────────
//
// Manual middleware — single write of Access-Control-Allow-Origin per response.
//
// Why not cors() library:
//   cors() reflects req.headers.origin verbatim into the response header.
//   OLS/LiteSpeed duplicates the Origin request header before proxying to Express
//   ("https://x.com, https://x.com"), so cors() would copy that duplicated string
//   into Access-Control-Allow-Origin — which browsers reject.
//   res.setHeader() replaces (never appends), so we always emit one clean value.
//
// Why first:
//   OPTIONS preflights must never reach rate-limit, auth, Redis, or DB middleware.
//   Registering here guarantees they are intercepted and answered with 204 immediately.

const normalizeOrigin = (raw: string) => raw.trim().replace(/\/+$/, '');

const configuredCorsOrigins = (config.corsOrigin || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (configuredCorsOrigins.includes('*')) {
  throw new Error('CORS_ORIGIN="*" is not allowed with credentials=true. Use an explicit whitelist.');
}

if (config.nodeEnv === 'production' && configuredCorsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must be set explicitly in production.');
}

const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:4173'];
const allowedOrigins = Array.from(
  new Set(
    [...configuredCorsOrigins, ...(config.nodeEnv !== 'production' ? defaultDevOrigins : [])]
      .map(normalizeOrigin)
  )
);

const CORS_ALLOW_METHODS = 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type,Authorization,x-api-key,x-correlation-id,x-request-id';
const CORS_EXPOSE_HEADERS = 'X-Gateway-Module,X-Response-Time,X-Request-Id';
const CORS_MAX_AGE = '86400';

logger.info(`[CORS] origins=[${allowedOrigins.join(', ')}]`);

app.use(function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // ── Public API layer (/public/*) ─────────────────────────────────────────────
  // External partner endpoints are API-key authenticated, not cookie-based.
  // credentials=false allows wildcard origin — valid per CORS spec.
  // Clients may be WordPress plugins, BI tools, or partner backends — any origin.
  if (req.path.startsWith('/public/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
      res.setHeader('Access-Control-Allow-Headers', `${CORS_ALLOW_HEADERS},x-api-key`);
      res.setHeader('Access-Control-Max-Age', CORS_MAX_AGE);
      logger.debug('[CORS] OPTIONS /public/* handled (wildcard)');
      res.status(204).end();
      return;
    }
    res.setHeader('Access-Control-Expose-Headers', CORS_EXPOSE_HEADERS);
    return next();
  }

  // ── Internal API layer (/api/*) ───────────────────────────────────────────────
  const rawOrigin = req.headers['origin'] as string | undefined;

  // OLS/LiteSpeed/Traefik may forward a duplicated Origin header value:
  // "https://x.com, https://x.com" — extract only the first segment for validation.
  const candidate = rawOrigin ? normalizeOrigin(rawOrigin.split(',')[0]!.trim()) : null;
  const allowed = candidate !== null && allowedOrigins.includes(candidate);

  if (allowed) {
    // res.setHeader replaces any existing value — never concatenates — single header guaranteed.
    res.setHeader('Access-Control-Allow-Origin', candidate!);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // res.vary appends 'Origin' without overwriting other Vary tokens (e.g. Accept-Encoding).
    res.vary('Origin');
    logger.debug(`[CORS] origin permitida: ${candidate}`);
  } else if (candidate) {
    logger.warn(`[CORS] origin bloqueada: ${candidate} (raw: "${rawOrigin}")`);
    // No CORS headers set → browser enforces the block. No 403 — OPTIONS must still return 204.
  }

  if (req.method === 'OPTIONS') {
    if (allowed) {
      res.setHeader('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
      res.setHeader('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
      res.setHeader('Access-Control-Max-Age', CORS_MAX_AGE);
    }
    logger.debug('[CORS] OPTIONS handled directly');
    res.status(204).end();
    return;
  }

  if (allowed) {
    res.setHeader('Access-Control-Expose-Headers', CORS_EXPOSE_HEADERS);
  }

  next();
});

// ─── Request ID ──────────────────────────────────────────────────────────────
// Propagates or generates x-request-id for end-to-end tracing.
// Accepts the header from upstream proxies (OLS/Cloudflare) or creates one.
// Written to the response so the frontend can correlate errors with backend logs.
app.use((req: Request, res: Response, next: NextFunction): void => {
  const requestId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['x-correlation-id'] as string) ||
    randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startMs = Date.now();

  // Proxy-aware access log: real IP + protocol detected from proxy headers.
  // Only active in production. SSE endpoints log their own connect/disconnect.
  if (config.nodeEnv === 'production') {
    const ip     = (req.headers['cf-connecting-ip'] as string) || req.ip || 'unknown';
    const proto  = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const origin = (req.headers['origin'] as string)?.split(',')[0]?.trim() || '-';
    logger.debug(`[HTTP] ${req.method} ${req.path} ip=${ip} proto=${proto} origin=${origin} rid=${requestId}`);

    const slowThresholdMs = resolveHttpSlowMs();

    // Latency log: fires when the response finishes (or SSE stream closes).
    // For SSE, duration == total connection time, which is still useful for capacity planning.
    res.on('finish', () => {
      const ms = Date.now() - startMs;
      const status = res.statusCode;
      const classification = classifyHttpResponse(status, ms, slowThresholdMs);
      const message = formatHttpAccessLog({
        label: classification.label,
        method: req.method,
        path: req.path,
        status,
        durationMs: ms,
        requestId,
        ip,
      });

      if (classification.shouldLogInProduction) {
        if (classification.level === 'error') logger.error(message);
        else logger.warn(message);
      } else if (process.env.LOG_HTTP === 'true') {
        logger.debug(message);
      }
    });
  }

  next();
});

// --- Security Headers (Helmet) ---
//
// crossOriginEmbedderPolicy is disabled because:
//   - R2 (Cloudflare) assets are cross-origin and require credentialless loading
//   - COEP: require-corp would block those assets
//
// crossOriginOpenerPolicy is disabled because:
//   - Future OAuth popup flows require window.opener access
//   - safe value is 'same-origin-allow-popups' if re-enabled
//
// Both can be re-evaluated per-route once same-origin migration is complete.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      // 'self' covers SSE (same-origin after Phase 3), WebSocket upgrade, and fetch.
      // wss: covers Socket.IO WebSocket transport.
      connectSrc:  ["'self'", 'wss:'],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],          // prevents base-tag injection
      formAction:  ["'self'"],          // prevents form hijacking
      workerSrc:   ["'none'"],
    },
  },
  hsts: config.nodeEnv === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  // strict-origin-when-cross-origin: sends full referrer on same-origin,
  // only origin on cross-origin HTTPS → HTTPS, nothing on HTTPS → HTTP.
  referrerPolicy:            { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy:   false,
}));

// Global rate limiting (2000 req/min per IP) — internal API only
app.use('/api', globalRateLimiter);

// Public integration API — 100 req/15min per API key prefix.
// Separate limiter: more restrictive than internal, keyed by API key not IP.
app.use('/public', publicApiRateLimiter);

// SSE stream endpoints — limit new connection rate to prevent connection spam.
// Applied before auth middleware in the gateway; the limiter itself uses keyByUser
// (falls back to IP when unauthenticated, which is fine since stream requires a token).
app.use('/api/v1/sync/stream',      sseRateLimiter);
app.use('/api/v1/sse/stream',       sseRateLimiter);
app.use('/api/v4/realtime/stream',  sseRateLimiter);

// Upload endpoints — 30 uploads/min per user (R2 has per-operation cost).
app.use('/api/v4/media/upload',     uploadRateLimiter);  // canonical — used by frontend mediaService.js
app.use('/api/v1/media/upload',     uploadRateLimiter);  // v1 compat
app.use('/api/v1/placa',            uploadRateLimiter);  // gallery upload (v1 placas with images)

// Metrics middleware (must be after rate limiting but before routes)
app.use(metricsMiddleware);

// ─── Cookie Parser ─────────────────────────────────────────────────────────────
// Deve vir ANTES de qualquer middleware que leia req.cookies
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanitization middleware (NoSQL injection protection — body, params, safeQuery)
app.use(sanitize);

// Static files
app.use(express.static('public'));

// Health check endpoint (no rate limit)
app.get('/api/v1/status', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (protected by basic auth)
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    if (config.nodeEnv === 'production' && (!config.metricsUser || !config.metricsPassword)) {
      logger.warn('[Metrics] Endpoint requested but METRICS_USER/METRICS_PASSWORD not configured');
      return res.status(503).json({ error: 'Metrics auth not configured' });
    }

    if (config.metricsUser && config.metricsPassword) {
      const authHeader = req.headers.authorization;
      const expectedAuth = `Basic ${Buffer.from(`${config.metricsUser}:${config.metricsPassword}`).toString('base64')}`;

      if (!authHeader || authHeader !== expectedAuth) {
        res.set('WWW-Authenticate', 'Basic realm="Metrics"');
        return res.status(401).json({ error: 'Authentication required' });
      }
    }

    const metricsData = `${await getMetrics()}\n${renderSyncPrometheusMetrics()}`;
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.send(metricsData);
  } catch (error: any) {
    logger.error('[Metrics] Error serving metrics:', error.message);
    return res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

if (process.env.LOG_GATEWAY === 'true') {
  logger.info('[Routes] Health: /status, /health | Metrics: /metrics | Docs: /api/v1/docs');
}

// API Documentation (Swagger) — disabled in production
if (config.nodeEnv !== 'production') {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerConfig));
} else {
  app.use('/api/v1/docs', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });
}

// --- API Gateway Bootstrap ---
bootstrapGateway(app);

// Gateway Info Endpoint — disabled in production
app.get('/api/v1/gateway/info', (_req: Request, res: Response) => {
  if (config.nodeEnv === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  const info = getGatewayInfo();
  return res.json(info);
});

// API Root Info Endpoint
app.get('/api/v1', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'API v1 - Backstage System',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    documentation: '/api/v1/docs',
    gateway: '/api/v1/gateway/info',
  });
});

// --- Error Handlers ---

// 404 Handler
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Rota não encontrada: ${req.originalUrl}`, 404));
});

// Global Error Handler (must be last middleware)
app.use(errorHandler);

export default app;
