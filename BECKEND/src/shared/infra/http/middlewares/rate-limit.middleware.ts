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
