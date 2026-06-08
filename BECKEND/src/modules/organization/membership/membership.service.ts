import AppError from '@shared/container/AppError';
import { ITenantMembership, MemberRole, MemberStatus } from './tenant-membership.schema';
import { membershipRepository } from './membership.repository';

const OWNER_MANAGEABLE_ROLES: MemberRole[] = ['OWNER', 'ADMIN'];

export class MembershipService {
  async listMembers(organizationId: string): Promise<ITenantMembership[]> {
    return membershipRepository.findByOrganization(organizationId);
  }

  async updateMemberRole(
    memberId: string,
    organizationId: string,
    newRole: MemberRole,
    requestingUserId: string
  ): Promise<ITenantMembership> {
    const requestingMembership = await membershipRepository.findByOrgAndUser(organizationId, requestingUserId);
    if (!requestingMembership || requestingMembership.status !== 'ACTIVE') {
      throw new AppError('Acesso negado', 403);
    }

    const targetMember = await membershipRepository.findById(memberId);
    if (targetMember.organizationId.toString() !== organizationId) {
      throw new AppError('Membro não pertence a esta organização', 403);
    }

    const requestingRole = requestingMembership.role;

    // Apenas OWNER pode promover/rebaixar ADMIN ou OWNER
    const targetIsPrivileged = OWNER_MANAGEABLE_ROLES.includes(targetMember.role);
    const newRoleIsPrivileged = OWNER_MANAGEABLE_ROLES.includes(newRole);

    if ((targetIsPrivileged || newRoleIsPrivileged) && requestingRole !== 'OWNER') {
      throw new AppError('Apenas o OWNER pode alterar roles ADMIN ou OWNER', 403);
    }

    if (requestingRole !== 'OWNER' && requestingRole !== 'ADMIN') {
      throw new AppError('Sem permissão para alterar roles', 403);
    }

    return membershipRepository.updateRole(memberId, organizationId, newRole);
  }

  async updateMemberStatus(
    memberId: string,
    organizationId: string,
    newStatus: MemberStatus,
    requestingUserId: string
  ): Promise<ITenantMembership> {
    const requestingMembership = await membershipRepository.findByOrgAndUser(organizationId, requestingUserId);
    if (!requestingMembership || requestingMembership.status !== 'ACTIVE') {
      throw new AppError('Acesso negado', 403);
    }

    const requestingRole = requestingMembership.role;
    if (requestingRole !== 'OWNER' && requestingRole !== 'ADMIN') {
      throw new AppError('Sem permissão para alterar status de membros', 403);
    }

    const targetMember = await membershipRepository.findById(memberId);
    if (targetMember.organizationId.toString() !== organizationId) {
      throw new AppError('Membro não pertence a esta organização', 403);
    }

    // OWNER não pode remover a si mesmo se for o único OWNER ativo
    const targetUserId = targetMember.userId.toString();
    if (newStatus === 'REMOVED' && targetUserId === requestingUserId) {
      if (targetMember.role === 'OWNER') {
        const ownerCount = await membershipRepository.countActiveOwners(organizationId);
        if (ownerCount <= 1) {
          throw new AppError('Não é possível remover o único OWNER ativo da organização', 409);
        }
      }
    }

    return membershipRepository.updateStatus(memberId, organizationId, newStatus);
  }
}

export const membershipService = new MembershipService();
