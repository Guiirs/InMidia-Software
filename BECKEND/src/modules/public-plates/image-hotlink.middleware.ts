/**
 * Middleware de controle de acesso a imagens — preparação para hotlink protection.
 *
 * ESTADO ATUAL: pass-through (nenhum bloqueio ativo).
 * Estrutura extensível para adição futura de:
 *   - Signed tokens com expiração
 *   - Validação de Referer / Origin
 *   - Anti-scraping (rate limit por domínio, não por IP)
 *   - Whitelist de domínios permitidos
 *
 * Para ativar qualquer proteção:
 *   createImageAccessMiddleware({ enabled: true, allowedOrigins: [...] })
 *
 * Compatibilidade garantida: imageAccessMiddleware exportado é no-op enquanto
 * a proteção não estiver habilitada via configuração.
 */

import type { NextFunction, Request, Response } from 'express';
import logger from '@shared/container/logger';

export interface HotlinkProtectionConfig {
  enabled: boolean;
  /** Lista de domínios de Referer permitidos. Vazio = qualquer origem. */
  allowedOrigins?: string[];
  /** Signed tokens com expiração (futura implementação). */
  signedTokens?: boolean;
  /** Segundos de validade do token assinado. */
  tokenExpirationSeconds?: number;
  /** Anti-scraping: bloqueia IPs sem Referer em alta frequência (futura). */
  antiScraping?: boolean;
}

type ImageAccessMiddleware = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Cria um middleware de controle de acesso a imagens.
 * Com `enabled: false` (padrão), é um pass-through sem overhead.
 */
export function createImageAccessMiddleware(
  config: HotlinkProtectionConfig = { enabled: false },
): ImageAccessMiddleware {
  if (!config.enabled) {
    return (_req, _res, next) => next();
  }

  const allowedOrigins = new Set((config.allowedOrigins ?? []).map((o) => o.toLowerCase()));

  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedOrigins.size > 0) {
      const referer = (req.header('referer') || req.header('origin') || '').toLowerCase();
      const allowed = !referer || [...allowedOrigins].some((origin) => referer.includes(origin));

      if (!allowed) {
        logger.warn(`[HotlinkProtection] Blocked referer=${referer} ip=${req.ip}`);
        res.status(403).json({
          success: false,
          error: { code: 'HOTLINK_FORBIDDEN', message: 'Acesso não autorizado.' },
        });
        return;
      }
    }
    // TODO: signed tokens, anti-scraping, domain whitelist
    next();
  };
}

/** Middleware de acesso a imagens (pass-through por padrão). */
export const imageAccessMiddleware = createImageAccessMiddleware({
  enabled: false,
});
