// @ts-nocheck
/**
 * Webhooks Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import { WebhookRepository } from './repositories/webhook.repository';
import { WebhookService } from './services/webhook.service.refactored';
import { WebhookController } from './controllers/webhook.controller.refactored';
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection
const repository = new WebhookRepository();
const service = new WebhookService(repository);
const controller = new WebhookController(service);

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// POST /api/v1/webhooks - Criar webhook
router.post(
  '/',
  controller.createWebhook
);

// GET /api/v1/webhooks/:id - Buscar webhook por ID
router.get('/:id', controller.getWebhookById);

// GET /api/v1/webhooks - Listar webhooks
router.get('/', controller.listWebhooks);

// PUT /api/v1/webhooks/:id - Atualizar webhook
router.put(
  '/:id',
  controller.updateWebhook
);

// DELETE /api/v1/webhooks/:id - Deletar webhook
router.delete('/:id', controller.deleteWebhook);

// POST /api/v1/webhooks/:id/execute - Executar/Testar webhook
router.post(
  '/:id/execute',
  controller.executeWebhook
);

export default router;
