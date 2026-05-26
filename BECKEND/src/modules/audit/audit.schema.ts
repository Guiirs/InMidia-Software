import { Schema } from 'mongoose';
import type { AuditLogDocument } from './audit.types';

export const auditLogSchema = new Schema<AuditLogDocument>(
  {
    empresaId: { type: Schema.Types.ObjectId, ref: 'Empresa', index: true, required: false },
    actorUserId: { type: String, index: true },
    actorName: { type: String, trim: true },
    actorEmail: { type: String, trim: true },
    actorRole: { type: String, trim: true },
    action: { type: String, required: true, index: true, trim: true },
    module: { type: String, required: true, index: true, trim: true },
    entityType: { type: String, index: true, trim: true },
    entityId: { type: String, index: true, trim: true },
    entityLabel: { type: String, trim: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },
    correlationId: { type: String, index: true, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ empresaId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
