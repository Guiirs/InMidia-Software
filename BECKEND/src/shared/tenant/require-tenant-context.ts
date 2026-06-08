import { Request } from 'express';
import AppError from '@shared/container/AppError';
import type { OrganizationContext } from './tenant-context';

/**
 * Garante que req.organizationContext está presente e retorna o contexto.
 * Lança 403 se o middleware resolveTenantMiddleware não foi executado antes.
 */
export function requireOrganizationContext(req: Request): OrganizationContext {
  if (!req.organizationContext) {
    throw new AppError('Contexto de organização não resolvido para este request.', 403);
  }
  return req.organizationContext;
}

/**
 * Garante que o organizationContext tem organizationId não-nulo.
 * Lança 404 se o tenant não possui Organization no novo domínio ainda.
 */
export function requireOrganizationId(req: Request): string {
  const ctx = requireOrganizationContext(req);
  if (!ctx.organizationId) {
    throw new AppError('Organização não encontrada para este tenant.', 404);
  }
  return ctx.organizationId;
}
