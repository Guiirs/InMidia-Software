import { Request, Response, NextFunction } from 'express';
import { defaultAuditService } from './audit.service';
import { auditRequestContext } from './audit.helpers';
import type { AuditQuery, AuditSeverity } from './audit.types';

const isSuperadminRequest = (req: Request): boolean => req.permissionContext?.role === 'superadmin';

function buildAuditQuery(req: Request): AuditQuery {
  return {
    empresaId: req.tenantContext?.empresaId,
    isSuperadmin: isSuperadminRequest(req),
    module: typeof req.query.module === 'string' ? req.query.module : undefined,
    action: typeof req.query.action === 'string' ? req.query.action : undefined,
    actorUserId: typeof req.query.actorUserId === 'string' ? req.query.actorUserId : undefined,
    entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
    entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
    severity: typeof req.query.severity === 'string' ? req.query.severity as AuditSeverity : undefined,
    since: typeof req.query.since === 'string' ? req.query.since : undefined,
    until: typeof req.query.until === 'string' ? req.query.until : undefined,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    page: typeof req.query.page === 'string' ? Number(req.query.page) : undefined,
  };
}

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await defaultAuditService.find(buildAuditQuery(req));
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        totalDocs: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
        currentPage: result.page,
        limit: result.limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id || '');
    const log = await defaultAuditService.findById(id, {
      empresaId: req.tenantContext?.empresaId,
      isSuperadmin: isSuperadminRequest(req),
    });

    if (!log) {
      res.status(404).json({ success: false, error: 'Evento de auditoria nao encontrado' });
      return;
    }

    res.status(200).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogsByEntity(req: Request, res: Response, next: NextFunction) {
  try {
    const entityType = String(req.params.entityType || '');
    const entityId = String(req.params.entityId || '');
    const result = await defaultAuditService.findByEntity(
      entityType,
      entityId,
      buildAuditQuery(req)
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        totalDocs: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
        currentPage: result.page,
        limit: result.limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function auditSensitiveRead(moduleName: string, entityType?: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    defaultAuditService.recordSensitiveAccess({
      ...auditRequestContext(req),
      module: moduleName,
      entityType,
      metadata: { path: req.originalUrl, query: req.query },
    }).finally(() => next());
  };
}
