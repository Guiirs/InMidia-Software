import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { OperationTeamService } from './operation-team.service';
import { emitV4MutationEvent } from '@modules/realtime/v4-mutation-events';

export class OperationTeamController {
  constructor(private readonly service: OperationTeamService) {}

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
      entityType: 'operations.team',
      actorId: req.user?.id ? String(req.user.id) : undefined,
    });
  }

  list = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const data = await this.service.listTeams(companyId, {
        status: req.query?.status ? String(req.query.status) : undefined,
        search: req.query?.search ? String(req.query.search) : undefined,
      });
      res.status(200).json({ success: true, data: { teams: data } });
    } catch (err) { next(err); }
  };

  getById = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const team = await this.service.getById(companyId, String(req.params.id ?? ''));
      res.status(200).json({ success: true, data: { team } });
    } catch (err) { next(err); }
  };

  create = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const team = await this.service.createTeam(companyId, req.body ?? {});
      this.emit(req, 'operations.team.created', team.id);
      res.status(201).json({ success: true, data: { team } });
    } catch (err) { next(err); }
  };

  update = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const team = await this.service.updateTeam(companyId, String(req.params.id ?? ''), req.body ?? {});
      this.emit(req, 'operations.team.updated', team.id);
      res.status(200).json({ success: true, data: { team } });
    } catch (err) { next(err); }
  };

  archive = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const team = await this.service.archiveTeam(companyId, String(req.params.id ?? ''));
      this.emit(req, 'operations.team.archived', team.id);
      res.status(200).json({ success: true, data: { team } });
    } catch (err) { next(err); }
  };
}
