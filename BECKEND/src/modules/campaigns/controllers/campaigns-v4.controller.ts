import { NextFunction, Request, Response } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { emitV4MutationEvent } from '@modules/realtime/v4-mutation-events';
import { CampaignsV4Service } from '../services/campaigns-v4.service';

export class CampaignsV4Controller {
  constructor(private readonly service: CampaignsV4Service) {}

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

  listCampaigns = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listCampaigns(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getActive = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getActive(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getScheduled = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getScheduled(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getPerformance = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getPerformance(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  createCampaign = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const campaign = await this.service.createCampaign(companyId, req.body ?? {});
      this.emit(req, 'campaigns.created', 'campaign', String(campaign.id));
      res.status(201).json({ success: true, data: { campaign } });
    } catch (err) { next(err); }
  };

  updateCampaign = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const campaign = await this.service.updateCampaign(companyId, String(req.params.id ?? ''), req.body ?? {});
      this.emit(req, 'campaigns.updated', 'campaign', String(campaign.id));
      res.status(200).json({ success: true, data: { campaign } });
    } catch (err) { next(err); }
  };

  pauseCampaign = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const campaign = await this.service.pauseCampaign(companyId, String(req.params.id ?? ''));
      this.emit(req, 'campaigns.paused', 'campaign', String(campaign.id));
      res.status(200).json({ success: true, data: { campaign } });
    } catch (err) { next(err); }
  };

  activateCampaign = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const campaign = await this.service.activateCampaign(companyId, String(req.params.id ?? ''));
      this.emit(req, 'campaigns.activated', 'campaign', String(campaign.id));
      res.status(200).json({ success: true, data: { campaign } });
    } catch (err) { next(err); }
  };

  deleteCampaign = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const result = await this.service.deleteCampaign(companyId, String(req.params.id ?? ''));
      this.emit(req, 'campaigns.deleted', 'campaign', String(req.params.id ?? ''));
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  };
}
