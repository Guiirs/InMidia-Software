import { Request, Response, NextFunction } from 'express';
import type { IAuthRequest } from '../../types/express.d';
import { DashboardV4Service } from './dashboard-v4.service';

type AuthReq = Request & IAuthRequest;

export class DashboardV4Controller {
  constructor(private readonly service: DashboardV4Service) {}

  private companyId(req: AuthReq, res: Response): string | null {
    const id = req.user?.empresaId;
    if (!id) {
      res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuário não autenticado.' });
      return null;
    }
    return String(id);
  }

  getKpis = async (req: AuthReq, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.companyId(req, res);
      if (!id) return;
      const data = await this.service.getKpis(id);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getOverview = async (req: AuthReq, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.companyId(req, res);
      if (!id) return;
      const data = await this.service.getOverview(id);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getActivity = async (req: AuthReq, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.companyId(req, res);
      if (!id) return;
      const data = await this.service.getActivity(id);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getPerformance = async (req: AuthReq, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.companyId(req, res);
      if (!id) return;
      const data = await this.service.getPerformance(id);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getAlertsSummary = async (req: AuthReq, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = this.companyId(req, res);
      if (!id) return;
      const data = await this.service.getAlertsSummary(id);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };
}
