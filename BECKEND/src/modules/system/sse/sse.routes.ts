/**
 * SSE Routes
 * Server-Sent Events
 */
import { Router } from 'express';
import * as sseController from './sse.controller';
import authMiddleware from '../../../shared/infra/http/middlewares/auth.middleware';
import adminAuthMiddleware from '../../../shared/infra/http/middlewares/admin-auth.middleware';
import logger from '../../../shared/container/logger';

const router = Router();

// Stream de notificações SSE (requer autenticação)
router.get('/stream', authMiddleware, sseController.streamNotificacoes);

// Estatísticas SSE (apenas admin)
router.get('/stats', authMiddleware, adminAuthMiddleware, sseController.getEstatisticas);

logger.info('[Routes SSE] Rotas de Server-Sent Events configuradas');

export default router;
