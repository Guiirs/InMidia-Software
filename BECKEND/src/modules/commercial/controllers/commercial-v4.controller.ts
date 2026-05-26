import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { CommercialV4Service } from '../services/commercial-v4.service';
import { emitV4MutationEvent } from '@modules/realtime/v4-mutation-events';

export class CommercialV4Controller {
  constructor(private readonly service: CommercialV4Service) {}

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

  getPipeline = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getPipeline(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  listOpportunities = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listOpportunities(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  listProposals = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listProposals(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  getConversions = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.getConversions(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  listActivities = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listActivities(companyId);
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  createOpportunity = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const opportunity = await this.service.createOpportunity(companyId, req.body ?? {});
      this.emit(req, 'commercial.opportunity.created', 'commercial.opportunity', String(opportunity.id));
      res.status(201).json({ success: true, data: { opportunity } });
    } catch (err) { next(err); }
  };

  updateOpportunity = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const opportunity = await this.service.updateOpportunity(companyId, String(req.params.id ?? ''), req.body ?? {});
      this.emit(req, 'commercial.opportunity.updated', 'commercial.opportunity', String(opportunity.id));
      res.status(200).json({ success: true, data: { opportunity } });
    } catch (err) { next(err); }
  };

  changeOpportunityStage = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const opportunity = await this.service.changeOpportunityStage(companyId, String(req.params.id ?? ''), String(req.body?.stage ?? ''));
      this.emit(req, 'commercial.opportunity.stage.changed', 'commercial.opportunity', String(opportunity.id));
      res.status(200).json({ success: true, data: { opportunity } });
    } catch (err) { next(err); }
  };

  createProposal = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const proposal = await this.service.createProposal(companyId, req.body ?? {});
      this.emit(req, 'commercial.proposal.created', 'commercial.proposal', String(proposal.id));
      res.status(201).json({ success: true, data: { proposal } });
    } catch (err) { next(err); }
  };

  updateProposal = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const proposal = await this.service.updateProposal(companyId, String(req.params.id ?? ''), req.body ?? {});
      this.emit(req, 'commercial.proposal.updated', 'commercial.proposal', String(proposal.id));
      res.status(200).json({ success: true, data: { proposal } });
    } catch (err) { next(err); }
  };

  convertProposal = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.convertProposal(companyId, String(req.params.id ?? ''), req.body ?? {});
      this.emit(req, 'commercial.proposal.converted', 'commercial.proposal', String(data.proposal.id));
      res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
  };

  createActivity = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const activity = await this.service.createActivity(companyId, req.body ?? {});
      this.emit(req, 'commercial.activity.created', 'commercial.activity', String(activity.id));
      res.status(201).json({ success: true, data: { activity } });
    } catch (err) { next(err); }
  };
}
