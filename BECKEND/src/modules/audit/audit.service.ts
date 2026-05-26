import { randomUUID } from 'crypto';
import logger from '@shared/container/logger';
import { AuditRepository } from './audit.repository';
import { redactAuditValue } from './audit.redactor';
import type { AuditQuery, RecordAuditEventInput } from './audit.types';

export class AuditService {
  constructor(private readonly repository = new AuditRepository()) {}

  async recordAuditEvent(input: RecordAuditEventInput) {
    try {
      return await this.repository.create({
        ...input,
        before: redactAuditValue(input.before),
        after: redactAuditValue(input.after),
        metadata: redactAuditValue(input.metadata) as Record<string, unknown>,
        correlationId: input.correlationId || randomUUID(),
      });
    } catch (error) {
      logger.warn('[AuditService] Falha ao registrar evento de auditoria', {
        error: error instanceof Error ? error.message : String(error),
        action: input.action,
        module: input.module,
      });
      return null;
    }
  }

  recordEntityCreated(input: Omit<RecordAuditEventInput, 'action' | 'severity'>) {
    return this.recordAuditEvent({ ...input, action: 'entity.created', severity: 'info' });
  }

  recordEntityUpdated(input: Omit<RecordAuditEventInput, 'action' | 'severity'>) {
    return this.recordAuditEvent({ ...input, action: 'entity.updated', severity: 'info' });
  }

  recordEntityDeleted(input: Omit<RecordAuditEventInput, 'action' | 'severity'>) {
    return this.recordAuditEvent({ ...input, action: 'entity.deleted', severity: 'warning' });
  }

  recordPermissionDenied(input: Omit<RecordAuditEventInput, 'action' | 'severity'>) {
    return this.recordAuditEvent({ ...input, action: 'permission.denied', severity: 'warning' });
  }

  recordSensitiveAccess(input: Omit<RecordAuditEventInput, 'action' | 'severity'>) {
    return this.recordAuditEvent({ ...input, action: 'sensitive.access', severity: 'warning' });
  }

  find(query: AuditQuery) {
    return this.repository.find(query);
  }

  findById(id: string, query: Pick<AuditQuery, 'empresaId' | 'isSuperadmin'>) {
    return this.repository.findById(id, query);
  }

  findByEntity(entityType: string, entityId: string, query: AuditQuery) {
    return this.repository.findByEntity(entityType, entityId, query);
  }

  static async log(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    before?: unknown,
    after?: unknown,
    ip?: string
  ) {
    return defaultAuditService.recordAuditEvent({
      actor: { userId },
      action,
      module: resource,
      entityType: resource,
      entityId: resourceId,
      before,
      after,
      ip,
    });
  }
}

export const defaultAuditService = new AuditService();
export default AuditService;
