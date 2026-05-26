// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
import { Request, Response, NextFunction } from 'express';
import { WhatsAppService } from '../services/whatsapp.service.refactored';
import {
  SendMessageSchema,
  SendBulkMessagesSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  ListTemplatesQuerySchema
} from '../dtos/whatsapp.dto';
import { z } from 'zod';

/**
 * Controller para WhatsApp
 */
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  /**
   * POST /api/whatsapp/send
   * Enviar mensagem
   */
  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = SendMessageSchema.parse(req.body);

      const result = await this.whatsappService.sendMessage(validatedData);

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
   * POST /api/whatsapp/send-bulk
   * Enviar mensagens em lote
   */
  sendBulkMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = SendBulkMessagesSchema.parse(req.body);

      const result = await this.whatsappService.sendBulkMessages(validatedData);

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
   * GET /api/whatsapp/messages/:id/status
   * Buscar status de mensagem
   */
  getMessageStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.whatsappService.getMessageStatus(id);

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
   * POST /api/whatsapp/templates
   * Criar template
   */
  createTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = CreateTemplateSchema.parse(req.body);

      const result = await this.whatsappService.createTemplate(validatedData);

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
   * GET /api/whatsapp/templates/:id
   * Buscar template por ID
   */
  getTemplateById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.whatsappService.getTemplateById(id);

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
   * GET /api/whatsapp/templates
   * Listar templates
   */
  listTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ListTemplatesQuerySchema.parse(req.query);

      const result = await this.whatsappService.listTemplates(query);

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
   * PUT /api/whatsapp/templates/:id
   * Atualizar template
   */
  updateTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const validatedData = UpdateTemplateSchema.parse(req.body);

      const result = await this.whatsappService.updateTemplate(id, validatedData);

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
   * DELETE /api/whatsapp/templates/:id
   * Deletar template
   */
  deleteTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ success: false, error: 'ID é obrigatório' });
        return;
      }

      const result = await this.whatsappService.deleteTemplate(id);

      if (result.isFailure) {
        res.status(404).json({
          success: false,
          error: result.error.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Template deletado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  };
}
