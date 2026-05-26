import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  user: mongoose.Types.ObjectId; // ref: User
  action: string; // e.g., 'CREATE', 'UPDATE', 'DELETE'
  resource: string; // e.g., 'Placa', 'Contrato'
  resourceId: string;
  changes: any; // Mixed - storing diffs or changes
  timestamp: Date;
  ip: string;
}

const AuditLogSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String, required: true },
  changes: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  ip: { type: String, required: true },
});

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);