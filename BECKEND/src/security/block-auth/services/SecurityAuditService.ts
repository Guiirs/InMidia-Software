import { SecurityContext } from '../types/blockAuth.types';
import logger from '@shared/container/logger';

export type SecurityAuditEvent =
  | 'BLOCKED_SECURITY_SCAN'
  | 'BLOCKED_INVALID_TOKEN'
  | 'BLOCKED_TENANT_MISMATCH'
  | 'BLOCKED_API_KEY'
  | 'ALLOWED_REQUEST'
  | 'SECURITY_CONTEXT_SYSTEM';

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function sanitizeContext(context: SecurityContext): Record<string, unknown> {
  return {
    requestId: context.requestId,
    realIp: context.realIp,
    cfRayId: context.cfRayId ?? null,
    country: context.country ?? null,
    authType: context.authType ?? null,
    userId: context.userId ?? null,
    empresaId: context.empresaId ?? null,
    systemContext: context.systemContext ?? null,
    riskScore: context.riskScore,
    decision: context.decision,
    reason: context.reason ?? null,
  };
}

export class SecurityAuditService {
  log(
    event: SecurityAuditEvent,
    context: SecurityContext,
    extras?: Record<string, unknown>
  ): void {
    try {
      const apiKeyRaw = extras?.['apiKey'];
      const maskedExtras =
        typeof apiKeyRaw === 'string'
          ? { ...extras, apiKey: maskApiKey(apiKeyRaw) }
          : extras;

      const payload = {
        event,
        ...sanitizeContext(context),
        ...(maskedExtras ?? {}),
      };

      if (context.decision === 'BLOCK') {
        logger.warn(`[SecurityAudit] ${event} ${JSON.stringify(payload)}`);
      } else {
        logger.debug(`[SecurityAudit] ${event} ${JSON.stringify(payload)}`);
      }
    } catch (err) {
      // Audit failures must never crash the request pipeline
      logger.error('[SecurityAudit] Failed to write audit event', { err });
    }
  }
}

export const securityAuditService = new SecurityAuditService();
