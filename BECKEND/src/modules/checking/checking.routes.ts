/**
 * Checking Routes (Refatorado)
 * Rotas do módulo de checking/vistoria
 */

import { Router } from 'express';
import Checking from './Checking';
import { CheckingRepository } from './repositories/checking.repository';
import { CheckingService } from './services/checking.service';
import { CheckingController } from './controllers/checking.controller';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { upload } from '@shared/infra/http/middlewares/upload.middleware';

const router = Router();

// Dependency Injection
const repository = new CheckingRepository(Checking);
const service = new CheckingService(repository);
const controller = new CheckingController(service);

// Apply auth + tenant guard to all routes.
router.use(authMiddleware, requireTenantGuard);

// POST /api/checkings - Create checking with photo upload
router.post('/', requirePermission('operations.create'), upload!.single('photo'), controller.createChecking);

// GET /api/checkings - List checkings with filters
router.get('/', requirePermission('operations.read'), controller.listCheckings);

// GET /api/checkings/aluguel/:aluguelId - Get checkings by aluguel
router.get('/aluguel/:aluguelId', requirePermission('operations.read'), controller.getCheckingsByAluguel);

// GET /api/checkings/:id - Get checking by ID
router.get('/:id', requirePermission('operations.read'), controller.getCheckingById);

// PATCH /api/checkings/:id - Update checking
router.patch('/:id', requirePermission('operations.update'), controller.updateChecking);

// DELETE /api/checkings/:id - Remove checking
router.delete('/:id', requirePermission('operations.update'), controller.deleteChecking);

export default router;
