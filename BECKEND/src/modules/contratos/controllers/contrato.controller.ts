/**
 * Contrato Controller
 * Camada HTTP com Result pattern e cache
 */

import { Request, Response } from 'express';

type Params = Record<string, string>;
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { ContratoService } from '../services/contrato.service';
import type { IAuthRequest } from '../../../types/express';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';

export class ContratoController {
  
  constructor(private readonly service: ContratoService) {}

  /**
   * POST /contratos
   * Cria um novo contrato a partir de uma PI
   */
  createContrato = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.createContrato(
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

      void defaultAuditService.recordEntityCreated({
        ...auditRequestContext(req),
        module: 'contratos',
        entityType: 'contrato',
        entityId: String((result.value as any)._id || (result.value as any).id || ''),
        entityLabel: String((result.value as any).numero || (result.value as any).codigo || ''),
        after: result.value,
        metadata: { piId: req.body?.piId },
      });

      res.status(201).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[ContratoController] Erro ao criar contrato', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao criar contrato',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /contratos
   * Lista contratos com filtros e paginação
   */
  listContratos = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.listContratos(
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
      Log.error('[ContratoController] Erro ao listar contratos', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao listar contratos',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /contratos/:id
   * Busca contrato por ID
   */
  getContratoById = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.getContratoById(
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

      void defaultAuditService.recordAuditEvent({
        ...auditRequestContext(req),
        action: req.body?.status === 'ativo' ? 'contract.approved' : 'entity.updated',
        severity: 'info',
        module: 'contratos',
        entityType: 'contrato',
        entityId: String(id),
        entityLabel: String((result.value as any).numero || (result.value as any).codigo || ''),
        after: result.value,
        metadata: {
          changedFields: Object.keys(req.body || {}),
          status: req.body?.status,
        },
      });

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[ContratoController] Erro ao buscar contrato', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar contrato',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * PATCH /contratos/:id
   * Atualiza contrato
   */
  updateContrato = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.updateContrato(
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
      Log.error('[ContratoController] Erro ao atualizar contrato', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar contrato',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * DELETE /contratos/:id
   * Deleta contrato (apenas se status = 'rascunho')
   */
  deleteContrato = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.service.deleteContrato(
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

      void defaultAuditService.recordEntityDeleted({
        ...auditRequestContext(req),
        module: 'contratos',
        entityType: 'contrato',
        entityId: String(id),
      });

      res.status(200).json({
        success: true,
        message: 'Contrato deletado com sucesso'
      });

    } catch (error) {
      Log.error('[ContratoController] Erro ao deletar contrato', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao deletar contrato',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}
