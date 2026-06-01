import { Request, Response, NextFunction } from 'express';
import type { IAuthRequest } from '../../types/express';
import { commercialProjectionService } from './commercial-projection.service';
import type { CommercialProjectionDTO } from './commercial-projection.types';

type AuthReq = Request & IAuthRequest;

function getEmpresaId(req: AuthReq): string {
  return String(req.user?.empresaId || '');
}

export class CommercialProjectionController {
  /**
   * GET /api/v4/commercial-projection/:placaId
   *
   * Returns the canonical CommercialProjection for a single plate.
   * Internal-only; not exposed in the Public API.
   */
  async getByPlate(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const empresaId = getEmpresaId(req);
      const placaId = String(req.params.placaId || '');

      const projection = await commercialProjectionService.resolve(placaId, empresaId);

      const dto: CommercialProjectionDTO = {
        placaId: projection.placaId,
        empresaId: projection.empresaId,
        commercialStatus: projection.commercialStatus,
        activeContract: projection.activeContract,
        reservation: projection.reservation,
        pricing: projection.pricing,
        resolvedAt: projection.resolvedAt,
      };

      res.json({ success: true, data: dto });
    } catch (error) {
      next(error);
    }
  }
}
