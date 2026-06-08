import { Types } from 'mongoose';
import AppError from '@shared/container/AppError';
import Empresa from '@modules/empresas/Empresa';
import { Organization, IOrganization } from '../organization.schema';
import { TenantMembership, ITenantMembership, MemberRole } from '../membership/tenant-membership.schema';
import { organizationRepository } from '../organization.repository';
import { membershipRepository } from '../membership/membership.repository';

/**
 * Mapeamento de roles legadas do JWT → MemberRole do Organization Domain.
 *
 * vendedor → OPERATOR (rationale: vendedores executam tarefas comerciais
 * específicas como criar propostas e acompanhar contratos; não gerenciam
 * a organização nem têm acesso administrativo amplo — OPERATOR descreve
 * exatamente esse perfil de execução focada).
 */
export const LEGACY_ROLE_TO_MEMBER_ROLE: Record<string, MemberRole> = {
  superadmin:   'OWNER',
  admin_empresa:'ADMIN',
  admin:        'ADMIN',
  gestor:       'MANAGER',
  manager:      'MANAGER',
  vendedor:     'OPERATOR',
  user:         'OPERATOR',
  financeiro:   'FINANCIAL',
  visualizador: 'VIEWER',
  viewer:       'VIEWER',
};

export interface EnsureOrgResult {
  organization: IOrganization;
  membership: ITenantMembership;
  organizationCreated: boolean;
  membershipCreated: boolean;
}

/**
 * Garante que existe Organization + TenantMembership para uma empresa legada.
 *
 * Idempotente: pode ser chamado múltiplas vezes sem duplicar dados.
 *
 * Comportamento:
 * - Se Organization com legacyEmpresaId já existe → reutiliza.
 * - Se não existe → cria Organization com dados da Empresa.
 * - Se Membership do userId já existe (qualquer status) → mantém sem alterar.
 * - Se Membership não existe → cria com role mapeado do legado.
 */
export async function ensureOrganizationForLegacyEmpresa({
  empresaId,
  userId,
  userRole,
}: {
  empresaId: string;
  userId: string;
  userRole: string;
}): Promise<EnsureOrgResult> {
  if (!Types.ObjectId.isValid(empresaId)) {
    throw new AppError('empresaId inválido', 400);
  }
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('userId inválido', 400);
  }

  // ── 1. Localizar ou criar Organization ──────────────────────────────────
  let organizationCreated = false;
  let org = await Organization.findOne({
    legacyEmpresaId: new Types.ObjectId(empresaId),
  }).lean() as IOrganization | null;

  if (!org) {
    const empresa = await Empresa.findById(empresaId).lean() as { nome?: string } | null;
    if (!empresa) throw new AppError('Empresa não encontrada', 404);

    const baseName = String(empresa.nome ?? empresaId).trim();
    const slug = generateSlug(baseName, empresaId);

    org = await organizationRepository.create(
      { name: baseName, slug, plan: 'FREE', legacyEmpresaId: empresaId },
      userId
    );
    organizationCreated = true;
  }

  const orgId = (org._id as Types.ObjectId).toString();

  // ── 2. Localizar ou criar TenantMembership ──────────────────────────────
  let membershipCreated = false;
  let membership = await TenantMembership.findOne({
    organizationId: new Types.ObjectId(orgId),
    userId: new Types.ObjectId(userId),
  }).lean() as ITenantMembership | null;

  if (!membership) {
    const memberRole = mapLegacyRoleToMemberRole(userRole);
    membership = await membershipRepository.create(orgId, userId, memberRole);
    membershipCreated = true;
  }

  return {
    organization: org,
    membership,
    organizationCreated,
    membershipCreated,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapLegacyRoleToMemberRole(role: string): MemberRole {
  return LEGACY_ROLE_TO_MEMBER_ROLE[role] ?? 'VIEWER';
}

function generateSlug(name: string, fallbackId: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const suffix = fallbackId.slice(-6);
  return base ? `${base}-${suffix}` : `org-${suffix}`;
}
