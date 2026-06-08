import { Schema, model, Document, Types } from 'mongoose';
import type { MemberRole } from '../membership/tenant-membership.schema';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface IInvitation extends Document {
  organizationId: Types.ObjectId;
  email: string;
  role: MemberRole;
  tokenHash: string;
  status: InvitationStatus;
  invitedByUserId: Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization é obrigatória'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email é obrigatório'],
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'FINANCIAL', 'VIEWER'],
      required: [true, 'Role é obrigatório'],
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash é obrigatório'],
      select: false,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviter é obrigatório'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Data de expiração é obrigatória'],
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'invitations',
  }
);

// Um email não pode ter dois convites PENDING na mesma organização
invitationSchema.index(
  { organizationId: 1, email: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } }
);

export const Invitation = model<IInvitation>('Invitation', invitationSchema);
