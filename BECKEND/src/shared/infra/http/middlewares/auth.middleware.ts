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
    logger.debug('[AuthMiddleware] Autenticando token...');

    const token = extractToken(req);

    if (!token) {
      logger.warn('[AuthMiddleware] Token ausente.');
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
          logger.warn(`[AuthMiddleware] Token inválido: ${err.message}`);

          if (err.name === 'TokenExpiredError') {
            res.status(401).json({
              success: false,
              code: 'TOKEN_EXPIRED',
              message: 'Sessao expirada. Renove sua autenticacao.',
            });
            return;
          }

          res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Token invalido. Faca login novamente.',
          });
          return;
        }

        const user = decoded as IUserPayload & { jti?: string };

        if (!user || !user.id || !user.email || !user.empresaId) {
          logger.error(`[AuthMiddleware] Payload incompleto userId=${user?.id || 'N/A'}`);
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
            logger.warn(`[AuthMiddleware] Token revogado jti=${user.jti} userId=${user.id}`);
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
          `[AuthMiddleware] OK userId=${req.user.email} empresaId=${req.tenantContext.empresaId} role=${req.permissionContext.role}`
        );

        next();
      } catch (callbackErr) {
        logger.error('[AuthMiddleware] Erro no callback JWT', { callbackErr });
        next(new AppError('Erro interno de autenticacao.', 500));
      }
    });
  } catch (error) {
    next(error);
  }
};

export default authenticateToken;
