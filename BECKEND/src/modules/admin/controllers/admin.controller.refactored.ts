import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service.refactored';
import { GetDashboardStatsSchema, BulkOperationSchema, ClearCacheSchema } from '../dtos/admin.dto';
import { z } from 'zod';

/**
 * Controller para operações administrativas
 */
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /api/admin/dashboard
   * Obter estatísticas do dashboard
   */
  getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = GetDashboardStatsSchema.parse(req.query);

      const result = await this.adminService.getDashboardStats(query);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Erro de validação',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/admin/bulk-operation
   * Executar operação em lote
   */
  bulkOperation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = BulkOperationSchema.parse(req.body);

      const result = await this.adminService.bulkOperation(validatedData);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
        message: `Operação executada: ${result.value.succeeded} sucesso, ${result.value.failed} falhas`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Erro de validação',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/admin/cache/clear
   * Limpar cache
   */
  clearCache = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = ClearCacheSchema.parse(req.body);

      const result = await this.adminService.clearCache(validatedData);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
        message: result.value.cleared === -1 
          ? 'Todo o cache foi limpo' 
          : `${result.value.cleared} chaves removidas`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Erro de validação',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
        return;
      }
      next(error);
    }
  };

  /**
   * GET /api/admin/system-info
   * Obter informações do sistema
   */
  getSystemInfo = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.adminService.getSystemInfo();

      if (result.isFailure) {
        res.status(500).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  };
}
