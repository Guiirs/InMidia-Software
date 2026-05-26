import { Types } from 'mongoose';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogDocument {
  _id: Types.ObjectId;
  empresaId?: Types.ObjectId | string | null;
  actorUserId?: string | null;
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
  userId?: string | null;
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
