import { Request, Response, NextFunction } from 'express';
import AuditService from '@modules/audit/audit.service';
import logger from '@shared/container/logger';

export const auditMiddleware = (action: string, resource: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id; // Assuming auth middleware sets req.user
      if (userId) {
        const resourceId = req.params.id || req.body.id || 'unknown';
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        await AuditService.log(userId, action, resource, resourceId, undefined, req.body, ip);
      }
    } catch (error) {
      logger.error('Audit logging failed:', error);
      // Don't fail the request
    }
    next();
  };
};
