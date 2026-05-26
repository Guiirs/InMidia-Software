import { Request, Response, NextFunction } from 'express';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';
import { Permission, hasPermission } from '@shared/infra/http/permissions/permissions.types';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';

export const requirePermission = (permission: Permission) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.permissionContext) {
        throw new AppError('Contexto de permissoes nao encontrado.', 403);
      }

      if (!hasPermission(req.permissionContext, permission)) {
        logger.warn(
          `[RBAC] Acesso negado user=${req.permissionContext.userId} empresa=${req.permissionContext.empresaId} role=${req.permissionContext.role} permission=${permission}`
        );
        await defaultAuditService.recordPermissionDenied({
          ...auditRequestContext(req),
          module: 'rbac',
          entityType: 'permission',
          entityId: permission,
          entityLabel: permission,
          metadata: {
            path: req.originalUrl,
            method: req.method,
            permission,
          },
        });
        throw new AppError('Acesso negado. Permissao insuficiente.', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
