import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { ActivityV4Service } from '../services/activity-v4.service';
import { emitV4MutationEvent } from '@modules/realtime/v4-mutation-events';

export class ActivityV4Controller {
  constructor(private readonly service: ActivityV4Service) {}

  private getCompanyId(req: Request & IAuthRequest, res: Response): string | null {
    const id = req.user?.empresaId;
    if (!id) {
      res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuário não autenticado.' });
      return null;
    }
    return String(id);
  }

  private emit(req: Request & IAuthRequest, event: string, entityId: string): void {
    const tenantId = req.user?.empresaId ? String(req.user.empresaId) : '';
    if (!tenantId) return;
    emitV4MutationEvent({
      tenantId,
      event,
      entityId,
      entityType: 'activity',
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

  getFeed = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getFeed(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getAudit = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getAudit(companyId);
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

  createAuditEntry = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const entry = await this.service.createAuditEntry(companyId, {
        ...req.body,
        actorId: req.user?.id ? String(req.user.id) : req.body.actorId,
      });
      this.emit(req, 'activity.audit.created', String(entry.id));
      res.status(201).json({ success: true, data: { entry } });
    } catch (err) { next(err); }
  };
}
