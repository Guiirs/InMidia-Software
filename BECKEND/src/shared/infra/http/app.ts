import express, { Request, Response, NextFunction, Application } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';

// Config
import swaggerConfig from '@config/swaggerConfig';
import logger from '@shared/container/logger';
import config from '@config/config';

// Gateway
import { bootstrapGateway, getGatewayInfo } from '@gateway/index';

// Middlewares
import { errorHandler, sanitize, globalRateLimiter } from './middlewares';
import { metricsMiddleware, getMetrics } from '@shared/infra/monitoring/metrics';
import { renderSyncPrometheusMetrics } from '@modules/sync/sync.service';

// Auth blacklist — inicializa conexão Redis para revogação distribuída
import { tokenBlacklist } from '@shared/infra/auth/token-blacklist.service';

// Utils
import AppError from '@shared/container/AppError';

// Load environment variables
dotenv.config();

// Initialize token blacklist (Redis-backed)
if (process.env.NODE_ENV !== 'test') {
  tokenBlacklist.connect(config.redisUrl).catch((err: Error) => {
    logger.warn('[App] Token blacklist Redis indisponível — usando fallback in-memory:', err.message);
  });
}

// Initialize Express app
const app: Application = express();

// Railway/Render/proxies: required for req.ip and express-rate-limit behind reverse proxy
if (config.nodeEnv === 'production' || process.env.RAILWAY_ENVIRONMENT) {
  app.set('trust proxy', 1);
}

// --- Essential Middlewares ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// Global rate limiting (2000 req/min per IP)
app.use('/api', globalRateLimiter);

// Metrics middleware (must be after rate limiting but before routes)
app.use(metricsMiddleware);

// ─── CORS ────────────────────────────────────────────────────────────────────

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');
const configuredCorsOrigins = (config.corsOrigin || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsCredentialsEnabled = true;
const hasCorsWildcard = configuredCorsOrigins.includes('*');

if (hasCorsWildcard && corsCredentialsEnabled) {
  throw new Error('CORS_ORIGIN="*" nao e permitido com credentials habilitado. Configure uma whitelist explicita.');
}

if (config.nodeEnv === 'production' && configuredCorsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN deve ser configurado explicitamente em producao.');
}

const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:4173'];
const allowedOrigins = Array.from(
  new Set(
    [...configuredCorsOrigins, ...(config.nodeEnv !== 'production' ? defaultDevOrigins : [])]
      .map(normalizeOrigin)
  )
);

logger.info(`[CORS] credentials=${corsCredentialsEnabled} origins=[${allowedOrigins.join(', ')}]`);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Permite requests sem Origin (curl, health checks internos, Railway probes)
    if (!origin) {
      callback(null, true);
      return;
    }

    const requestOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(requestOrigin)) {
      callback(null, true);
      return;
    }

    logger.warn(`[CORS] Origem bloqueada: ${origin}`);
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: corsCredentialsEnabled,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-correlation-id', 'x-request-id'],
  exposedHeaders: ['X-Gateway-Module', 'X-Response-Time', 'X-Request-Id'],
  maxAge: 86400,
};

// Handle CORS preflight for all routes before any auth/gateway middleware
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

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
