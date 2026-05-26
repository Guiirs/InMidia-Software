import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import type { InventorySummaryService } from '../services/inventory-summary.service';
import { eventBus } from '@modules/realtime/event-bus.service';
import { OPERATIONAL_EVENT_TYPES } from '@modules/realtime/domain-events';

export class InventorySummaryController {
  constructor(private readonly service: InventorySummaryService) {}

  async getSummary(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user?.empresaId) {
        res.status(401).json({
          success: false,
          code: 'AUTH_REQUIRED',
          message: 'Usuário não autenticado',
        });
        return;
      }

      const summary = await this.service.getSummary(String(req.user.empresaId));

      eventBus.emitFromInput({
        type: OPERATIONAL_EVENT_TYPES.SUMMARY_REFRESHED,
        category: 'operations',
        companyId: String(req.user.empresaId),
        entityType: 'summary',
        entityId: 'inventory',
        severity: 'info',
        payload: {
          totalBoards: summary?.totals?.totalBoards ?? 0,
          occupiedBoards: summary?.totals?.occupiedBoards ?? 0,
          occupancyRate: summary?.occupancy?.rate ?? 0,
        },
        metadata: {
          actorId: String(req.user.id ?? ''),
          source: 'inventory-summary.controller',
        },
      });
      eventBus.emitFromInput({
        type: OPERATIONAL_EVENT_TYPES.REPORT_UPDATED,
        category: 'reports',
        companyId: String(req.user.empresaId),
        entityType: 'report',
        entityId: 'inventory-summary',
        severity: 'info',
        payload: {
          generatedAt: summary?.generatedAt,
        },
        metadata: {
          actorId: String(req.user.id ?? ''),
          source: 'inventory-summary.controller',
        },
      });

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
