import { Request, Response } from 'express';
import { getErrorStatusCode, Log } from '@shared/core';
import AppError from '@shared/container/AppError';
import { requireEmpresaId } from '@shared/infra/http/tenant/tenant-context';
import type { DashboardService } from './dashboard.service';

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  private getEmpresaId(req: Request): string | null {
    try {
      return requireEmpresaId(req);
    } catch {
      return null;
    }
  }

  private unauthorized(res: Response): void {
    res.status(403).json({
      success: false,
      error: 'empresaId ausente no contexto do tenant',
      code: 'TENANT_REQUIRED',
    });
  }

  private handleFailure(res: Response, error: any): void {
    const statusCode = error instanceof AppError ? error.statusCode : getErrorStatusCode(error);
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }

  getOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = this.getEmpresaId(req);
      if (!empresaId) return this.unauthorized(res);

      const result = await this.service.getOverview(empresaId);
      if (result.isFailure) return this.handleFailure(res, result.error);

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      Log.error('[DashboardController] Erro no overview', { error });
      res.status(500).json({ success: false, error: 'Erro interno no dashboard', code: 'INTERNAL_ERROR' });
    }
  };

  getMostRentedBoards = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = this.getEmpresaId(req);
      if (!empresaId) return this.unauthorized(res);

      const result = await this.service.getMostRentedBoards(empresaId);
      if (result.isFailure) return this.handleFailure(res, result.error);

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      Log.error('[DashboardController] Erro em placas mais alugadas', { error });
      res.status(500).json({ success: false, error: 'Erro interno no dashboard', code: 'INTERNAL_ERROR' });
    }
  };

  getIdleBoards = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = this.getEmpresaId(req);
      if (!empresaId) return this.unauthorized(res);

      const result = await this.service.getIdleBoards(empresaId);
      if (result.isFailure) return this.handleFailure(res, result.error);

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      Log.error('[DashboardController] Erro em placas paradas', { error });
      res.status(500).json({ success: false, error: 'Erro interno no dashboard', code: 'INTERNAL_ERROR' });
    }
  };

  getRegionPerformance = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = this.getEmpresaId(req);
      if (!empresaId) return this.unauthorized(res);

      const result = await this.service.getRegionPerformance(empresaId);
      if (result.isFailure) return this.handleFailure(res, result.error);

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      Log.error('[DashboardController] Erro em performance por região', { error });
      res.status(500).json({ success: false, error: 'Erro interno no dashboard', code: 'INTERNAL_ERROR' });
    }
  };

  getSalesFunnel = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = this.getEmpresaId(req);
      if (!empresaId) return this.unauthorized(res);

      const result = await this.service.getSalesFunnel(empresaId);
      if (result.isFailure) return this.handleFailure(res, result.error);

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      Log.error('[DashboardController] Erro em funil comercial', { error });
      res.status(500).json({ success: false, error: 'Erro interno no dashboard', code: 'INTERNAL_ERROR' });
    }
  };

  getAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = this.getEmpresaId(req);
      if (!empresaId) return this.unauthorized(res);

      const result = await this.service.getAlerts(empresaId);
      if (result.isFailure) return this.handleFailure(res, result.error);

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      Log.error('[DashboardController] Erro em alertas', { error });
      res.status(500).json({ success: false, error: 'Erro interno no dashboard', code: 'INTERNAL_ERROR' });
    }
  };
}
