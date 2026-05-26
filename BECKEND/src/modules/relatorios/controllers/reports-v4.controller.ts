import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { ReportsV4Service } from '../services/reports-v4.service';
import { emitV4MutationEvent } from '@modules/realtime/v4-mutation-events';

export class ReportsV4Controller {
  constructor(private readonly service: ReportsV4Service) {}

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

  getSummary = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getSummary(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getAnalytics = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getAnalytics(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  listExports = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listExports(companyId);
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

  getByPeriod = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const { start, end } = req.query as { start?: string; end?: string };
      const data = await this.service.getByPeriod(companyId, { start, end });
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  createExport = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const exportRecord = await this.service.createExport(companyId, req.body ?? {});
      this.emit(req, 'reports.export.created', 'reports.export', String(exportRecord.id));
      res.status(201).json({ success: true, data: { export: exportRecord } });
    } catch (err) { next(err); }
  };

  cancelExport = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const exportRecord = await this.service.cancelExport(companyId, String(req.params.id ?? ''));
      this.emit(req, 'reports.export.cancelled', 'reports.export', String(exportRecord.id));
      res.status(200).json({ success: true, data: { export: exportRecord } });
    } catch (err) { next(err); }
  };

  createSchedule = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const schedule = await this.service.createSchedule(companyId, req.body ?? {});
      this.emit(req, 'reports.schedule.created', 'reports.schedule', String(schedule.id));
      res.status(201).json({ success: true, data: { schedule } });
    } catch (err) { next(err); }
  };

  updateSchedule = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const schedule = await this.service.updateSchedule(companyId, String(req.params.id ?? ''), req.body ?? {});
      this.emit(req, 'reports.schedule.updated', 'reports.schedule', String(schedule.id));
      res.status(200).json({ success: true, data: { schedule } });
    } catch (err) { next(err); }
  };

  deleteSchedule = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const scheduleId = String(req.params.id ?? '');
      const data = await this.service.deleteSchedule(companyId, scheduleId);
      this.emit(req, 'reports.schedule.deleted', 'reports.schedule', scheduleId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };
}
