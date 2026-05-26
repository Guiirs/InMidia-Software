import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { AlertsV4Service } from '../services/alerts-v4.service';
import { emitV4MutationEvent } from '@modules/realtime/v4-mutation-events';

export class AlertsV4Controller {
  constructor(private readonly service: AlertsV4Service) {}

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
      entityType: 'alerts.alert',
      actorId: req.user?.id ? String(req.user.id) : undefined,
    });
  }

  listAlerts = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listAlerts(companyId);
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

  getCritical = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getCritical(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getUnread = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getUnread(companyId);
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

  markRead = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const alert = await this.service.markRead(companyId, String(req.params.id ?? ''));
      this.emit(req, 'alerts.read', String(alert.id));
      this.emit(req, 'alerts.updated', String(alert.id));
      res.status(200).json({ success: true, data: { alert } });
    } catch (err) { next(err); }
  };

  markAllRead = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.markAllRead(companyId);
      this.emit(req, 'alerts.read', 'all');
      this.emit(req, 'alerts.updated', 'all');
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  dismiss = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const alert = await this.service.dismiss(companyId, String(req.params.id ?? ''));
      this.emit(req, 'alerts.dismissed', String(alert.id));
      this.emit(req, 'alerts.updated', String(alert.id));
      res.status(200).json({ success: true, data: { alert } });
    } catch (err) { next(err); }
  };

  resolve = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const alert = await this.service.resolve(companyId, String(req.params.id ?? ''), req.body?.resolution);
      this.emit(req, 'alerts.resolved', String(alert.id));
      this.emit(req, 'alerts.updated', String(alert.id));
      res.status(200).json({ success: true, data: { alert } });
    } catch (err) { next(err); }
  };

  createManual = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const alert = await this.service.createManual(companyId, req.body ?? {});
      this.emit(req, 'alerts.created', String(alert.id));
      res.status(201).json({ success: true, data: { alert } });
    } catch (err) { next(err); }
  };
}
