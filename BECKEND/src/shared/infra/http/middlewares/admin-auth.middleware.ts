import { Response, NextFunction } from 'express';
import logger from '@shared/container/logger';
import { IAuthRequest } from '../../../../types/express.d';
import AppError from '@shared/container/AppError';
import { hasPermission, normalizeRole } from '@shared/infra/http/permissions/permissions.types';

/**
 * Middleware to verify admin role
 */
export const requireAdminRole = (req: IAuthRequest, _res: Response, next: NextFunction): void => {
  try {
    logger.debug('[AdminAuthMiddleware] Verificando permissão de administrador...');

    if (!req.user) {
      logger.warn(
        '[AdminAuthMiddleware] Acesso negado: req.user ausente (falha de autenticação prévia?).'
      );
      throw new AppError(
        'Acesso negado. Token inválido ou dados do utilizador em falta.',
        403
      );
    }

    const userRole = normalizeRole(req.user.role);
    const userId = req.user.id;

    if (req.permissionContext && hasPermission(req.permissionContext, 'admin.access')) {
      logger.debug(`[AdminAuthMiddleware] Admin ${userId} autenticado. Acesso permitido.`);
      next();
    } else {
      logger.warn(
        `[AdminAuthMiddleware] Utilizador ${userId} (Role: ${userRole}) tentou aceder a rota restrita. Acesso negado.`
      );
      throw new AppError(
        'Acesso negado. Apenas administradores podem realizar esta ação.',
        403
      );
    }
  } catch (error) {
    next(error);
  }
};

export const requireSuperAdminRole = (req: IAuthRequest, _res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      throw new AppError('Acesso negado. Token inválido ou dados do utilizador em falta.', 403);
    }

    if (normalizeRole(req.user.role) !== 'superadmin') {
      throw new AppError('Acesso negado. Apenas super administradores podem realizar esta ação.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default requireAdminRole;
