import { Request, Response, NextFunction } from 'express';
import type { IAuthRequest } from '../../types/express';
import { temporalEngine } from './temporal.service';
import { temporalBackfillService } from './temporal-backfill.service';
import { temporalSchedulerService } from './temporal-scheduler.service';
import { temporalCronService } from './temporal-cron.service';

type AuthReq = Request & IAuthRequest;

function getEmpresaId(req: AuthReq): string {
  return String(req.user?.empresaId || '');
}

function paramString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export class TemporalController {
  async getPlateAvailability(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await temporalEngine.checkPlateAvailability(
        paramString(req.params.plateId),
        String(req.query.startDate || req.query.dataInicio || ''),
        String(req.query.endDate || req.query.dataFim || ''),
        { empresaId: getEmpresaId(req) },
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async checkAvailability(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const plateIds = Array.isArray(req.body.plateIds)
        ? req.body.plateIds
        : Array.isArray(req.body.placas)
          ? req.body.placas
          : [];

      const result = await temporalEngine.checkMultiplePlatesAvailability(
        plateIds.map(String),
        req.body.startDate || req.body.dataInicio,
        req.body.endDate || req.body.dataFim,
        { empresaId: getEmpresaId(req) },
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPlateStatus(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await temporalEngine.resolvePlateTemporalStatus(
        paramString(req.params.plateId),
        new Date(),
        getEmpresaId(req),
      );
      res.json({ success: true, data: { plateId: paramString(req.params.plateId), status } });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardSummary(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await temporalEngine.getTemporalDashboardSummary(getEmpresaId(req));
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async getConflicts(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const conflicts = await temporalEngine.getConflicts(getEmpresaId(req));
      res.json({ success: true, data: conflicts });
    } catch (error) {
      next(error);
    }
  }

  async runBackfill(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await temporalBackfillService.runBackfill({
        empresaId: getEmpresaId(req),
        createdBy: req.user?.id,
      });
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async getBackfillStatus(_req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await temporalSchedulerService.getTemporalIntegrityReport();
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async getIntegrityReport(_req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await temporalSchedulerService.getTemporalIntegrityReport();
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async runDailyMaintenance(_req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await temporalCronService.runNow('manual');
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getSchedulerStatus(_req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: temporalCronService.getStatus() });
    } catch (error) {
      next(error);
    }
  }
}
