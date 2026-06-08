import { Schema, model, Document, Types } from 'mongoose';

export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PENDING';
export type OrgPlan = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type OnboardingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface IOrganizationSettings {
  allowSelfServiceInvite?: boolean;
  maxMembers?: number;
  timezone?: string;
  locale?: string;
}

export interface IOrganizationLimits {
  maxPlates?: number;
  maxUsers?: number;
  maxRegions?: number;
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  status: OrgStatus;
  plan: OrgPlan;
  ownerUserId: Types.ObjectId;
  legacyEmpresaId?: Types.ObjectId;
  settings: IOrganizationSettings;
  limits: IOrganizationLimits;
  onboardingStatus: OnboardingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, 'Nome da organização é obrigatório'],
      trim: true,
      maxlength: [200, 'Nome deve ter no máximo 200 caracteres'],
    },
    slug: {
      type: String,
      required: [true, 'Slug é obrigatório'],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      match: [/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING'],
      default: 'ACTIVE',
      index: true,
    },
    plan: {
      type: String,
      enum: ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'],
      default: 'FREE',
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner é obrigatório'],
      index: true,
    },
    legacyEmpresaId: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      index: true,
      sparse: true,
    },
    settings: {
      allowSelfServiceInvite: { type: Boolean, default: false },
      maxMembers: { type: Number, default: 10 },
      timezone: { type: String, default: 'America/Sao_Paulo' },
      locale: { type: String, default: 'pt-BR' },
    },
    limits: {
      maxPlates: { type: Number, default: 100 },
      maxUsers: { type: Number, default: 10 },
      maxRegions: { type: Number, default: 20 },
    },
    onboardingStatus: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
    collection: 'organizations',
  }
);

organizationSchema.index({ legacyEmpresaId: 1 }, { sparse: true });

export const Organization = model<IOrganization>('Organization', organizationSchema);
