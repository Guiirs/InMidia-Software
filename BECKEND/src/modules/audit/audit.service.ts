import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
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

const SYSTEM_ACTOR_SENTINELS = new Set(['system', 'unknown']);

function normalizeObjectIdOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed || SYSTEM_ACTOR_SENTINELS.has(trimmed.toLowerCase())) return null;
  return Types.ObjectId.isValid(trimmed) ? trimmed : trimmed;
}

function isSystemActor(input: RecordAuditEventInput): boolean {
  const actor = input.actor;
  return (
    actor?.type === 'system' ||
    actor?.type === 'service' ||
    SYSTEM_ACTOR_SENTINELS.has(String(actor?.userId || '').toLowerCase()) ||
    SYSTEM_ACTOR_SENTINELS.has(String(input.empresaId || '').toLowerCase())
  );
}

function normalizeAuditInput(input: RecordAuditEventInput): RecordAuditEventInput {
  const systemActor = isSystemActor(input);
  const actorType = input.actor?.type || (systemActor ? 'system' : 'user');
  const actorLabel =
    input.actor?.label ||
    (systemActor ? String(input.actor?.name || input.actor?.userId || 'system') : input.actor?.name || null);

  return {
    ...input,
    empresaId: normalizeObjectIdOrNull(input.empresaId),
    actor: {
      ...input.actor,
      type: actorType,
      label: actorLabel,
      userId: systemActor ? null : input.actor?.userId ?? null,
      name: systemActor && SYSTEM_ACTOR_SENTINELS.has(String(input.actor?.name || '').toLowerCase()) ? null : input.actor?.name,
      email: systemActor && SYSTEM_ACTOR_SENTINELS.has(String(input.actor?.email || '').toLowerCase()) ? null : input.actor?.email,
      role: systemActor && SYSTEM_ACTOR_SENTINELS.has(String(input.actor?.role || '').toLowerCase()) ? null : input.actor?.role,
    },
  };
}

export class AuditService {
  constructor(private readonly repository: AuditRepositoryLike = new AuditRepository()) {}

  async recordAuditEvent(input: RecordAuditEventInput) {
    const normalizedInput = normalizeAuditInput(input);
    try {
      return await this.repository.create({
        ...normalizedInput,
        before: redactAuditValue(normalizedInput.before),
        after: redactAuditValue(normalizedInput.after),
        metadata: redactAuditValue(normalizedInput.metadata) as Record<string, unknown>,
        correlationId: normalizedInput.correlationId || randomUUID(),
      });
    } catch (error) {
      const details = getAuditErrorDetails(error);
      const contextParts = [
        `code=${details.code}`,
        `reason=${details.reason}`,
        `eventType=${sanitizeLogText(normalizedInput.action)}`,
        `module=${sanitizeLogText(normalizedInput.module)}`,
        `actorType=${sanitizeLogText(normalizedInput.actor?.type || '-')}`,
        `userId=${sanitizeLogText(normalizedInput.actor?.userId || '-')}`,
        `empresaId=${sanitizeLogText(normalizedInput.empresaId || '-')}`,
        `rid=${sanitizeLogText(normalizedInput.correlationId || '-')}`,
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
