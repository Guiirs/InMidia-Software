import { Request, Response, NextFunction } from 'express';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';
import { Permission, hasPermission } from '@shared/infra/http/permissions/permissions.types';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';

export const requirePermission = (permission: Permission) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // ── Prioridade 1: OrganizationContext com Membership ACTIVE ───────────
      // Quando resolveTenantMiddleware já rodou e encontrou um Membership ativo,
      // as permissões do Membership são a fonte canônica de verdade.
      // Permissões do JWT NÃO podem elevar o acesso neste caso.
      if (req.organizationContext && !req.organizationContext.isLegacyFallback) {
        if (!req.organizationContext.permissions.includes(permission)) {
          const { userId, organizationId, role } = req.organizationContext;
          logger.warn(
            `[RBAC/Org] Acesso negado user=${userId} org=${organizationId} role=${role} permission=${permission}`
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
              source: 'organization-context',
            },
          });
          throw new AppError('Acesso negado. Permissao insuficiente.', 403);
        }
        next();
        return;
      }

      // ── Prioridade 2: Fallback legado — permissionContext do JWT ──────────
      // Usado quando: sem Organization, sem Membership, ou isLegacyFallback=true.
      if (!req.permissionContext) {
        throw new AppError('Contexto de permissoes nao encontrado.', 403);
      }

      if (!hasPermission(req.permissionContext, permission)) {
        logger.warn(
          `[RBAC/Legacy] Acesso negado user=${req.permissionContext.userId} empresa=${req.permissionContext.empresaId} role=${req.permissionContext.role} permission=${permission}`
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
            source: 'legacy-permission-context',
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
