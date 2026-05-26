import { Request, Response, NextFunction } from 'express';
import logger from '@shared/container/logger';

/**
 * Operadores MongoDB perigosos que devem ser bloqueados em input externo.
 * Evita NoSQL injection via body, params e query strings.
 */
const DANGEROUS_KEYS = /^\$|^\./;

const DANGEROUS_VALUES_RE = /\$(gt|gte|lt|lte|ne|nin|in|exists|type|regex|where|expr|elemMatch|size|all|not|nor|and|or|mod|text|comment)\b/i;

function sanitizeObject(obj: any, path = '', req?: Request): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    // Sanitiza valores string para operadores perigosos em valores (e.g., ?filter[$gt]=0)
    if (typeof obj === 'string' && DANGEROUS_VALUES_RE.test(obj)) {
      logger.warn(`[Security] Operador NoSQL em valor — path=${path}, value=${obj}`);
      return '';
    }
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (DANGEROUS_KEYS.test(key)) {
      logger.warn(
        `[Security] NoSQL injection detectada — IP=${req?.ip}, key=${currentPath}, method=${req?.method}, url=${req?.originalUrl}`
      );
      delete obj[key];
      continue;
    }

    if (typeof obj[key] === 'object' && obj[key] !== null) {
      obj[key] = sanitizeObject(obj[key], currentPath, req);
    } else if (typeof obj[key] === 'string' && DANGEROUS_VALUES_RE.test(obj[key])) {
      logger.warn(`[Security] Operador NoSQL em valor — path=${currentPath}`);
      obj[key] = '';
    }
  }

  return obj;
}

/**
 * Sanitiza req.query criando um novo objeto limpo (req.query é somente-leitura em Express 5).
 * Injeta req.safeQuery para uso seguro em controllers/routes.
 */
function sanitizeQuery(req: Request): Record<string, any> {
  const safe: Record<string, any> = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (DANGEROUS_KEYS.test(key)) {
      logger.warn(
        `[Security] Chave perigosa em query — IP=${req.ip}, key=${key}, url=${req.originalUrl}`
      );
      continue;
    }

    if (typeof value === 'string' && DANGEROUS_VALUES_RE.test(value)) {
      logger.warn(`[Security] Operador NoSQL em query value — key=${key}`);
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

declare global {
  namespace Express {
    interface Request {
      safeQuery?: Record<string, any>;
    }
  }
}

const sanitize = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, '', req);
    }

    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, '', req);
    }

    // req.query é somente-leitura — sanitizamos em safeQuery
    req.safeQuery = sanitizeQuery(req);

    next();
  } catch (error) {
    logger.error(`[Security] Erro ao sanitizar requisição: ${(error as Error).message}`);
    next(error);
  }
};

export default sanitize;
