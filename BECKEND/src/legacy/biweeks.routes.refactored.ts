// @ts-nocheck
/**
 * BiWeeks Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import BiWeek from './BiWeek';
import { BiWeekRepository } from './repositories/biweek.repository';
import { BiWeekService } from './services/biweek.service.refactored';
import { BiWeekController } from './controllers/biweek.controller.refactored';
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection
const repository = new BiWeekRepository(BiWeek);
const service = new BiWeekService(repository);
const controller = new BiWeekController(service);

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// POST /api/v1/biweeks - Criar BiWeek
router.post(
  '/',
  controller.createBiWeek
);

// GET /api/v1/biweeks/:id - Buscar BiWeek por ID
router.get('/:id', controller.getBiWeekById);

// GET /api/v1/biweeks - Listar BiWeeks
router.get('/', controller.listBiWeeks);

// PUT /api/v1/biweeks/:id - Atualizar BiWeek
router.put(
  '/:id',
  controller.updateBiWeek
);

// DELETE /api/v1/biweeks/:id - Deletar BiWeek
router.delete('/:id', controller.deleteBiWeek);

// POST /api/v1/biweeks/generate - Gerar BiWeeks para um ano
router.post(
  '/generate',
  controller.generateBiWeeks
);

export default router;
