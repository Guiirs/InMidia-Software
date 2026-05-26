/**
 * Regiao Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import { RegiaoRepository } from './repositories/regiao.repository';
import { RegiaoService } from './services/regiao.service';
import { RegiaoController } from './controllers/regiao.controller';
import authenticateToken from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection — RegiaoRepository usa imports internos dos modelos
const repository = new RegiaoRepository();
const service = new RegiaoService(repository);
const controller = new RegiaoController(service);

// Aplica autenticação a todas as rotas
router.use(authenticateToken);

// POST /api/v1/regioes - Cria uma nova região
router.post(
  '/',
  controller.createRegiao
);

// GET /api/v1/regioes - Lista regiões com paginação
router.get(
  '/',
  controller.listRegioes
);

// GET /api/v1/regioes/:id - Busca região por ID
router.get(
  '/:id',
  controller.getRegiaoById
);

// PATCH /api/v1/regioes/:id - Atualiza região
router.patch(
  '/:id',
  controller.updateRegiao
);

// DELETE /api/v1/regioes/:id - Deleta região
router.delete(
  '/:id',
  controller.deleteRegiao
);

export default router;
