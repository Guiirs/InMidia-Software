// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
import { Request, Response, NextFunction } from 'express';
import { BiWeekService } from '../services/biweek.service.refactored';
import { CreateBiWeekSchema, UpdateBiWeekSchema, ListBiWeeksQuerySchema, GenerateBiWeeksSchema } from '../dtos/biweek.dto';
import { z } from 'zod';

/**
 * Controller para BiWeeks
 */
export class BiWeekController {
  constructor(private readonly biweekService: BiWeekService) {}

  /**
   * POST /api/biweeks
   * Criar BiWeek
   */
  createBiWeek = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = CreateBiWeekSchema.parse(req.body);

      const result = await this.biweekService.createBiWeek(validatedData);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(201).json({
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
   * GET /api/biweeks/:id
   * Buscar BiWeek por ID
   */
  getBiWeekById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.biweekService.getBiWeekById(id);

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
   * GET /api/biweeks
   * Listar BiWeeks
   */
  listBiWeeks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ListBiWeeksQuerySchema.parse(req.query);

      const result = await this.biweekService.listBiWeeks(query);

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
   * PUT /api/biweeks/:id
   * Atualizar BiWeek
   */
  updateBiWeek = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const validatedData = UpdateBiWeekSchema.parse(req.body);

      const result = await this.biweekService.updateBiWeek(id, validatedData);

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
   * DELETE /api/biweeks/:id
   * Deletar BiWeek
   */
  deleteBiWeek = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.biweekService.deleteBiWeek(id);

      if (result.isFailure) {
        res.status(404).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'BiWeek deletada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/biweeks/generate
   * Gerar BiWeeks automaticamente para um ano
   */
  generateBiWeeks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = GenerateBiWeeksSchema.parse(req.body);

      const result = await this.biweekService.generateBiWeeks(validatedData);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.value,
        message: `${result.value.created} BiWeeks criadas, ${result.value.skipped} já existiam`
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
}
