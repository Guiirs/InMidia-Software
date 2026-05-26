/**
 * PI Routes
 * Rotas de propostas internas
 */
import { Router } from 'express';
import * as piController from './pi.controller';
import authenticateToken from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import { piValidationRules, validateIdParam, handleValidationErrors } from '@validators/piValidator';
import logger from '@shared/container/logger';

const router = Router();

logger.info('[Routes PI] Definindo rotas de Propostas Internas (PIs)...');

// Aplica autenticação a todas as rotas
router.use(authenticateToken, requireTenantGuard);

// GET /api/v1/pis - Lista todas as PIs (com filtros)
router.get('/', requirePermission('propostas.read'), piController.getAllPIs);

// POST /api/v1/pis - Cria uma nova PI
router.post(
    '/',
    requirePermission('propostas.create'),
    piValidationRules,
    handleValidationErrors,
    piController.createPI
);

// GET /api/v1/pis/:id - Busca uma PI específica
router.get(
    '/:id',
    requirePermission('propostas.read'),
    validateIdParam,
    handleValidationErrors,
    piController.getPIById
);

// PUT /api/v1/pis/:id - Atualiza uma PI
router.put(
    '/:id',
    requirePermission('propostas.update'),
    validateIdParam,
    piValidationRules,
    handleValidationErrors,
    piController.updatePI
);

// DELETE /api/v1/pis/:id - Apaga uma PI
router.delete(
    '/:id',
    requirePermission('propostas.update'),
    validateIdParam,
    handleValidationErrors,
    piController.deletePI
);

// POST /api/v1/pis/check-availability - Verifica disponibilidade de placas para período
// IMPORTANTE: rota sem :id deve vir ANTES das rotas com :id/action
router.post(
    '/check-availability',
    requirePermission('propostas.read'),
    piController.checkAvailability
);

// POST /api/v1/pis/:id/approve - Aprova PI
router.post(
    '/:id/approve',
    requirePermission('propostas.update'),
    validateIdParam,
    handleValidationErrors,
    piController.approvePI
);

// POST /api/v1/pis/:id/reject - Rejeita PI
router.post(
    '/:id/reject',
    requirePermission('propostas.update'),
    validateIdParam,
    handleValidationErrors,
    piController.rejectPI
);

// POST /api/v1/pis/:id/cancel - Cancela PI
router.post(
    '/:id/cancel',
    requirePermission('propostas.update'),
    validateIdParam,
    handleValidationErrors,
    piController.cancelPI
);

// POST /api/v1/pis/:id/generate-contract - Gera contrato a partir de PI APPROVED
router.post(
    '/:id/generate-contract',
    requirePermission('propostas.update'),
    validateIdParam,
    handleValidationErrors,
    piController.generateContractFromPI
);

// GET /api/v1/pis/:id/download - Gera o PDF da PI
router.get(
    '/:id/download',
    requirePermission('propostas.read'),
    validateIdParam,
    handleValidationErrors,
    piController.downloadPI_PDF
);

// GET /api/v1/pis/:id/download-excel - Gera o Excel da PI
router.get(
    '/:id/download-excel',
    requirePermission('propostas.read'),
    validateIdParam,
    handleValidationErrors,
    piController.downloadPI_Excel
);

// GET /api/v1/pis/:id/pdf-template - Gera o PDF da PI (convertido do Excel)
router.get(
    '/:id/pdf-template',
    requirePermission('propostas.read'),
    validateIdParam,
    handleValidationErrors,
    piController.downloadPI_PDF_FromExcel
);

logger.info('[Routes PI] Rotas de PIs definidas com sucesso.');

export default router;
