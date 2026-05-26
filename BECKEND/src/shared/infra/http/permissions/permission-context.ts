import { Request } from 'express';
import AppError from '@shared/container/AppError';
import {
  PermissionContext,
  getRolePermissions,
  normalizeRole,
} from './permissions.types';

export const createPermissionContextFromRequest = (req: Request): PermissionContext => {
  if (!req.user || !req.tenantContext) {
    throw new AppError('Contexto de autenticação inválido para RBAC.', 403);
  }

  const role = normalizeRole(req.user.role);

  return {
    userId: req.user.id,
    empresaId: req.tenantContext.empresaId,
    role,
    originalRole: req.user.role,
    permissions: getRolePermissions(req.user.role ?? role),
    authSource: req.tenantContext.authSource,
  };
};
