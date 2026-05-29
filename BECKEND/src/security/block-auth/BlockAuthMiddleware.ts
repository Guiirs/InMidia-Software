import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { SecurityContext } from './types/blockAuth.types';
import { runBlockAuthPipeline } from './BlockAuthPipeline';
import { blockDecisionService } from './services/BlockDecisionService';
import { securityAuditService, SecurityAuditEvent } from './services/SecurityAuditService';
import { isExemptPath } from './config/blockAuthPolicy';
import logger from '@shared/container/logger';

function buildInitialContext(req: Request): SecurityContext {
  const requestId =
    (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

  const realIp =
    (req.headers['cf-connecting-ip'] as string | undefined)?.trim() ??
    req.ip ??
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    'unknown';

  return {
    requestId,
    realIp,
    userAgent: req.headers['user-agent'],
    origin: req.headers['origin'] as string | undefined,
    referer: req.headers['referer'] as string | undefined,
    riskScore: 0,
    decision: 'ALLOW',
  };
}

const REASON_TO_AUDIT_EVENT: Readonly<Record<string, SecurityAuditEvent>> = {
  SECURITY_SCAN:           'BLOCKED_SECURITY_SCAN',
  TENANT_MISMATCH:         'BLOCKED_TENANT_MISMATCH',
  API_KEY_QUERY_FORBIDDEN: 'BLOCKED_API_KEY',
  DIRECT_BACKEND_BLOCKED:  'BLOCKED_INVALID_TOKEN',
};

export async function blockAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (isExemptPath(req.path)) {
      return next();
    }

    const context = buildInitialContext(req);
    const result = await runBlockAuthPipeline(req, context);

    context.decision = result.decision;

    if (result.decision === 'BLOCK') {
      context.reason = result.reason;

      const auditEvent: SecurityAuditEvent =
        REASON_TO_AUDIT_EVENT[result.reason] ?? 'BLOCKED_INVALID_TOKEN';

      securityAuditService.log(auditEvent, context);

      req.securityContext = context;
      blockDecisionService.sendBlockedResponse(res, context);
      return;
    }

    if (context.systemContext) {
      securityAuditService.log('SECURITY_CONTEXT_SYSTEM', context);
    }

    req.securityContext = context;
    securityAuditService.log('ALLOWED_REQUEST', context);

    next();
  } catch (err) {
    // Fail open — a bug in the security pipeline must never block legitimate traffic
    logger.error('[BlockAuthMiddleware] Unexpected error in security pipeline', { err });
    next();
  }
}
