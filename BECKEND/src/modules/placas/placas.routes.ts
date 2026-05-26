import { Router } from 'express';
import { param } from 'express-validator';
import logger from '@shared/container/logger';
import { PlacaController } from './controllers/placa.controller';
import { PlacaService } from './services/placa.service';
import { PlacaRepository } from './repositories/placa.repository';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { mediaUpload } from '@modules/media/media.routes';
import { placasCacheMiddleware } from '@shared/infra/http/middlewares/cache.middleware';
import {
    createPlacaValidationRules,
    updatePlacaValidationRules,
    disponibilidadeValidationRules,
    handleValidationErrors
} from './placaValidator';

const router = Router();

const placaRepository = new PlacaRepository();
const placaService = new PlacaService(placaRepository);
const placaController = new PlacaController(placaService);

logger.info('[Routes Placas] Componentes carregados com sucesso.');

router.use(authMiddleware, requireTenantGuard);

const validateIdParam = [
    param('id').isMongoId().withMessage('O ID da placa fornecido é inválido.')
];

const normalizeQueryParams = (req: any, _res: any, next: any) => {
    if (req.query.dataInicio) req.query.data_inicio = req.query.dataInicio;
    if (req.query.dataFim) req.query.data_fim = req.query.dataFim;
    next();
};

// ─── Rotas de coleção ────────────────────────────────────────────────────────

router.get(
    '/locations',
    requirePermission('placas.read'),
    placasCacheMiddleware,
    placaController.getPlacaLocationsController.bind(placaController)
);

router.get(
    '/disponiveis',
    requirePermission('placas.read'),
    placasCacheMiddleware,
    normalizeQueryParams,
    disponibilidadeValidationRules,
    handleValidationErrors,
    placaController.getPlacasDisponiveisController.bind(placaController)
);

router.get(
    '/',
    requirePermission('placas.read'),
    placasCacheMiddleware,
    placaController.getAllPlacasController.bind(placaController)
);

router.patch(
    '/reorder',
    requirePermission('placas.update'),
    placaController.reorderPlacasController.bind(placaController)
);

router.post(
    '/',
    requirePermission('placas.create'),
    mediaUpload.single('imagem'),
    createPlacaValidationRules,
    handleValidationErrors,
    placaController.createPlacaController.bind(placaController)
);

// ─── Rotas de recurso (:id) ──────────────────────────────────────────────────

router.get(
    '/:id',
    requirePermission('placas.read'),
    placasCacheMiddleware,
    validateIdParam,
    handleValidationErrors,
    placaController.getPlacaByIdController.bind(placaController)
);

router.put(
    '/:id',
    requirePermission('placas.update'),
    mediaUpload.single('imagem'),
    validateIdParam,
    updatePlacaValidationRules,
    handleValidationErrors,
    placaController.updatePlacaController.bind(placaController)
);

// PATCH /api/v1/placas/:id (alias para PATCH parcial — mesmo handler que PUT)
router.patch(
    '/:id',
    requirePermission('placas.update'),
    mediaUpload.single('imagem'),
    validateIdParam,
    handleValidationErrors,
    placaController.updatePlacaController.bind(placaController)
);

router.delete(
    '/:id',
    requirePermission('placas.delete'),
    validateIdParam,
    handleValidationErrors,
    placaController.deletePlacaController.bind(placaController)
);

// ─── Sub-recursos ────────────────────────────────────────────────────────────

/** POST /api/v1/placas/:id/images — Upload de imagem adicional */
router.post(
    '/:id/images',
    requirePermission('placas.update'),
    validateIdParam,
    handleValidationErrors,
    mediaUpload.single('imagem'),
    placaController.uploadImageController.bind(placaController)
);

/** PATCH /api/v1/placas/:id/images/:imageId/main — Definir imagem principal */
router.patch(
    '/:id/images/:imageId/main',
    requirePermission('placas.update'),
    validateIdParam,
    handleValidationErrors,
    placaController.setMainImageController.bind(placaController)
);

/** DELETE /api/v1/placas/:id/images/:imageId — Remover imagem da galeria */
router.delete(
    '/:id/images/:imageId',
    requirePermission('placas.update'),
    validateIdParam,
    handleValidationErrors,
    placaController.removeImageController.bind(placaController)
);

/** POST /api/v1/placas/:id/archive — Arquivar placa (soft delete) */
router.post(
    '/:id/archive',
    requirePermission('placas.delete'),
    validateIdParam,
    handleValidationErrors,
    placaController.archivePlacaController.bind(placaController)
);

/** POST /api/v1/placas/:id/restore — Restaurar placa arquivada */
router.post(
    '/:id/restore',
    requirePermission('placas.update'),
    validateIdParam,
    handleValidationErrors,
    placaController.restorePlacaController.bind(placaController)
);

/** GET /api/v1/placas/:id/timeline — Timeline de eventos da placa */
router.get(
    '/:id/timeline',
    requirePermission('placas.read'),
    validateIdParam,
    handleValidationErrors,
    placaController.getTimelineController.bind(placaController)
);

/** GET /api/v1/placas/:id/availability — Verificar disponibilidade por período */
router.get(
    '/:id/availability',
    requirePermission('placas.read'),
    validateIdParam,
    handleValidationErrors,
    placaController.getAvailabilityController.bind(placaController)
);

/** GET /api/v1/placas/:id/health — Health score da placa */
router.get(
    '/:id/health',
    requirePermission('placas.read'),
    validateIdParam,
    handleValidationErrors,
    placaController.getHealthController.bind(placaController)
);

/** PATCH /api/v1/placas/:id/disponibilidade — Toggle disponibilidade */
router.patch(
    '/:id/disponibilidade',
    requirePermission('placas.update'),
    validateIdParam,
    handleValidationErrors,
    placaController.toggleDisponibilidadeController.bind(placaController)
);

logger.info('[Routes Placas] Rotas de Placas definidas com sucesso.');

export default router;
