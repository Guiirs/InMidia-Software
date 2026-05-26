import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { OperationsV4Service } from '../services/operations-v4.service';
import { emitV4MutationEvent } from '@modules/realtime/v4-mutation-events';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';

export class OperationsV4Controller {
  constructor(private readonly service: OperationsV4Service) {}

  private getCompanyId(req: Request & IAuthRequest, res: Response): string | null {
    const id = req.user?.empresaId;
    if (!id) {
      res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuário não autenticado.' });
      return null;
    }
    return String(id);
  }

  private emit(req: Request & IAuthRequest, event: string, entityType: string, entityId: string): void {
    const tenantId = req.user?.empresaId ? String(req.user.empresaId) : '';
    if (!tenantId) return;
    emitV4MutationEvent({
      tenantId,
      event,
      entityId,
      entityType,
      actorId: req.user?.id ? String(req.user.id) : undefined,
    });
  }

  getTimeline = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getTimeline(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getSummary = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getSummary(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  listTasks = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listTasks(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getPendingTasks = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getPendingTasks(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getByDomain = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getByDomain(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getCanonicalizationReport = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getOperationCanonicalizationReport(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getLinkResolutionContext = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getLinkResolutionContext(companyId, String(req.params.operationId ?? ''));
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getLinkResolutionQueue = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getLinkResolutionQueue(companyId, req.query ?? {});
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  refreshCanonicalizationDiagnostics = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.refreshOperationCanonicalizationDiagnostics(companyId, req.body ?? {});
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  createTask = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const task = await this.service.createTask(companyId, req.body ?? {});
      this.emit(req, 'operations.task.created', 'operations.task', String(task.id));
      res.status(201).json({ success: true, data: { task } });
    } catch (err) { next(err); }
  };

  updateTask = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const task = await this.service.updateTask(companyId, String(req.params.id ?? ''), req.body ?? {});
      this.emit(req, 'operations.task.updated', 'operations.task', String(task.id));
      res.status(200).json({ success: true, data: { task } });
    } catch (err) { next(err); }
  };

  getById = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getById(companyId, String(req.params.id ?? ''));
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  listOperations = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listOperations(companyId, req.query ?? {});
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getByPlate = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getByPlate(companyId, String(req.params.plateId ?? ''));
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getByRegion = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getByRegion(companyId, String(req.params.regionId ?? ''));
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  startTask = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const input = { ...(req.body ?? {}), updatedBy: req.user?.id ? String(req.user.id) : null };
      const task = await this.service.startTask(companyId, String(req.params.id ?? ''), input);
      this.emit(req, 'operations.task.started', 'operations.task', String(task.id));
      res.status(200).json({ success: true, data: { task } });
    } catch (err) { next(err); }
  };

  completeTask = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const input = { ...(req.body ?? {}), updatedBy: req.user?.id ? String(req.user.id) : null };
      const task = await this.service.completeTask(companyId, String(req.params.id ?? ''), input);
      this.emit(req, 'operations.task.completed', 'operations.task', String(task.id));
      res.status(200).json({ success: true, data: { task } });
    } catch (err) { next(err); }
  };

  cancelTask = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const input = { ...(req.body ?? {}), updatedBy: req.user?.id ? String(req.user.id) : null };
      const task = await this.service.cancelTask(companyId, String(req.params.id ?? ''), input);
      this.emit(req, 'operations.task.cancelled', 'operations.task', String(task.id));
      res.status(200).json({ success: true, data: { task } });
    } catch (err) { next(err); }
  };

  assignTask = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const task = await this.service.assignTask(companyId, String(req.params.id ?? ''), String(req.body?.assigneeId ?? ''));
      this.emit(req, 'operations.task.assigned', 'operations.task', String(task.id));
      res.status(200).json({ success: true, data: { task } });
    } catch (err) { next(err); }
  };

  createEvent = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const event = await this.service.createEvent(companyId, req.body ?? {});
      this.emit(req, 'operations.event.created', 'operations.event', String(event.id));
      res.status(201).json({ success: true, data: { event } });
    } catch (err) { next(err); }
  };

  backfillPlateLinks = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const report = await this.service.backfillOperationPlateLinks(companyId);
      res.status(200).json({ success: true, data: report });
    } catch (err) { next(err); }
  };

  resolvePlateLink = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const result = await this.service.resolveOperationPlateLink(
        companyId,
        String(req.params.operationId ?? ''),
        String(req.body?.plateId ?? ''),
        { reason: req.body?.reason, resolvedBy: req.user?.id ? String(req.user.id) : null },
      );
      this.emit(req, 'operations.task.plate_link_resolved', 'operations.task', String(result.task.id));
      void defaultAuditService.recordAuditEvent({
        ...auditRequestContext(req),
        action: 'operation.plate_link.resolved',
        module: 'operations',
        entityType: 'operations.task',
        entityId: String(result.task.id),
        entityLabel: String(result.task.title ?? 'Tarefa operacional'),
        before: result.before,
        after: {
          operationId: result.task.id,
          plateId: result.task.plateId,
          regionId: result.task.regionId,
          regionalLot: result.task.regionalLot,
        },
        metadata: {
          reason: req.body?.reason ?? null,
          plate: result.plate,
          manualResolution: true,
        },
        severity: 'warning',
      });
      res.status(200).json({ success: true, data: { task: result.task } });
    } catch (err) { next(err); }
  };
}
