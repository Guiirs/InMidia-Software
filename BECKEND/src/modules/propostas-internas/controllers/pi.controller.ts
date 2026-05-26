import { Request, Response, NextFunction } from 'express';

type Params = Record<string, string>;
import { PIService } from '../services/pi.service';
import { CreatePISchema, UpdatePISchema, ListPIsQuerySchema } from '../dtos/pi.dto';
import { z } from 'zod';

/**
 * 🎯 POC - CONTROLLER LAYER
 * 
 * Responsabilidade: HTTP handling
 * - Validar entrada (Zod)
 * - Chamar service
 * - Formatar resposta
 * - Tratar erros
 */
export class PIController {
  constructor(private readonly piService: PIService) {}

  /**
   * POST /api/pis
   * Criar nova PI
   */
  createPI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. VALIDAÇÃO com Zod (automática e tipada!)
      const validatedData = CreatePISchema.parse(req.body);

      // 2. EXECUTAR lógica de negócio
      const result = await this.piService.createPI(validatedData);

      // 3. TRATAR resultado com Result Pattern
      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message,
          details: result.error.toJSON?.()
        });
        return;
      }

      // 4. RESPOSTA de sucesso
      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      // 5. ERROS de validação Zod
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

      // 6. OUTROS erros
      next(error);
    }
  };

  /**
   * GET /api/pis/:id
   * Buscar PI por ID
   */
  getPIById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.piService.getPIById(id);

      if (result.isFailure) {
        res.status(404).json({
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

  /**
   * GET /api/pis
   * Listar PIs com filtros e paginação
   */
  listPIs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validar query params
      const query = ListPIsQuerySchema.parse(req.query);

      const result = await this.piService.listPIs(query);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        ...result.value
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Parâmetros de consulta inválidos',
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
   * PUT /api/pis/:id
   * Atualizar PI
   */
  updatePI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const validatedData = UpdatePISchema.parse(req.body);

      const result = await this.piService.updatePI(id, validatedData);

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
   * DELETE /api/pis/:id
   * Deletar PI
   */
  deletePI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.piService.deletePI(id);

      if (result.isFailure) {
        res.status(404).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'PI deletada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/pis/cliente/:clienteId
   * Buscar PIs por cliente
   */
  getPIsByCliente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { clienteId } = req.params as Params;

      if (!clienteId) {
        res.status(400).json({ success: false, error: 'Cliente ID é obrigatório' });
        return;
      }

      const result = await this.piService.getPIsByCliente(clienteId);

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
      next(error);
    }
  };

  /**
   * POST /api/pis/:id/approve
   * Aprovar PI
   */
  approvePI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.piService.approvePI(id);

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
        message: 'PI aprovada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/pis/:id/reject
   * Rejeitar PI
   */
  rejectPI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const { reason } = req.body;

      const result = await this.piService.rejectPI(id, reason);

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
        message: 'PI rejeitada'
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * ============================================
 * 📋 COMPARAÇÃO: ANTES vs DEPOIS
 * ============================================
 * 
 * ANTES (código original):
 * ```javascript
 * exports.createPI = async (req, res) => {
 *   try {
 *     // Validação manual
 *     if (!req.body.clienteId) {
 *       return res.status(400).json({ error: 'Cliente obrigatório' });
 *     }
 *     // ... 30+ linhas de validações
 *     
 *     const pi = await piService.createPI(req.body);
 *     res.json(pi);
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * };
 * ```
 * 
 * DEPOIS (código refatorado):
 * ```typescript
 * createPI = async (req: Request, res: Response): Promise<void> => {
 *   const validatedData = CreatePISchema.parse(req.body); // ← Automático!
 *   const result = await this.piService.createPI(validatedData);
 *   
 *   if (result.isFailure) {
 *     res.status(400).json({ error: result.error.message });
 *     return;
 *   }
 *   
 *   res.status(201).json({ success: true, data: result.value });
 * };
 * ```
 * 
 * BENEFÍCIOS:
 * ✓ Validação automática com Zod
 * ✓ Tipos garantidos (TypeScript)
 * ✓ Erros consistentes (Result Pattern)
 * ✓ Menos código boilerplate
 * ✓ Mais legível e manutenível
 * ✓ Respostas padronizadas
 */
