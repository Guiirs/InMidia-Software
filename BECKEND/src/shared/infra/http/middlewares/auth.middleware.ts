import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '@config/config';
import logger from '@shared/container/logger';
import { IUserPayload } from '../../../../types/express.d';
import AppError from '@shared/container/AppError';
import { createTenantContextFromJwt, requireEmpresaId } from '../tenant/tenant-context';
import { createPermissionContextFromRequest } from '../permissions/permission-context';
import { tokenBlacklist } from '@shared/infra/auth/token-blacklist.service';
import { ACCESS_COOKIE } from '@modules/auth/services/auth.service';
import { getClientIp, getRequestId, getRequestOrigin } from '@shared/infra/http/proxy.utils';

/**
 * Extrai token JWT do request.
 * Ordem de prioridade: HttpOnly cookie > Bearer header.
 * Mantém suporte Bearer para compatibilidade transitória com clientes legados.
 */
function extractToken(req: Request): string | null {
  // 1) HttpOnly cookie (preferido — seguro, HttpOnly, não exposto a JS)
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  if (cookieToken && typeof cookieToken === 'string') {
    return cookieToken;
  }

  // 2) Bearer header (legado — aceito durante período de transição)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7);
    if (bearerToken) return bearerToken;
  }

  return null;
}

const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const rid = getRequestId(req);
    const ip  = getClientIp(req);
    const origin = getRequestOrigin(req) ?? '-';

    logger.debug(`[Auth] verifying token rid=${rid} ip=${ip} path=${req.path}`);

    const token = extractToken(req);

    if (!token) {
      logger.warn(`[Auth] token ausente rid=${rid} ip=${ip} origin=${origin} path=${req.path}`);
      res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Autenticacao obrigatoria.',
      });
      return;
    }

    jwt.verify(token, config.jwtSecret, async (err, decoded) => {
      try {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            logger.warn(`[Auth] token expirado rid=${rid} ip=${ip} origin=${origin}`);
            res.status(401).json({
              success: false,
              code: 'TOKEN_EXPIRED',
              message: 'Sessao expirada. Renove sua autenticacao.',
            });
            return;
          }

          logger.warn(`[Auth] token invalido reason=${err.message} rid=${rid} ip=${ip} origin=${origin}`);
          res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Token invalido. Faca login novamente.',
          });
          return;
        }

        const user = decoded as IUserPayload & { jti?: string };

        if (!user || !user.id || !user.email || !user.empresaId) {
          logger.error(`[Auth] payload incompleto rid=${rid} ip=${ip} userId=${user?.id || 'N/A'}`);
          res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Token invalido. Faca login novamente.',
          });
          return;
        }

        // Verifica se o token foi revogado (blacklist)
        if (user.jti) {
          const revoked = await tokenBlacklist.isRevoked(user.jti);
          if (revoked) {
            logger.warn(`[Auth] token revogado jti=${user.jti} userId=${user.id} rid=${rid} ip=${ip}`);
            res.status(401).json({
              success: false,
              code: 'TOKEN_REVOKED',
              message: 'Sessao encerrada. Faca login novamente.',
            });
            return;
          }
        }

        req.user = user;
        req.tenantContext = createTenantContextFromJwt(user);
        requireEmpresaId(req);
        req.permissionContext = createPermissionContextFromRequest(req);

        logger.debug(
          `[Auth] OK user=${req.user.email} empresa=${req.tenantContext.empresaId} role=${req.permissionContext.role} rid=${rid}`
        );

        next();
      } catch (callbackErr) {
        logger.error(`[Auth] erro interno rid=${rid}`, { callbackErr });
        next(new AppError('Erro interno de autenticacao.', 500));
      }
    });
  } catch (error) {
    next(error);
  }
};

export default authenticateToken;
