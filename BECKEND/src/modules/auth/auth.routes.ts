/**
 * Auth Routes — com HttpOnly Cookies, Refresh Token, Logout e Session Management
 */

import { Router } from 'express';
import User from '@modules/users/User';
import { AuthRepository } from './repositories/auth.repository';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import authenticateToken from '@middlewares/auth.middleware';
import {
  authRateLimiter,
  refreshRateLimiter,
} from '@middlewares/rate-limit.middleware';

const router = Router();

// Dependency Injection
const repository = new AuthRepository(User);
const service = new AuthService(repository);
const controller = new AuthController(service);

// ─── Rotas Públicas ────────────────────────────────────────────────────────────

// POST /api/v1/auth/login
router.post('/login', authRateLimiter, controller.login);

// POST /api/v1/auth/refresh — renova access token via refresh token
router.post('/refresh', refreshRateLimiter, controller.refresh);

// POST /api/v1/auth/logout — encerra sessão atual
router.post('/logout', controller.logout);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', authRateLimiter, controller.forgotPassword);

// POST /api/v1/auth/reset-password/:token
router.post('/reset-password/:token', authRateLimiter, controller.resetPassword);

// GET /api/v1/auth/verify-token/:token
router.get('/verify-token/:token', controller.verifyResetToken);

// ─── Rotas Autenticadas ────────────────────────────────────────────────────────

// POST /api/v1/auth/change-password
router.post('/change-password', authenticateToken, controller.changePassword);

// POST /api/v1/auth/logout-all — encerra TODAS as sessões do usuário
router.post('/logout-all', authenticateToken, controller.logoutAll);

// GET /api/v1/auth/sessions — lista sessões ativas do usuário
router.get('/sessions', authenticateToken, controller.getSessions);

// POST /api/v1/auth/revoke-token — revoga access token específico (admin)
router.post('/revoke-token', authenticateToken, controller.revokeToken);

export default router;
