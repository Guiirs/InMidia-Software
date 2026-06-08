import { Types } from 'mongoose';
import AppError from '@shared/container/AppError';
import { TenantMembership, ITenantMembership, MemberRole, MemberStatus } from './tenant-membership.schema';

export class MembershipRepository {
  async findByOrganization(organizationId: string): Promise<ITenantMembership[]> {
    return TenantMembership.find({
      organizationId: new Types.ObjectId(organizationId),
      status: { $nin: ['REMOVED'] },
    })
      .populate('userId', 'nome email')
      .lean() as unknown as Promise<ITenantMembership[]>;
  }

  async findByOrgAndUser(organizationId: string, userId: string): Promise<ITenantMembership | null> {
    return TenantMembership.findOne({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(userId),
    }).lean() as unknown as Promise<ITenantMembership | null>;
  }

  async findById(id: string): Promise<ITenantMembership> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('ID de membro inválido', 400);
    const member = await TenantMembership.findById(id).lean();
    if (!member) throw new AppError('Membro não encontrado', 404);
    return member as unknown as ITenantMembership;
  }

  async create(organizationId: string, userId: string, role: MemberRole, invitedByUserId?: string): Promise<ITenantMembership> {
    const membership = new TenantMembership({
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(userId),
      role,
      status: 'ACTIVE',
      invitedByUserId: invitedByUserId ? new Types.ObjectId(invitedByUserId) : undefined,
    });
    await membership.save();
    return membership.toObject<ITenantMembership>();
  }

  async updateRole(id: string, organizationId: string, role: MemberRole): Promise<ITenantMembership> {
    const member = await TenantMembership.findOneAndUpdate(
      { _id: id, organizationId: new Types.ObjectId(organizationId) },
      { role },
      { new: true, runValidators: true }
    ).lean();
    if (!member) throw new AppError('Membro não encontrado', 404);
    return member as unknown as ITenantMembership;
  }

  async updateStatus(id: string, organizationId: string, status: MemberStatus): Promise<ITenantMembership> {
    const member = await TenantMembership.findOneAndUpdate(
      { _id: id, organizationId: new Types.ObjectId(organizationId) },
      { status },
      { new: true, runValidators: true }
    ).lean();
    if (!member) throw new AppError('Membro não encontrado', 404);
    return member as unknown as ITenantMembership;
  }

  async countActiveOwners(organizationId: string): Promise<number> {
    return TenantMembership.countDocuments({
      organizationId: new Types.ObjectId(organizationId),
      role: 'OWNER',
      status: 'ACTIVE',
    });
  }

  async upsertFromInvitation(organizationId: string, userId: string, role: MemberRole, invitedByUserId: string): Promise<ITenantMembership> {
    const membership = await TenantMembership.findOneAndUpdate(
      {
        organizationId: new Types.ObjectId(organizationId),
        userId: new Types.ObjectId(userId),
      },
      {
        $set: {
          role,
          status: 'ACTIVE',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    return membership as unknown as ITenantMembership;
  }
}

export const membershipRepository = new MembershipRepository();
