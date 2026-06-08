import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import logger from '@shared/container/logger';
import { getRolePermissions, CanonicalRole } from '@shared/infra/http/permissions/permissions.types';
import { Organization } from '@modules/organization/organization.schema';
import { TenantMembership, MemberRole } from '@modules/organization/membership/tenant-membership.schema';

/**
 * Mapeamento MemberRole → CanonicalRole do sistema de permissões legado.
 * Mantém paridade entre os dois sistemas de RBAC.
 *
 * OWNER     → superadmin   (controle total da organização)
 * ADMIN     → admin_empresa (gestão ampla, sem deleção física)
 * MANAGER   → gestor       (criação + atualização, sem delete)
 * OPERATOR  → vendedor     (execução de tarefas comerciais específicas)
 * FINANCIAL → financeiro   (acesso a contratos e relatórios financeiros)
 * VIEWER    → visualizador  (somente leitura)
 */
export const MEMBER_ROLE_TO_CANONICAL: Record<MemberRole, CanonicalRole> = {
  OWNER:     'superadmin',
  ADMIN:     'admin_empresa',
  MANAGER:   'gestor',
  OPERATOR:  'vendedor',
  FINANCIAL: 'financeiro',
  VIEWER:    'visualizador',
};

/**
 * Middleware que resolve o OrganizationContext para requests autenticados.
 *
 * Algoritmo:
 * 1. Extrai empresaId e userId do request autenticado.
 * 2. Busca Organization onde legacyEmpresaId = empresaId.
 * 3. Busca TenantMembership ACTIVE do userId nessa Organization.
 * 4. Se encontrado → preenche req.organizationContext com dados do Membership.
 * 5. Se não encontrado → fallback legado com role do JWT.
 *
 * Nunca lança erro; em caso de falha de DB apenas usa fallback legado.
 * Controllers legados não são afetados.
 */
export async function resolveTenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const empresaId = req.tenantContext?.empresaId ?? req.empresaId ?? req.user?.empresaId;
  const userId = req.user?.id;

  if (!empresaId || !userId) {
    next();
    return;
  }

  try {
    if (!Types.ObjectId.isValid(empresaId)) {
      attachLegacyFallback(req, empresaId, userId);
      next();
      return;
    }

    const org = await Organization.findOne({
      legacyEmpresaId: new Types.ObjectId(empresaId),
    }).lean();

    if (!org) {
      attachLegacyFallback(req, empresaId, userId);
      next();
      return;
    }

    const membership = await TenantMembership.findOne({
      organizationId: org._id,
      userId: new Types.ObjectId(userId),
      status: 'ACTIVE',
    }).lean();

    if (!membership) {
      req.organizationContext = {
        organizationId: (org._id as Types.ObjectId).toString(),
        legacyEmpresaId: empresaId,
        userId,
        membershipId: undefined,
        role: req.user?.role ?? 'visualizador',
        permissions: getRolePermissions(req.user?.role ?? 'visualizador'),
        isLegacyFallback: true,
      };
      next();
      return;
    }

    const canonicalRole = MEMBER_ROLE_TO_CANONICAL[membership.role as MemberRole];

    req.organizationContext = {
      organizationId: (org._id as Types.ObjectId).toString(),
      legacyEmpresaId: empresaId,
      userId,
      membershipId: (membership._id as Types.ObjectId).toString(),
      role: membership.role,
      permissions: getRolePermissions(canonicalRole),
      isLegacyFallback: false,
    };

    logger.debug(
      `[TenantResolution] user=${userId} org=${req.organizationContext.organizationId} role=${membership.role} membership=${req.organizationContext.membershipId}`
    );
  } catch (err) {
    logger.warn(`[TenantResolution] Falha ao resolver org context, usando fallback legado: ${String(err)}`);
    attachLegacyFallback(req, empresaId, userId);
  }

  next();
}

function attachLegacyFallback(req: Request, empresaId: string, userId: string): void {
  req.organizationContext = {
    organizationId: null,
    legacyEmpresaId: empresaId,
    userId,
    membershipId: undefined,
    role: req.user?.role ?? 'visualizador',
    permissions: getRolePermissions(req.user?.role ?? 'visualizador'),
    isLegacyFallback: true,
  };
}
