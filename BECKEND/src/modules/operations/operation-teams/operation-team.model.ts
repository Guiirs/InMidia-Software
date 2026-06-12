import mongoose, { Model, Schema, Types } from 'mongoose';

export type OperationTeamStatus = 'ACTIVE' | 'ARCHIVED';

export interface IOperationTeamMember {
  name: string;
  role?: string;
  phone?: string;
  active: boolean;
}

export interface IOperationTeam {
  _id: Types.ObjectId;
  empresaId: string;
  name: string;
  nameNormalized: string;
  members: IOperationTeamMember[];
  memberCount: number;
  notes?: string;
  status: OperationTeamStatus;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Normaliza o nome da equipe para deteccao de duplicidade:
 * trim + lowercase + remocao de acentos + colapso de espacos.
 */
export function normalizeTeamName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const operationTeamMemberSchema = new Schema<IOperationTeamMember>({
  name: { type: String, required: true, trim: true },
  role: { type: String, trim: true },
  phone: { type: String, trim: true },
  active: { type: Boolean, default: true },
}, { _id: false });

const operationTeamSchema = new Schema<IOperationTeam>({
  empresaId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameNormalized: { type: String, required: true },
  members: { type: [operationTeamMemberSchema], default: [] },
  memberCount: { type: Number, default: 0 },
  notes: { type: String, trim: true },
  status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
  archivedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'operation_teams' });

operationTeamSchema.index({ empresaId: 1, nameNormalized: 1 }, { unique: true });
operationTeamSchema.index({ empresaId: 1, status: 1 });

export const OperationTeam: Model<IOperationTeam> = (mongoose.models.OperationTeam as Model<IOperationTeam> | undefined)
  || mongoose.model<IOperationTeam>('OperationTeam', operationTeamSchema);

export default OperationTeam;
