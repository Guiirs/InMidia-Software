export * from './audit.types';
export * from './audit.service';
export * from './audit.helpers';
import { defaultAuditService } from './audit.service';

export const auditService = {
  log(data: any) {
    return defaultAuditService.recordAuditEvent({
      actor: { userId: data.userId },
      action: data.action,
      module: data.resource,
      entityType: data.resource,
      entityId: data.resourceId,
      before: data.oldData,
      after: data.newData,
      metadata: data.metadata,
      ip: data.ip,
    });
  },
};
