/**
 * Webhook Routes
 * Rotas de webhooks
 */
import { Router } from 'express';
import * as webhookController from './webhook.controller';
import authMiddleware from '../../shared/infra/http/middlewares/auth.middleware';
import adminAuthMiddleware from '../../shared/infra/http/middlewares/admin-auth.middleware';
import { body, param } from 'express-validator';
import logger from '../../shared/container/logger';

const router = Router();

// Validações
const validarCriacaoWebhook = [
    body('nome')
        .trim()
        .notEmpty().withMessage('Nome é obrigatório')
        .isLength({ max: 100 }).withMessage('Nome não pode exceder 100 caracteres'),
    body('url')
        .trim()
        .notEmpty().withMessage('URL é obrigatória')
        .isURL().withMessage('URL inválida')
        .matches(/^https?:\/\//).withMessage('URL deve começar com http:// ou https://'),
    body('eventos')
        .isArray({ min: 1 }).withMessage('Pelo menos um evento deve ser selecionado')
        .custom((eventos) => {
            const eventosValidos = [
                'placa_disponivel', 'placa_alugada', 'contrato_criado',
                'contrato_expirando', 'contrato_expirado', 'pi_criada',
                'pi_aprovada', 'cliente_novo', 'aluguel_criado', 'aluguel_cancelado'
            ];
            return eventos.every((e: string) => eventosValidos.includes(e));
        }).withMessage('Evento inválido detectado'),
    body('retry_config.max_tentativas')
        .optional()
        .isInt({ min: 1, max: 5 }).withMessage('Max tentativas deve estar entre 1 e 5'),
    body('retry_config.timeout_ms')
        .optional()
        .isInt({ min: 1000, max: 30000 }).withMessage('Timeout deve estar entre 1000 e 30000 ms')
];

const validarAtualizacaoWebhook = [
    param('webhookId')
        .isMongoId().withMessage('ID do webhook inválido'),
    body('nome')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Nome não pode exceder 100 caracteres'),
    body('url')
        .optional()
        .trim()
        .isURL().withMessage('URL inválida')
        .matches(/^https?:\/\//).withMessage('URL deve começar com http:// ou https://'),
    body('eventos')
        .optional()
        .isArray({ min: 1 }).withMessage('Pelo menos um evento deve ser selecionado'),
    body('ativo')
        .optional()
        .isBoolean().withMessage('Campo ativo deve ser boolean')
];

const validarWebhookId = [
    param('webhookId')
        .isMongoId().withMessage('ID do webhook inválido')
];

// Todas as rotas requerem autenticação de admin
router.use(authMiddleware);
router.use(adminAuthMiddleware);

// Rotas
router.get('/', webhookController.listarWebhooks);
router.post('/', validarCriacaoWebhook, webhookController.criarWebhook);
router.get('/:webhookId', validarWebhookId, webhookController.buscarWebhook);
router.put('/:webhookId', validarAtualizacaoWebhook, webhookController.atualizarWebhook);
router.delete('/:webhookId', validarWebhookId, webhookController.removerWebhook);
router.post('/:webhookId/regenerar-secret', validarWebhookId, webhookController.regenerarSecret);
router.post('/:webhookId/testar', validarWebhookId, webhookController.testarWebhook);

logger.info('[Routes Webhook] Rotas de webhooks configuradas');

export default router;
