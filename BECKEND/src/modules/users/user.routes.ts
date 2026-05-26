/**
 * User Routes
 * Rotas HTTP com Dependency Injection
 */

import { NextFunction, Request, Response, Router } from 'express';
import { body } from 'express-validator';
import User from './User';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserController as NewUserController } from './controllers/user.controller';
import { UserController as OldUserController } from './user.controller';
import OldUserService from './user.service';
import authenticateToken from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { regenerateApiKeyLimiter } from '@shared/infra/http/middlewares/rate-limit.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';

const router = Router();

const repository = new UserRepository(User);
const service = new UserService(repository);
const controller = new NewUserController(service);

const oldService = new OldUserService();
const oldController = new OldUserController(oldService);

// Todas as rotas requerem autenticação e contexto de tenant
router.use(authenticateToken, requireTenantGuard);

// GET /api/v1/user/me — Perfil do utilizador (próprio usuário, sem restrição de permission)
router.get('/me', (req, res, next) => oldController.getUserProfile(req, res, next));

// GET /api/v1/user/me/empresa — Perfil da Empresa (próprio usuário)
router.get('/me/empresa', (req, res, next) => oldController.getEmpresaProfile(req, res, next));

// PUT /api/v1/user/me — Atualizar Perfil do Utilizador (próprio usuário)
router.put('/me', (req, res, next) => oldController.updateUserProfile(req, res, next));

// POST /api/v1/user/me/empresa/regenerate-api-key — Regenerar API Key (requer settings.manage ou admin.access)
router.post(
  '/me/empresa/regenerate-api-key',
  regenerateApiKeyLimiter,
  requirePermission('settings.manage'),
  [
    body('password')
      .optional()
      .isString()
      .withMessage('password deve ser string.'),
    body('senha')
      .optional()
      .isString()
      .withMessage('senha deve ser string.'),
    body('currentPassword')
      .optional()
      .isString()
      .withMessage('currentPassword deve ser string.'),
    body('adminPassword')
      .optional()
      .isString()
      .withMessage('adminPassword deve ser string.'),
    body().custom((value) => {
      const payload = (value || {}) as Record<string, unknown>;
      const candidate =
        payload.password ??
        payload.senha ??
        payload.currentPassword ??
        payload.adminPassword;

      if (typeof candidate !== 'string' || candidate.length === 0) {
        throw new Error('A sua senha atual é obrigatória para regenerar a chave.');
      }

      return true;
    }),
  ],
  handleValidationErrors,
  (req: Request, res: Response, next: NextFunction) => oldController.regenerateEmpresaApiKey(req, res, next),
);

// GET /api/v1/users/profile — Busca perfil do próprio usuário
router.get('/profile', controller.getProfile);

// PATCH /api/v1/users/profile — Atualiza perfil do próprio usuário
router.patch('/profile', controller.updateProfile);

export default router;
