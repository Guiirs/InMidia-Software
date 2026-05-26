// @ts-nocheck
/**
 * WhatsApp Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import { WhatsAppRepository } from './repositories/whatsapp.repository';
import { WhatsAppService } from './services/whatsapp.service.refactored';
import { WhatsAppController } from './controllers/whatsapp.controller.refactored';
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection
const repository = new WhatsAppRepository();
const service = new WhatsAppService(repository);
const controller = new WhatsAppController(service);

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// POST /api/v1/whatsapp/send - Enviar mensagem
router.post(
  '/send',
  controller.sendMessage
);

// POST /api/v1/whatsapp/send-bulk - Enviar mensagens em lote
router.post(
  '/send-bulk',
  controller.sendBulkMessages
);

// GET /api/v1/whatsapp/messages/:id/status - Buscar status de mensagem
router.get('/messages/:id/status', controller.getMessageStatus);

// POST /api/v1/whatsapp/templates - Criar template
router.post(
  '/templates',
  controller.createTemplate
);

// GET /api/v1/whatsapp/templates/:id - Buscar template por ID
router.get('/templates/:id', controller.getTemplateById);

// GET /api/v1/whatsapp/templates - Listar templates
router.get('/templates', controller.listTemplates);

// PUT /api/v1/whatsapp/templates/:id - Atualizar template
router.put(
  '/templates/:id',
  controller.updateTemplate
);

// DELETE /api/v1/whatsapp/templates/:id - Deletar template
router.delete('/templates/:id', controller.deleteTemplate);

export default router;
