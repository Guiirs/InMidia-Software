import { Request } from 'express';
import type { RecordAuditEventInput } from './audit.types';

export function auditActorFromRequest(req: Request): RecordAuditEventInput['actor'] {
  return {
    userId: req.user?.id || null,
    name: req.user?.nome || req.user?.username || null,
    email: req.user?.email || null,
    role: req.permissionContext?.role || req.user?.role || null,
  };
}

export function auditRequestContext(req: Request) {
  return {
    empresaId: req.tenantContext?.empresaId || req.user?.empresaId || null,
    actor: auditActorFromRequest(req),
    correlationId: String(req.headers['x-correlation-id'] || req.headers['x-request-id'] || ''),
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}
