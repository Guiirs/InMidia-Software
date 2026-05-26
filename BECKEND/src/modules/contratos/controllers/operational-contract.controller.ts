import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { OperationalContractService } from '../services/operational-contract.service';
import { eventBus } from '@modules/realtime/event-bus.service';
import { OPERATIONAL_EVENT_TYPES } from '@modules/realtime/domain-events';

export class OperationalContractController {
  constructor(private readonly service: OperationalContractService) {}

  private getCompanyId(req: Request & IAuthRequest, res: Response): string | null {
    if (!req.user?.empresaId) {
      res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado' });
      return null;
    }
    return String(req.user.empresaId);
  }

  private emitContractEvent(req: Request & IAuthRequest, type: string, contract: any, payload: Record<string, unknown> = {}): void {
    if (!req.user?.empresaId) return;
    eventBus.emitFromInput({
      type: type as any,
      category: 'contracts',
      companyId: String(req.user.empresaId),
      entityType: 'contract',
      entityId: String(contract?.id ?? contract?.realId ?? contract?._id ?? ''),
      severity: 'info',
      payload: {
        contract,
        ...payload,
      },
      metadata: {
        actorId: String(req.user.id ?? ''),
        source: 'operational-contract.controller',
      },
    });
  }

  private getParamId(req: Request, res: Response): string | null {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      res.status(400).json({ success: false, code: 'INVALID_ID', message: 'ID do contrato invalido.' });
      return null;
    }
    return id;
  }

  async getSummary(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;
      const summary = await this.service.getSummary(companyId);

      eventBus.emitFromInput({
        type: OPERATIONAL_EVENT_TYPES.SUMMARY_REFRESHED,
        category: 'operations',
        companyId,
        entityType: 'summary',
        entityId: 'contracts',
        severity: 'info',
        payload: {
          activeContracts: summary?.totals?.activeContracts ?? 0,
          expiring30Days: summary?.totals?.expiring30Days ?? 0,
        },
        metadata: {
          actorId: String(req.user?.id ?? ''),
          source: 'operational-contract.controller',
        },
      });

      if ((summary?.totals?.expiring30Days ?? 0) > 0) {
        eventBus.emitFromInput({
          type: OPERATIONAL_EVENT_TYPES.CONTRACT_EXPIRING,
          companyId,
          entityType: 'contract',
          entityId: 'expiring-window',
          severity: (summary?.totals?.expiring7Days ?? 0) > 0 ? 'critical' : 'warning',
          payload: {
            expiring7Days: summary?.totals?.expiring7Days ?? 0,
            expiring15Days: summary?.totals?.expiring15Days ?? 0,
            expiring30Days: summary?.totals?.expiring30Days ?? 0,
          },
          metadata: {
            actorId: String(req.user?.id ?? ''),
            source: 'operational-contract.controller',
          },
        });
      }

      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async listContracts(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const contracts = await this.service.listContracts(companyId, {
        boardId: typeof req.query.boardId === 'string' ? req.query.boardId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        limit: Number(req.query.limit ?? 200),
      });

      res.status(200).json({ success: true, data: contracts });
    } catch (error) {
      next(error);
    }
  }

  async getContractsByBoard(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const contracts = await this.service.listContracts(companyId, {
        boardId: typeof req.params.boardId === 'string' ? req.params.boardId : undefined,
        limit: 100,
      });

      res.status(200).json({ success: true, data: contracts });
    } catch (error) {
      next(error);
    }
  }

  async listActive(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const contracts = await this.service.listActiveContracts(companyId, Number(req.query.limit ?? 200));
      res.status(200).json({ success: true, data: contracts });
    } catch (error) {
      next(error);
    }
  }

  async listExpiring(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const contracts = await this.service.listExpiringContracts(
        companyId,
        Number(req.query.days ?? 30),
        Number(req.query.limit ?? 200),
      );
      res.status(200).json({ success: true, data: contracts });
    } catch (error) {
      next(error);
    }
  }

  async listTimeline(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const timeline = await this.service.listTimeline(companyId, Number(req.query.limit ?? 100));
      res.status(200).json({
        success: true,
        data: {
          timeline,
          total: timeline.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async createContract(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const contract = await this.service.createContract(companyId, req.body ?? {});
      this.emitContractEvent(req, OPERATIONAL_EVENT_TYPES.CONTRACT_CREATED, contract);
      res.status(201).json({ success: true, data: contract });
    } catch (error) {
      next(error);
    }
  }

  async updateContract(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const id = this.getParamId(req, res);
      if (!id) return;

      const contract = await this.service.updateContract(companyId, id, req.body ?? {});
      this.emitContractEvent(req, OPERATIONAL_EVENT_TYPES.CONTRACT_UPDATED, contract, {
        changedFields: Object.keys(req.body ?? {}),
      });
      res.status(200).json({ success: true, data: contract });
    } catch (error) {
      next(error);
    }
  }

  async changeStatus(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const id = this.getParamId(req, res);
      if (!id) return;

      const contract = await this.service.changeStatus(companyId, id, String(req.body?.status ?? ''));
      this.emitContractEvent(req, OPERATIONAL_EVENT_TYPES.CONTRACT_STATUS_CHANGED, contract, {
        status: req.body?.status,
      });
      res.status(200).json({ success: true, data: contract });
    } catch (error) {
      next(error);
    }
  }

  async cancelContract(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const id = this.getParamId(req, res);
      if (!id) return;

      const contract = await this.service.cancelContract(companyId, id, req.body?.reason);
      this.emitContractEvent(req, OPERATIONAL_EVENT_TYPES.CONTRACT_CANCELLED, contract, {
        status: 'cancelled',
        reason: req.body?.reason,
      });
      res.status(200).json({ success: true, data: contract });
    } catch (error) {
      next(error);
    }
  }

  async renewContract(req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = this.getCompanyId(req, res);
      if (!companyId) return;

      const id = this.getParamId(req, res);
      if (!id) return;

      const contract = await this.service.renewContract(companyId, id, req.body ?? {});
      this.emitContractEvent(req, OPERATIONAL_EVENT_TYPES.CONTRACT_RENEWED, contract);
      this.emitContractEvent(req, OPERATIONAL_EVENT_TYPES.CONTRACT_UPDATED, contract);
      res.status(200).json({ success: true, data: contract });
    } catch (error) {
      next(error);
    }
  }
}
