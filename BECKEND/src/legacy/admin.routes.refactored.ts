// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
/**
 * Admin Routes (Refactored)
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import { AdminRepository } from './repositories/admin.repository';
import { AdminService } from './services/admin.service.refactored';
import { AdminController } from './controllers/admin.controller.refactored';
import authenticateToken from '../../shared/infra/http/middlewares/auth.middleware';
import adminAuthMiddleware from '../../shared/infra/http/middlewares/admin-auth.middleware';

const router = Router();

// Dependency Injection
const repository = new AdminRepository();
const service = new AdminService(repository);
const controller = new AdminController(service);

// Todas as rotas requerem autenticação e permissão de admin
router.use(authenticateToken);
router.use(adminAuthMiddleware);

// GET /api/v1/admin/dashboard - Estatísticas do dashboard
router.get('/dashboard', (req, res, next) => controller.getDashboardStats(req, res, next));

// POST /api/v1/admin/bulk-operation - Operação em lote
router.post('/bulk-operation', (req, res, next) => controller.bulkOperation(req, res, next));

// DELETE /api/v1/admin/cache - Limpar cache
router.delete('/cache', controller.clearCache);

// GET /api/v1/admin/system-info - Informações do sistema
router.get('/system-info', controller.getSystemInfo);

export default router;
