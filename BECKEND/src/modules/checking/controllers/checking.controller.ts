/**
 * Checking Controller (Refatorado)
 * Endpoints HTTP para checkings/vistorias
 */

import { Request, Response } from 'express';

type Params = Record<string, string>;
import type { ICheckingService } from '../services/checking.service';
import { CreateCheckingSchema, UpdateCheckingSchema, ListCheckingsQuerySchema } from '../dtos/checking.dto';
import { ZodError } from 'zod';

export class CheckingController {
  constructor(private readonly service: ICheckingService) {}

  /**
   * POST /api/checkings
   * Cria um novo checking
   */
  createChecking = async (req: Request, res: Response): Promise<void> => {
    try {
      const validated = CreateCheckingSchema.parse(req.body);

      const result = await this.service.createChecking(validated);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message,
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.value,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          errors: error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar checking',
      });
    }
  };

  /**
   * GET /api/checkings/:id
   * Busca checking por ID
   */
  getCheckingById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID é obrigatório',
        });
        return;
      }

      const result = await this.service.getCheckingById(id);

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
          error: 'Checking não encontrado',
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
        error: error.message || 'Erro ao buscar checking',
      });
    }
  };

  /**
   * PATCH /api/checkings/:id
   * Atualiza checking
   */
  updateChecking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as Params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID é obrigatório',
        });
        return;
      }

      const validated = UpdateCheckingSchema.parse(req.body);

      const result = await this.service.updateChecking(id, validated);

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
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          errors: error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao atualizar checking',
      });
    }
  };

  /**
   * GET /api/checkings
   * Lista checkings com filtros
   */
  listCheckings = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = ListCheckingsQuerySchema.parse(req.query);

      const result = await this.service.listCheckings(query);

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
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          errors: error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar checkings',
      });
    }
  };

  /**
   * GET /api/checkings/aluguel/:aluguelId
   * Busca checkings por aluguel
   */
  getCheckingsByAluguel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { aluguelId } = req.params as Params;

      if (!aluguelId) {
        res.status(400).json({
          success: false,
          error: 'Aluguel ID é obrigatório',
        });
        return;
      }

      const result = await this.service.getCheckingsByAluguel(aluguelId);

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
        error: error.message || 'Erro ao buscar checkings por aluguel',
      });
    }
  };
}
