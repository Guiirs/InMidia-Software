/**
 * Audit Controller
 * Endpoints HTTP para auditoria
 */

import { Request, Response } from 'express';

type Params = Record<string, string>;
import type { IAuditService } from '../services/audit.service';
import type { ListAuditLogsQuery } from '../dtos/audit.dto';

export class AuditController {
  constructor(private readonly service: IAuditService) {}

  /**
   * GET /api/audit/:id
   * Busca um log específico
   */
  getLogById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID é obrigatório',
        });
        return;
      }

      const result = await this.service.getLogById(id);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message,
        });
        return;
      }

      if (!result.value) {
        res.status(404).json({
          success: false,
          error: 'Log de auditoria não encontrado',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar log de auditoria',
      });
    }
  };

  /**
   * GET /api/audit
   * Lista logs com filtros
   */
  listLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as unknown as ListAuditLogsQuery;

      const result = await this.service.listLogs(query);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value.logs,
        pagination: result.value.pagination,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar logs de auditoria',
      });
    }
  };

  /**
   * GET /api/audit/resource/:resourceId
   * Busca logs de um resource específico
   */
  getLogsByResource = async (req: Request, res: Response): Promise<void> => {
    try {
      const { resourceId } = req.params as Params;

      if (!resourceId) {
        res.status(400).json({
          success: false,
          error: 'Resource ID é obrigatório',
        });
        return;
      }

      const result = await this.service.getLogsByResourceId(resourceId);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao buscar logs do resource',
      });
    }
  };
}
