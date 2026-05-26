import mongoose, { Model } from 'mongoose';
import { auditLogSchema } from './audit.schema';
import type { AuditLogDocument } from './audit.types';

const AuditLog: Model<AuditLogDocument> =
  mongoose.models.AuditLog || mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);

export default AuditLog;
