import type { Permission } from '@shared/infra/http/permissions/permissions.types';

/**
 * Contexto de tenant rico — resolução por Organization + TenantMembership.
 * Substitui progressivamente o ITenantContext legado (baseado em empresaId + role JWT).
 *
 * isLegacyFallback = true  → sem Organization ou sem Membership ativo;
 *                            permissões derivadas do role do JWT (modelo antigo).
 * isLegacyFallback = false → Organization + Membership ACTIVE encontrados;
 *                            permissões derivadas do role do Membership.
 */
export interface OrganizationContext {
  organizationId: string | null;
  legacyEmpresaId: string;
  userId: string;
  membershipId: string | undefined;
  role: string;
  permissions: readonly Permission[];
  isLegacyFallback: boolean;
}
