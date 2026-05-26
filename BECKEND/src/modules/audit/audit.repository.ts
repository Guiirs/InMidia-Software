import { FilterQuery } from 'mongoose';
import AuditLog from './audit.model';
import type { AuditLogDocument, AuditQuery, RecordAuditEventInput } from './audit.types';

export class AuditRepository {
  async create(input: RecordAuditEventInput): Promise<AuditLogDocument> {
    return AuditLog.create({
      empresaId: input.empresaId || undefined,
      actorUserId: input.actor?.userId || undefined,
      actorName: input.actor?.name || undefined,
      actorEmail: input.actor?.email || undefined,
      actorRole: input.actor?.role || undefined,
      action: input.action,
      module: input.module,
      entityType: input.entityType || undefined,
      entityId: input.entityId || undefined,
      entityLabel: input.entityLabel || undefined,
      before: input.before,
      after: input.after,
      metadata: input.metadata,
      severity: input.severity || 'info',
      correlationId: input.correlationId || undefined,
      ip: input.ip || undefined,
      userAgent: input.userAgent || undefined,
    });
  }

  async find(query: AuditQuery): Promise<{ data: AuditLogDocument[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const filter = this.buildFilter(query);

    const [data, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return { data: data as AuditLogDocument[], total, page, limit };
  }

  async findById(id: string, query: Pick<AuditQuery, 'empresaId' | 'isSuperadmin'>): Promise<AuditLogDocument | null> {
    const filter: FilterQuery<AuditLogDocument> = { _id: id };
    if (!query.isSuperadmin) filter.empresaId = query.empresaId;
    return AuditLog.findOne(filter).lean() as Promise<AuditLogDocument | null>;
  }

  async findByEntity(entityType: string, entityId: string, query: AuditQuery) {
    return this.find({ ...query, entityType, entityId });
  }

  private buildFilter(query: AuditQuery): FilterQuery<AuditLogDocument> {
    const filter: FilterQuery<AuditLogDocument> = {};
    if (!query.isSuperadmin) filter.empresaId = query.empresaId;
    if (query.module) filter.module = query.module;
    if (query.action) filter.action = query.action;
    if (query.actorUserId) filter.actorUserId = query.actorUserId;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.severity) filter.severity = query.severity;
    if (query.since || query.until) {
      filter.createdAt = {};
      if (query.since) filter.createdAt.$gte = new Date(query.since);
      if (query.until) filter.createdAt.$lte = new Date(query.until);
    }
    return filter;
  }
}
