import { randomUUID } from 'crypto';
import logger from '@shared/container/logger';
import { AuditRepository } from './audit.repository';
import { redactAuditValue } from './audit.redactor';
import type { AuditLogDocument, AuditQuery, RecordAuditEventInput } from './audit.types';

interface AuditRepositoryLike {
  create(input: RecordAuditEventInput): Promise<AuditLogDocument>;
  find(query: AuditQuery): Promise<{ data: AuditLogDocument[]; total: number; page: number; limit: number }>;
  findById(id: string, query: Pick<AuditQuery, 'empresaId' | 'isSuperadmin'>): Promise<AuditLogDocument | null>;
  findByEntity(entityType: string, entityId: string, query: AuditQuery): Promise<{ data: AuditLogDocument[]; total: number; page: number; limit: number }>;
}

const SENSITIVE_LOG_PATTERNS = [
  /(password|senha|token|api[-_ ]?key|authorization|cookie|secret)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
];

function sanitizeLogText(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value ?? 'unknown');

  for (const pattern of SENSITIVE_LOG_PATTERNS) {
    text = text.replace(pattern, (match, key, separator) => {
      if (match.toLowerCase().startsWith('bearer ')) return 'Bearer [REDACTED]';
      return `${key}${separator}[REDACTED]`;
    });
  }

  return text.length > 240 ? `${text.slice(0, 240)}...[truncated]` : text;
}

function getErrorProperty(error: unknown, property: string): unknown {
  if (!error || typeof error !== 'object') return undefined;
  return (error as Record<string, unknown>)[property];
}

function getAuditErrorDetails(error: unknown): { code: string; reason: string; detail?: string } {
  const codeValue = getErrorProperty(error, 'code');
  const nameValue = getErrorProperty(error, 'name');
  const errorsValue = getErrorProperty(error, 'errors');
  const validationPaths =
    errorsValue && typeof errorsValue === 'object'
      ? Object.keys(errorsValue as Record<string, unknown>).slice(0, 10)
      : [];

  return {
    code: sanitizeLogText(codeValue || nameValue || 'UNKNOWN'),
    reason: sanitizeLogText(error),
    detail: validationPaths.length > 0 ? `validationPaths=${validationPaths.join(',')}` : undefined,
  };
}

export class AuditService {
  constructor(private readonly repository: AuditRepositoryLike = new AuditRepository()) {}

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
      const details = getAuditErrorDetails(error);
      const contextParts = [
        `code=${details.code}`,
        `reason=${details.reason}`,
        `eventType=${sanitizeLogText(input.action)}`,
        `module=${sanitizeLogText(input.module)}`,
        `userId=${sanitizeLogText(input.actor?.userId || '-')}`,
        `empresaId=${sanitizeLogText(input.empresaId || '-')}`,
        `rid=${sanitizeLogText(input.correlationId || '-')}`,
      ];
      if (details.detail) contextParts.push(details.detail);

      logger.warn(`[AuditService] Falha ao registrar evento de auditoria ${contextParts.join(' ')}`);
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
