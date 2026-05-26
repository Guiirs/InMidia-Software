// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
import { Request, Response, NextFunction } from 'express';
import { WebhookService } from '../services/webhook.service.refactored';
import { CreateWebhookSchema, UpdateWebhookSchema, ListWebhooksQuerySchema, ExecuteWebhookSchema } from '../dtos/webhook.dto';
import { z } from 'zod';

/**
 * Controller para Webhooks
 */
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * POST /api/webhooks
   * Criar webhook
   */
  createWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = CreateWebhookSchema.parse(req.body);

      const result = await this.webhookService.createWebhook(validatedData);

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
   * GET /api/webhooks/:id
   * Buscar webhook por ID
   */
  getWebhookById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.webhookService.getWebhookById(id);

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
   * GET /api/webhooks
   * Listar webhooks
   */
  listWebhooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ListWebhooksQuerySchema.parse(req.query);

      const result = await this.webhookService.listWebhooks(query);

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
   * PUT /api/webhooks/:id
   * Atualizar webhook
   */
  updateWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const validatedData = UpdateWebhookSchema.parse(req.body);

      const result = await this.webhookService.updateWebhook(id, validatedData);

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
   * DELETE /api/webhooks/:id
   * Deletar webhook
   */
  deleteWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.webhookService.deleteWebhook(id);

      if (result.isFailure) {
        res.status(404).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Webhook deletado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/webhooks/:id/execute
   * Executar webhook (testar)
   */
  executeWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const validatedData = ExecuteWebhookSchema.parse(req.body);

      const result = await this.webhookService.executeWebhook(id, validatedData.event, validatedData.payload);

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
}
