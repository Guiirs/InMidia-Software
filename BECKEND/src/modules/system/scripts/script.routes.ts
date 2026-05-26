/**
 * Script Routes
 * Rotas de execução de scripts
 */
import { Router } from 'express';
import { run, runValidation } from './script.controller';
import adminAuth from '../../../shared/infra/http/middlewares/admin-auth.middleware';
import { adminRateLimiter } from '../../../shared/infra/http/middlewares/rate-limit.middleware';

const router = Router();

// Protected route to run allowed scripts (rate limited: 5/min)
router.post('/run', adminAuth, adminRateLimiter, runValidation, run);

export default router;
