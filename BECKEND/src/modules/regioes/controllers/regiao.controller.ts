/**
 * Regiao Controller
 * Camada HTTP com Result pattern e cache
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { RegiaoService } from '../services/regiao.service';
import type { IAuthRequest } from '../../../types/express';

type Params = Record<string, string>;

export class RegiaoController {
  
  constructor(private readonly service: RegiaoService) {}

  /**
   * POST /regioes
   * Cria uma nova região
   */
  createRegiao = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.createRegiao(
        req.body,
        empresaId.toString()
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

      res.status(201).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[RegiaoController] Erro ao criar região', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao criar região',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /regioes
   * Lista regiões com filtros e paginação
   */
  listRegioes = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.listRegioes(
        empresaId.toString(),
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
        ...result.value
      });

    } catch (error) {
      Log.error('[RegiaoController] Erro ao listar regiões', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao listar regiões',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /regioes/:id
   * Busca região por ID
   */
  getRegiaoById = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID não fornecido',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await this.service.getRegiaoById(
        id,
        empresaId.toString()
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
      Log.error('[RegiaoController] Erro ao buscar região', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar região',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * PATCH /regioes/:id
   * Atualiza região
   */
  updateRegiao = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID não fornecido',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await this.service.updateRegiao(
        id,
        req.body,
        empresaId.toString()
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
      Log.error('[RegiaoController] Erro ao atualizar região', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar região',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * DELETE /regioes/:id
   * Deleta região
   */
  deleteRegiao = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID não fornecido',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await this.service.deleteRegiao(
        id,
        empresaId.toString()
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
        message: 'Região deletada com sucesso'
      });

    } catch (error) {
      Log.error('[RegiaoController] Erro ao deletar região', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao deletar região',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}
