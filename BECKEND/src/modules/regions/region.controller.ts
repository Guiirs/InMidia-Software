import { NextFunction, Response } from 'express';
import { requireEmpresaId } from '@shared/infra/http/tenant/tenant-context';
import type { Request } from 'express';
import type { IAuthRequest } from '../../types/express';
import { regionService } from './region.service';

type AuthReq = Request & IAuthRequest;

function userId(req: AuthReq): string | undefined {
  return req.user?.id;
}

function paramString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export class RegionController {
  async createRegion(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.createRegion({ ...req.body, empresaId: requireEmpresaId(req), createdBy: userId(req), updatedBy: userId(req) });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateRegion(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.updateRegion(paramString(req.params.id), { ...req.body, empresaId: requireEmpresaId(req), updatedBy: userId(req) });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async archiveRegion(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.archiveRegion(paramString(req.params.id), requireEmpresaId(req), userId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRegionById(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.getRegionById(paramString(req.params.id), requireEmpresaId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listRegions(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.listRegions({
        empresaId: requireEmpresaId(req),
        status: typeof req.query.status === 'string' ? req.query.status as any : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRegionSummary(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.getRegionSummary(paramString(req.params.id), requireEmpresaId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRegionPlates(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.getRegionPlates(paramString(req.params.id), requireEmpresaId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRegionOperations(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.getRegionOperations(paramString(req.params.id), requireEmpresaId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRegionAlerts(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.getRegionAlerts(paramString(req.params.id), requireEmpresaId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async attachPlate(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.attachPlateToRegion(req.body.plateId, paramString(req.params.id), requireEmpresaId(req), req.body.regionalLot ?? req.body.loteRegional);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async detachPlate(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.detachPlateFromRegion(req.body.plateId, requireEmpresaId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async migrateLegacy(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await regionService.migrateLegacyPlateRegions(requireEmpresaId(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const regionController = new RegionController();
