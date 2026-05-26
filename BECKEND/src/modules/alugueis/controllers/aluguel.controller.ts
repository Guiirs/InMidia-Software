/**
 * Aluguel Controller
 * Camada HTTP com Result pattern e cache
 */

import { Request, Response } from 'express';

type Params = Record<string, string>;
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { AluguelService } from '../services/aluguel.service';
import type { IAuthRequest } from '../../../types/express';
import { eventBus } from '@modules/realtime/event-bus.service';
import { OPERATIONAL_EVENT_TYPES } from '@modules/realtime/domain-events';

export class AluguelController {
  
  constructor(private readonly service: AluguelService) {}

  /**
   * POST /alugueis
   * Cria um novo aluguel
   */
  createAluguel = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.createAluguel(
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

      const userId = authReq.user?.id ? String(authReq.user.id) : undefined;
      eventBus.emitFromInput({
        type: OPERATIONAL_EVENT_TYPES.CONTRACT_CREATED,
        companyId: empresaId.toString(),
        entityType: 'contract',
        entityId: String((result.value as any)?._id ?? ''),
        severity: 'info',
        payload: {
          aluguelId: String((result.value as any)?._id ?? ''),
          placaId: String((result.value as any)?.placaId ?? ''),
          clienteId: String((result.value as any)?.clienteId ?? ''),
        },
        metadata: {
          actorId: userId,
          source: 'aluguel.controller',
        },
      });
      eventBus.emitFromInput({
        type: OPERATIONAL_EVENT_TYPES.SUMMARY_REFRESHED,
        category: 'operations',
        companyId: empresaId.toString(),
        entityType: 'summary',
        entityId: 'contracts',
        severity: 'info',
        payload: { reason: 'CONTRACT_CREATED' },
        metadata: { actorId: userId, source: 'aluguel.controller' },
      });

    } catch (error) {
      Log.error('[AluguelController] Erro ao criar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao criar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /alugueis
   * Lista aluguéis com filtros e paginação
   */
  listAlugueis = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.listAlugueis(
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
      Log.error('[AluguelController] Erro ao listar aluguéis', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao listar aluguéis',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /alugueis/placa/:placaId
   * Lista aluguÃ©is de uma placa especÃ­fica.
   *
   * Compatibilidade: este endpoint retorna array direto, como a rota legada.
   */
  getAlugueisByPlaca = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'UsuÃ¡rio nÃ£o autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const { placaId } = req.params as Params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa nÃ£o fornecido',
          code: 'INVALID_PLACA_ID'
        });
        return;
      }

      const result = await this.service.listAlugueis(
        empresaId.toString(),
        {
          placaId,
          page: 1,
          limit: 100,
          sortBy: 'startDate',
          order: 'desc'
        } as any
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

      res.status(200).json(result.value.data);

    } catch (error) {
      Log.error('[AluguelController] Erro ao listar aluguÃ©is por placa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao listar aluguÃ©is por placa',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /alugueis/:id
   * Busca aluguel por ID
   */
  getAluguelById = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.getAluguelById(
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

      const userId = authReq.user?.id ? String(authReq.user.id) : undefined;
      eventBus.emitFromInput({
        type: OPERATIONAL_EVENT_TYPES.CONTRACT_UPDATED,
        companyId: empresaId.toString(),
        entityType: 'contract',
        entityId: id,
        severity: req.body?.status === 'finalizado' ? 'warning' : 'info',
        payload: {
          aluguelId: id,
          changedFields: Object.keys(req.body || {}),
          status: req.body?.status,
        },
        metadata: {
          actorId: userId,
          source: 'aluguel.controller',
        },
      });

    } catch (error) {
      Log.error('[AluguelController] Erro ao buscar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * PATCH /alugueis/:id
   * Atualiza aluguel
   */
  updateAluguel = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.updateAluguel(
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
      Log.error('[AluguelController] Erro ao atualizar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * DELETE /alugueis/:id
   * Deleta aluguel
   */
  deleteAluguel = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.deleteAluguel(
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
        message: 'Aluguel deletado com sucesso'
      });

      const userId = authReq.user?.id ? String(authReq.user.id) : undefined;
      eventBus.emitFromInput({
        type: OPERATIONAL_EVENT_TYPES.CONTRACT_UPDATED,
        companyId: empresaId.toString(),
        entityType: 'contract',
        entityId: id,
        severity: 'warning',
        payload: {
          aluguelId: id,
          action: 'deleted',
        },
        metadata: {
          actorId: userId,
          source: 'aluguel.controller',
        },
      });

    } catch (error) {
      Log.error('[AluguelController] Erro ao deletar aluguel', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao deletar aluguel',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /alugueis/check-disponibilidade
   * Verifica disponibilidade de placa no período
   */
  checkDisponibilidade = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.checkDisponibilidade(
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
      Log.error('[AluguelController] Erro ao verificar disponibilidade', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao verificar disponibilidade',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}
