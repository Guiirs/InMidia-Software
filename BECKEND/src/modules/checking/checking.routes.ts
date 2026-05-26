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
import { upload } from '@shared/infra/http/middlewares/upload.middleware';

const router = Router();

// Dependency Injection
const repository = new CheckingRepository(Checking);
const service = new CheckingService(repository);
const controller = new CheckingController(service);

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/checkings - Create checking with photo upload
router.post('/', upload!.single('photo'), controller.createChecking);

// GET /api/checkings - List checkings with filters
router.get('/', controller.listCheckings);

// GET /api/checkings/:id - Get checking by ID
router.get('/:id', controller.getCheckingById);

// PATCH /api/checkings/:id - Update checking
router.patch('/:id', controller.updateChecking);

// GET /api/checkings/aluguel/:aluguelId - Get checkings by aluguel
router.get('/aluguel/:aluguelId', controller.getCheckingsByAluguel);

export default router;