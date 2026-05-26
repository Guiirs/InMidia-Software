import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { FeaturesV4Controller } from './controllers/features-v4.controller';
import { FeaturesV4Service } from './services/features-v4.service';

const router = Router();
const controller = new FeaturesV4Controller(new FeaturesV4Service());

router.use(authenticateToken, requireTenantGuard);

/**
 * GET /api/v4/features
 * Retorna as feature flags para o tenant autenticado.
 * Não requer permissão específica — qualquer usuário autenticado pode ler suas flags.
 */
router.get('/', controller.getFlags);

export default router;
