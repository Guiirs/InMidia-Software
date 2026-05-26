// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
import { Request, Response, NextFunction } from 'express';
import { PublicApiService } from '../services/public-api.service.refactored';
import { RegisterPlacaSchema } from '../dtos/public-api.dto';
import { z } from 'zod';

/**
 * Controller para Public API
 */
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  /**
   * GET /api/public/placas/:placa
   * Buscar informações de uma placa
   */
  getPlacaInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { placa } = req.params;
      const apiKey = req.headers['x-api-key'] as string;

      if (!placa) {
        res.status(400).json({ success: false, error: 'Placa é obrigatória' });
        return;
      }

      if (!apiKey) {
        res.status(401).json({ success: false, error: 'API key é obrigatória' });
        return;
      }

      const result = await this.publicApiService.getPlacaInfo(placa, apiKey);

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
   * POST /api/public/placas
   * Registrar nova placa
   */
  registerPlaca = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        res.status(401).json({ success: false, error: 'API key é obrigatória' });
        return;
      }

      const validatedData = RegisterPlacaSchema.parse(req.body);

      const result = await this.publicApiService.registerPlaca(validatedData, apiKey);

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
   * GET /api/public/placas/:placa/disponibilidade
   * Verificar disponibilidade de uma placa
   */
  checkAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { placa } = req.params;
      const apiKey = req.headers['x-api-key'] as string;

      if (!placa) {
        res.status(400).json({ success: false, error: 'Placa é obrigatória' });
        return;
      }

      if (!apiKey) {
        res.status(401).json({ success: false, error: 'API key é obrigatória' });
        return;
      }

      const result = await this.publicApiService.checkAvailability(placa, apiKey);

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
      next(error);
    }
  };

  /**
   * POST /api/public/validate-key
   * Validar API key
   */
  validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        res.status(401).json({ success: false, error: 'API key é obrigatória' });
        return;
      }

      const result = await this.publicApiService.validateApiKey(apiKey);

      if (result.isFailure) {
        res.status(500).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        valid: result.value
      });
    } catch (error) {
      next(error);
    }
  };
}
