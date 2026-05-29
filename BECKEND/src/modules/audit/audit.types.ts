import { Types } from 'mongoose';

export type AuditSeverity = 'info' | 'warning' | 'critical';
export type AuditActorType = 'user' | 'system' | 'service';

export interface AuditLogDocument {
  _id: Types.ObjectId;
  empresaId?: Types.ObjectId | string | null;
  actorUserId?: string | null;
  actorType?: AuditActorType;
  actorLabel?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  severity: AuditSeverity;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditActor {
  type?: AuditActorType;
  userId?: string | null;
  label?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface RecordAuditEventInput {
  empresaId?: string | null;
  actor?: AuditActor;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditQuery {
  empresaId?: string;
  isSuperadmin?: boolean;
  module?: string;
  action?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  severity?: AuditSeverity;
  since?: string;
  until?: string;
  limit?: number;
  page?: number;
}
