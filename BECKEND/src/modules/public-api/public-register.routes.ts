/**
 * Public Register Routes
 * Rotas de registro público
 */
import { Router } from 'express';
// import { registerEmpresaController } from '../../modules/empresas/empresa.controller';
// import { registerValidationRules } from '../../validators/empresaValidator';
// import { handleValidationErrors } from '../auth/authValidator';
import logger from '../../shared/container/logger';

const router = Router();

logger.info('[Routes Public] Definindo rotas de Registo Público...');

/**
 * @route   POST /api/empresas/register
 * @desc    Regista uma nova empresa e o seu utilizador admin
 * @access  Public
 * @note    Controller pendente de implementação
 */
/* TODO: Implementar registerEmpresaController
router.post(
    '/register',
    registerValidationRules,
    handleValidationErrors,
    registerEmpresaController
);
*/

logger.info('[Routes Public] Rota POST /register definida com validação.');

export default router;
