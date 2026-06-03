import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import logger from '@shared/container/logger';
import { IAuthRequest } from '../../../../types/express.d';

// ─── Key Generators ───────────────────────────────────────────────────────────

/**
 * Chave por IP — usa ipKeyGenerator para suporte correto a IPv6.
 * Requerido pelo express-rate-limit v8 para evitar bypass via IPv6.
 */
const keyByIp = (req: Request): string => ipKeyGenerator(req.ip ?? '::1');

/**
 * Chave por tenant (empresaId) — isola recursos entre tenants.
 * Fallback para IP quando não autenticado.
 */
const keyByTenant = (req: Request): string => {
  const empresaId = (req as IAuthRequest).user?.empresaId;
  if (empresaId) return `tenant:${empresaId}`;
  return `ip:${ipKeyGenerator(req.ip ?? '::1')}`;
};

/**
 * Chave por usuário individual — limita operações por conta.
 * Fallback para IP quando não autenticado.
 */
const keyByUser = (req: Request): string => {
  const userId = (req as IAuthRequest).user?.id;
  const empresaId = (req as IAuthRequest).user?.empresaId;
  if (userId && empresaId) return `user:${userId}:${empresaId}`;
  return `ip:${ipKeyGenerator(req.ip ?? '::1')}`;
};

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/**
 * Global: 2000 req/min por IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  keyGenerator: keyByIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`[RateLimit] Global — IP=${req.ip} excedeu 2000/min`);
    res.status(429).json({ message: 'Muitos pedidos. Tente novamente em 1 minuto.' });
  },
});

/**
 * Auth: 10 req/min por IP — previne brute force
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  skipSuccessfulRequests: false,
  keyGenerator: keyByIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`[RateLimit] Auth — IP=${req.ip} excedeu 10/min`);
    res.status(429).json({ message: 'Muitas tentativas. Aguarde 1 minuto e tente novamente.' });
  },
});

/**
 * Refresh: 30 req/min por IP — previne força bruta em /auth/refresh
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: keyByIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`[RateLimit] Refresh — IP=${req.ip} excedeu 30/min`);
    res.status(429).json({ message: 'Muitas tentativas de refresh. Aguarde e tente novamente.' });
  },
});

/**
 * Por Tenant: 500 req/min por empresaId — isola tenants.
 * Impede monopolização de recursos por uma única empresa.
 */
export const tenantRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  keyGenerator: keyByTenant,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    const authReq = req as IAuthRequest;
    const empresaId = authReq.user?.empresaId || 'unknown';
    logger.warn(`[RateLimit] Tenant — empresaId=${empresaId} excedeu 500/min`);
    res.status(429).json({
      message: 'Limite de requisições da empresa atingido. Aguarde e tente novamente.',
      code: 'TENANT_RATE_LIMITED',
    });
  },
});

/**
 * Private API: camada canonica /api/v1/private/*.
 * Aplicada depois de JWT + tenant guard, usando empresaId como chave primaria.
 */
export const privateApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  keyGenerator: keyByTenant,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    const authReq = req as IAuthRequest;
    const empresaId = authReq.user?.empresaId || 'unknown';
    logger.warn(`[RateLimit] PrivateAPI - empresaId=${empresaId} excedeu 1000/min`);
    res.status(429).json({
      success: false,
      code: 'PRIVATE_API_RATE_LIMITED',
      message: 'Limite da API privada atingido. Aguarde e tente novamente.',
    });
  },
});

/**
 * Admin: 5 req/min por usuário
 */
export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res) => {
    const authReq = req as IAuthRequest;
    const identifier = authReq.user?.id || req.ip;
    logger.warn(`[RateLimit] Admin — user=${identifier} excedeu 5/min`);
    res.status(429).json({ message: 'Limite de operações administrativas excedido. Aguarde 1 minuto.' });
  },
});

/**
 * Relatórios: 20 req/min por empresa
 */
export const reportRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: keyByTenant,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res) => {
    const authReq = req as IAuthRequest;
    const identifier = authReq.user?.empresaId || req.ip;
    logger.warn(`[RateLimit] Reports — empresa=${identifier} excedeu 20/min`);
    res.status(429).json({ message: 'Limite de geração de relatórios excedido. Aguarde 1 minuto.' });
  },
});

/**
 * Regeneração de API Key: 3 req/hora por usuário (operação sensível)
 */
export const regenerateApiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => {
    const authReq = req as IAuthRequest;
    const userId = authReq.user?.id;
    const empresaId = authReq.user?.empresaId;
    if (userId && empresaId) return `apikey_regen:${userId}:${empresaId}`;
    return `ip:${ipKeyGenerator(req.ip ?? '::1')}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res) => {
    const authReq = req as IAuthRequest;
    logger.warn(
      `[RateLimit] APIKey Regen — user=${authReq.user?.id} empresa=${authReq.user?.empresaId} IP=${req.ip}`
    );
    res.status(429).json({
      message: 'Limite de regenerações de API Key por hora atingido.',
      retryAfter: '1 hour',
    });
  },
});

/**
 * SSE streams: 10 novas conexões/min por usuário.
 * SSE connections são long-lived — o cliente só abre uma nova conexão ao reconectar.
 * 10/min é generoso o suficiente para reconexões normais sem permitir connection spam.
 * Não aplicar no heartbeat/poll — apenas nos endpoints que abrem o stream SSE.
 */
export const sseRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const authReq = req as IAuthRequest;
    logger.warn(`[RateLimit] SSE — user=${authReq.user?.id} IP=${req.ip} excedeu 10 conexões/min`);
    res.status(429).json({
      message: 'Limite de conexões SSE atingido. O cliente irá reconectar automaticamente.',
      code: 'SSE_RATE_LIMITED',
    });
  },
});

/**
 * Uploads: 30 req/min por usuário.
 * Previne uso abusivo do endpoint de upload (R2 tem custo por operação).
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const authReq = req as IAuthRequest;
    logger.warn(`[RateLimit] Upload — user=${authReq.user?.id} empresa=${authReq.user?.empresaId} IP=${req.ip} excedeu 30/min`);
    res.status(429).json({
      message: 'Limite de uploads atingido. Aguarde 1 minuto e tente novamente.',
      code: 'UPLOAD_RATE_LIMITED',
    });
  },
});

// ─── Public API policy constants (exported for tests) ────────────────────────

export const PUBLIC_DATA_WINDOW_MS   = 15 * 60 * 1000;
export const PUBLIC_DATA_MAX         = 100;
export const PUBLIC_MEDIA_WINDOW_MS  = 15 * 60 * 1000;
export const PUBLIC_MEDIA_MAX        = 5000;
export const PUBLIC_EXPORT_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_EXPORT_MAX       = 300;

/**
 * skip para publicApiRateLimiter (relativo ao mount point em app.use).
 *   /api/v1/public → req.path = /media/...         → skip
 *   /api/public    → req.path = /placas/x/imagem   → skip (endsWith /imagem)
 */
export function publicDataSkip(req: Request): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const p = req.path;
  return p.startsWith('/media/') || p.endsWith('/imagem');
}

export function publicDataKeyGenerator(req: Request): string {
  const raw = (req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '') || '').trim();
  const idx = raw.lastIndexOf('_');
  const prefix = idx > 0 ? raw.slice(0, idx) : raw;
  return prefix ? `pub:${prefix}` : `ip:${ipKeyGenerator(req.ip ?? '::1')}`;
}

export function publicMediaKeyGenerator(req: Request): string {
  const raw = (req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '') || '').trim();
  const idx = raw.lastIndexOf('_');
  const prefix = idx > 0 ? raw.slice(0, idx) : raw;
  return prefix ? `pub_media:${prefix}` : `ip_media:${ipKeyGenerator(req.ip ?? '::1')}`;
}

export function publicExportKeyGenerator(req: Request): string {
  const raw = (req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '') || '').trim();
  const idx = raw.lastIndexOf('_');
  const prefix = idx > 0 ? raw.slice(0, idx) : raw;
  return prefix ? `pub_export:${prefix}` : `ip_export:${ipKeyGenerator(req.ip ?? '::1')}`;
}

/**
 * Public Data API: 100 req/15min por prefixo de API key.
 * Aplica-se apenas a rotas JSON (listagens, filtros, consultas).
 * Rotas de mídia são excluídas via publicDataSkip — elas têm publicMediaRateLimiter.
 */
export const publicApiRateLimiter = rateLimit({
  windowMs: PUBLIC_DATA_WINDOW_MS,
  max: PUBLIC_DATA_MAX,
  skip: publicDataSkip,
  keyGenerator: publicDataKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const raw = req.header('x-api-key') || '';
    const prefix = raw.slice(0, raw.lastIndexOf('_')) || 'unknown';
    logger.warn('[RateLimit] PublicData — limite atingido', {
      route: req.path,
      method: req.method,
      ip: req.ip,
      origin: req.header('origin') || '-',
      userAgent: req.header('user-agent') || '-',
      limiter: 'public-data',
      limit: PUBLIC_DATA_MAX,
      windowMs: PUBLIC_DATA_WINDOW_MS,
      prefix,
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'PUBLIC_API_RATE_LIMITED',
        message: 'Limite de requisições atingido. Aguarde 15 minutos.',
      },
      meta: {
        requestId: req.header('x-request-id') || 'rate-limited',
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

/**
 * Public Export API: 300 req/15min por prefixo de API key (ou IP).
 * Aplica-se ao endpoint de exportação bulk de placas:
 *   /api/v1/public/placas/export
 *   /api/public/placas/export
 *
 * Mais generoso que dados paginados (100) porque o WordPress/JetEngine
 * pode re-fazer a chamada em cada renderização de página.
 * Keyspace separado (pub_export: / ip_export:) para isolamento total.
 */
export const publicExportRateLimiter = rateLimit({
  windowMs: PUBLIC_EXPORT_WINDOW_MS,
  max: PUBLIC_EXPORT_MAX,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: publicExportKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('[RateLimit] PublicExport — limite atingido', {
      route: req.path,
      method: req.method,
      ip: req.ip,
      origin: req.header('origin') || '-',
      userAgent: req.header('user-agent') || '-',
      limiter: 'public-export',
      limit: PUBLIC_EXPORT_MAX,
      windowMs: PUBLIC_EXPORT_WINDOW_MS,
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'PUBLIC_EXPORT_RATE_LIMITED',
        message: 'Limite de exportações atingido. Aguarde 15 minutos.',
      },
      meta: {
        requestId: req.header('x-request-id') || 'rate-limited',
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  },
});

/**
 * Public Media API: 5000 req/15min por prefixo de API key (ou IP).
 * Aplica-se a todas as rotas de imagem/asset público:
 *   /api/v1/public/media/*
 *   /api/public/placas/:id/imagem
 *
 * Limite alto porque uma página com 37 placas gera 37 requisições simultâneas.
 * Keyspace separado (pub_media: / ip_media:) para não interferir no bucket de dados.
 */
export const publicMediaRateLimiter = rateLimit({
  windowMs: PUBLIC_MEDIA_WINDOW_MS,
  max: PUBLIC_MEDIA_MAX,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: publicMediaKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('[RateLimit] PublicMedia — limite atingido', {
      route: req.path,
      method: req.method,
      ip: req.ip,
      origin: req.header('origin') || '-',
      userAgent: req.header('user-agent') || '-',
      limiter: 'public-media',
      limit: PUBLIC_MEDIA_MAX,
      windowMs: PUBLIC_MEDIA_WINDOW_MS,
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'PUBLIC_MEDIA_RATE_LIMITED',
        message: 'Limite de requisições de mídia atingido. Aguarde 15 minutos.',
      },
      meta: {
        requestId: req.header('x-request-id') || 'rate-limited',
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  },
});
