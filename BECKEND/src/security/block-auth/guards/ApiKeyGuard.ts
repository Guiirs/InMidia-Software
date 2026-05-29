import { Request } from 'express';
import { BlockAuthGuardResult, IBlockAuthGuard, SecurityContext } from '../types/blockAuth.types';
import { isPublicApiPath } from '../config/blockAuthPolicy';
import logger from '@shared/container/logger';

const PUBLIC_IMAGE_PREFIXES: readonly string[] = [
  '/public/v1/images/',
  '/api/public/images/',
];

function isPublicImageRoute(path: string): boolean {
  return PUBLIC_IMAGE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export class ApiKeyGuard implements IBlockAuthGuard {
  execute(req: Request, _context: SecurityContext): BlockAuthGuardResult {
    if (!isPublicApiPath(req.path)) {
      return { decision: 'ALLOW' };
    }

    // Block API key in query string — it would be logged in plaintext server logs
    const query = req.query as Record<string, unknown>;
    const hasQueryApiKey = !!(query['apiKey'] || query['api_key']);
    if (hasQueryApiKey) {
      logger.warn(
        `[ApiKeyGuard] API key in query string path=${req.path} ip=${req.ip ?? 'unknown'}`
      );
      return { decision: 'BLOCK', reason: 'API_KEY_QUERY_FORBIDDEN', riskScore: 50 };
    }

    // Public image routes are intentionally accessible without an API key
    if (isPublicImageRoute(req.path)) {
      return { decision: 'ALLOW' };
    }

    // Missing API key: ALLOW — let the existing apiKeyAuthMiddleware produce its own 401 +
    // PUBLIC_API_KEY_MISSING response. Block Auth V1 only enforces the query-string
    // prohibition; key presence/validation stays in the existing middleware chain.
    return { decision: 'ALLOW' };
  }
}
