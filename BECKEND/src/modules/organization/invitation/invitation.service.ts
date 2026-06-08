import crypto from 'crypto';
import AppError from '@shared/container/AppError';
import { Invitation, IInvitation } from './invitation.schema';
import { membershipRepository } from '../membership/membership.repository';
import { organizationRepository } from '../organization.repository';
import type { CreateInvitationInput } from '../dtos/invitation.dto';
import { Types } from 'mongoose';
import User from '@modules/users/User';

const INVITATION_TTL_HOURS = 48;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export class InvitationService {
  async createInvitation(
    organizationId: string,
    data: CreateInvitationInput,
    invitedByUserId: string
  ): Promise<{ invitation: Omit<IInvitation, 'tokenHash'>; token: string }> {
    // Validar permissão: apenas OWNER ou ADMIN
    const requestingMembership = await membershipRepository.findByOrgAndUser(organizationId, invitedByUserId);
    if (!requestingMembership || requestingMembership.status !== 'ACTIVE') {
      throw new AppError('Acesso negado', 403);
    }
    if (requestingMembership.role !== 'OWNER' && requestingMembership.role !== 'ADMIN') {
      throw new AppError('Apenas OWNER ou ADMIN podem convidar usuários', 403);
    }

    // Organização existe
    await organizationRepository.findById(organizationId);

    // Verificar convite duplicado pendente
    const existingPending = await Invitation.findOne({
      organizationId: new Types.ObjectId(organizationId),
      email: data.email,
      status: 'PENDING',
    });
    if (existingPending) {
      throw new AppError('Já existe um convite pendente para este email nesta organização', 409);
    }

    const { token, tokenHash } = generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

    const invitation = new Invitation({
      organizationId: new Types.ObjectId(organizationId),
      email: data.email,
      role: data.role,
      tokenHash,
      status: 'PENDING',
      invitedByUserId: new Types.ObjectId(invitedByUserId),
      expiresAt,
    });

    await invitation.save();

    const { tokenHash: _discarded, ...invitationObj } = invitation.toObject() as IInvitation & { tokenHash?: string };
    void _discarded;

    return { invitation: invitationObj as Omit<IInvitation, 'tokenHash'>, token };
  }

  async listInvitations(organizationId: string, requestingUserId: string): Promise<IInvitation[]> {
    const membership = await membershipRepository.findByOrgAndUser(organizationId, requestingUserId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('Acesso negado', 403);
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new AppError('Sem permissão para listar convites', 403);
    }

    return Invitation.find({ organizationId: new Types.ObjectId(organizationId) })
      .select('-tokenHash')
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<IInvitation[]>;
  }

  async acceptInvitation(token: string, acceptingUserId: string): Promise<void> {
    const tokenHash = hashToken(token);

    const invitation = await Invitation.findOne({ tokenHash, status: 'PENDING' });
    if (!invitation) throw new AppError('Convite inválido ou expirado', 404);

    if (invitation.expiresAt < new Date()) {
      await Invitation.findByIdAndUpdate(invitation._id, { status: 'EXPIRED' });
      throw new AppError('Convite expirado', 410);
    }

    // Verificar se o usuário existe e se o email bate
    const user = await User.findById(acceptingUserId).lean();
    if (!user) throw new AppError('Usuário não encontrado', 404);
    if ((user as { email?: string }).email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError('Este convite não pertence ao seu email', 403);
    }

    const organizationId = invitation.organizationId.toString();
    const invitedByUserId = invitation.invitedByUserId.toString();

    await membershipRepository.upsertFromInvitation(
      organizationId,
      acceptingUserId,
      invitation.role,
      invitedByUserId
    );

    await Invitation.findByIdAndUpdate(invitation._id, {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    });
  }
}

export const invitationService = new InvitationService();
