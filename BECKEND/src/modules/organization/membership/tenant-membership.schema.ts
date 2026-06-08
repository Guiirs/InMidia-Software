import { Schema, model, Document, Types } from 'mongoose';

export type MemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'FINANCIAL' | 'VIEWER';
export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

export interface ITenantMembership extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MemberRole;
  status: MemberStatus;
  permissions?: string[];
  invitedByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tenantMembershipSchema = new Schema<ITenantMembership>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization é obrigatória'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User é obrigatório'],
      index: true,
    },
    role: {
      type: String,
      enum: ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'FINANCIAL', 'VIEWER'],
      required: [true, 'Role é obrigatório'],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED'],
      default: 'ACTIVE',
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'tenant_memberships',
  }
);

tenantMembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
tenantMembershipSchema.index({ organizationId: 1, status: 1 });

export const TenantMembership = model<ITenantMembership>('TenantMembership', tenantMembershipSchema);
