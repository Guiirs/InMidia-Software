import { Request } from 'express';
import { isValidObjectId } from 'mongoose';
import { BlockAuthGuardResult, IBlockAuthGuard, SecurityContext } from '../types/blockAuth.types';
import { isExemptPath, isPublicApiPath } from '../config/blockAuthPolicy';
import logger from '@shared/container/logger';

const INVALID_TENANT_VALUES: ReadonlySet<string> = new Set([
  'system',
  'unknown',
  'null',
  'undefined',
  '',
]);

function extractRequestEmpresaId(req: Request): string | null {
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body['empresaId'] === 'string') return body['empresaId'];

  const query = req.query as Record<string, unknown> | undefined;
  if (query && typeof query['empresaId'] === 'string') return query['empresaId'];

  return null;
}

export class TenantGuard implements IBlockAuthGuard {
  execute(req: Request, _context: SecurityContext): BlockAuthGuardResult {
    if (isExemptPath(req.path)) {
      return { decision: 'ALLOW' };
    }

    const requestEmpresaId = extractRequestEmpresaId(req);

    // Sanitize invalid ObjectId values like "system" or "unknown"
    // This prevents CastError downstream when Mongoose queries with these strings
    if (requestEmpresaId !== null) {
      if (INVALID_TENANT_VALUES.has(requestEmpresaId) || !isValidObjectId(requestEmpresaId)) {
        logger.warn(
          `[TenantGuard] Non-ObjectId empresaId detected empresaId="${requestEmpresaId}" path=${req.path}`
        );
        return {
          decision: 'ALLOW',
          contextPatch: {
            empresaId: null,
            systemContext: requestEmpresaId,
          },
        };
      }
    }

    // If req.user is already set by a prior auth middleware, cross-check tenant
    if (req.user?.empresaId && requestEmpresaId) {
      const tokenEmpresaId = String(req.user.empresaId);

      if (tokenEmpresaId !== requestEmpresaId && !isPublicApiPath(req.path)) {
        logger.warn(
          `[TenantGuard] Tenant mismatch ` +
            `tokenEmpresa=${tokenEmpresaId} requestEmpresa=${requestEmpresaId} path=${req.path}`
        );
        return {
          decision: 'BLOCK',
          reason: 'TENANT_MISMATCH',
          riskScore: 90,
          contextPatch: { empresaId: tokenEmpresaId },
        };
      }

      return { decision: 'ALLOW', contextPatch: { empresaId: tokenEmpresaId } };
    }

    if (requestEmpresaId && isValidObjectId(requestEmpresaId)) {
      return { decision: 'ALLOW', contextPatch: { empresaId: requestEmpresaId } };
    }

    return { decision: 'ALLOW' };
  }
}
