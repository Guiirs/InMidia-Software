/**
 * WhatsApp Routes
 * Rotas para gerenciar integração WhatsApp
 */

import { Router } from 'express';
import * as whatsappController from './whatsapp.controller';
import authMiddleware from '../../shared/infra/http/middlewares/auth.middleware';
import adminAuthMiddleware from '../../shared/infra/http/middlewares/admin-auth.middleware';
import { body } from 'express-validator';
import logger from '../../shared/container/logger';

const router = Router();

// Todas as rotas requerem autenticação de admin
router.use(authMiddleware);
router.use(adminAuthMiddleware);

// GET /api/v1/whatsapp/status - Status da conexão
router.get('/status', whatsappController.getStatus);

// GET /api/v1/whatsapp/qr - Obtém QR code atual
router.get('/qr', whatsappController.getQrCode);

// POST /api/v1/whatsapp/enviar-relatorio - Envia relatório manualmente
router.post('/enviar-relatorio', whatsappController.enviarRelatorio);

// POST /api/v1/whatsapp/enviar-mensagem - Envia mensagem customizada
router.post(
    '/enviar-mensagem',
    [
        body('mensagem')
            .notEmpty().withMessage('Mensagem é obrigatória')
            .isString().withMessage('Mensagem deve ser texto')
            .isLength({ max: 4096 }).withMessage('Mensagem muito longa (máx 4096 caracteres)')
    ],
    whatsappController.enviarMensagem
);

// POST /api/v1/whatsapp/reconectar - Reconecta cliente
router.post('/reconectar', whatsappController.reconectar);

// GET /api/v1/whatsapp/grupos - Lista grupos disponíveis
router.get('/grupos', whatsappController.listarGrupos);

logger.info('[Routes WhatsApp] Rotas de WhatsApp configuradas');

export default router;
