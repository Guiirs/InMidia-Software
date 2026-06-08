import { Request } from 'express';
import AppError from '@shared/container/AppError';
import {
  PermissionContext,
  getRolePermissions,
  normalizeRole,
  CanonicalRole,
} from './permissions.types';
import { MEMBER_ROLE_TO_CANONICAL } from '@shared/tenant/tenant-resolution.middleware';
import type { MemberRole } from '@modules/organization/membership/tenant-membership.schema';

/**
 * Converte MemberRole (OWNER, ADMIN…) para CanonicalRole do sistema de permissões.
 * Retorna 'visualizador' como safe default para roles desconhecidos.
 */
function memberRoleToCanonical(role: string): CanonicalRole {
  return MEMBER_ROLE_TO_CANONICAL[role as MemberRole] ?? 'visualizador';
}

/**
 * Cria o PermissionContext a partir do request autenticado.
 *
 * Prioridade:
 * 1. Se req.organizationContext existir e NÃO for fallback legado →
 *    usa as permissões do Membership (role canônico derivado do MemberRole).
 * 2. Caso contrário → usa role + permissões do JWT (modelo legado).
 *
 * Garante que permissões do JWT nunca elevam acesso quando há Membership ativo.
 */
export const createPermissionContextFromRequest = (req: Request): PermissionContext => {
  if (!req.user || !req.tenantContext) {
    throw new AppError('Contexto de autenticação inválido para RBAC.', 403);
  }

  // ── Membership-based permissions (novo modelo) ────────────────────────────
  if (req.organizationContext && !req.organizationContext.isLegacyFallback) {
    const canonicalRole = memberRoleToCanonical(req.organizationContext.role);
    return {
      userId: req.user.id,
      empresaId: req.tenantContext.empresaId,
      role: canonicalRole,
      originalRole: req.organizationContext.role,
      permissions: req.organizationContext.permissions,
      authSource: req.tenantContext.authSource,
    };
  }

  // ── Legacy JWT-based permissions (fallback) ───────────────────────────────
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
