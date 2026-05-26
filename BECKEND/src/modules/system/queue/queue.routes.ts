/**
 * Queue Routes
 * Rotas de filas
 */
import { Router } from 'express';
import * as queueController from './queue.controller';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { param } from 'express-validator';
import { handleValidationErrors } from '@modules/auth/authValidator';
import logger from '@shared/container/logger';

const router = Router();

logger.info('[Routes Queue] Definindo rotas de Queue...');

// Aplica autenticacao a todas as rotas
router.use(authenticateToken);

// Validacoes
const validateJobIdParam = [
    param('jobId').notEmpty().withMessage('Job ID e obrigatorio.')
];

const validateEntityIdParam = [
    param('id').isMongoId().withMessage('O ID fornecido e invalido.')
];




// GET /api/v1/queue/jobs/:jobId - Busca status de um job especifico
router.post(
    '/contratos/:id/generate-pdf',
    validateEntityIdParam,
    handleValidationErrors,
    queueController.generateContratoPDF
);

router.post(
    '/pis/:id/generate-pdf',
    validateEntityIdParam,
    handleValidationErrors,
    queueController.generatePIPDF
);

router.get(
    '/jobs/:jobId',
    validateJobIdParam,
    handleValidationErrors,
    queueController.getJobStatus
);

// GET /api/v1/queue/jobs - Lista jobs da empresa (com filtros)
router.get(
    '/jobs',
    queueController.getJobs
);

// GET /api/v1/queue/jobs/:jobId/download - Download do resultado do job
router.get(
    '/jobs/:jobId/download',
    validateJobIdParam,
    handleValidationErrors,
    queueController.downloadJobResult
);

logger.info('[Routes Queue] Rotas de Queue definidas com sucesso.');

export default router;
