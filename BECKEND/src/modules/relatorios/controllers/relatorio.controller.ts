/**
 * Relatorio Controller
 * Camada HTTP para relatórios
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { RelatorioService } from '../services/relatorio.service';
import { requireEmpresaId } from '@shared/infra/http/tenant/tenant-context';

export class RelatorioController {
  
  constructor(private readonly service: RelatorioService) {}

  /**
   * GET /relatorios/dashboard-summary
   * Busca resumo para dashboard
   */
  getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = requireEmpresaId(req);
      const result = await this.service.getDashboardSummary(empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[RelatorioController] Erro ao buscar dashboard summary', { error });
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        error: (error as any)?.message || 'Erro interno ao buscar resumo',
        code: (error as any)?.code || 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /relatorios/placas-por-regiao
   * Busca placas agrupadas por região
   */
  getPlacasPorRegiao = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = requireEmpresaId(req);
      const result = await this.service.getPlacasPorRegiao(empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[RelatorioController] Erro ao buscar placas por região', { error });
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        error: (error as any)?.message || 'Erro interno ao buscar placas',
        code: (error as any)?.code || 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /relatorios/ocupacao-por-periodo
   * Calcula ocupação por período
   */
  getOcupacaoPorPeriodo = async (req: Request, res: Response): Promise<void> => {
    try {
      const empresaId = requireEmpresaId(req);
      const result = await this.service.getOcupacaoPorPeriodo(
        empresaId,
        req.query as any
      );

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[RelatorioController] Erro ao calcular ocupação', { error });
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json({
        success: false,
        error: (error as any)?.message || 'Erro interno ao calcular ocupação',
        code: (error as any)?.code || 'INTERNAL_ERROR'
      });
    }
  };
}
