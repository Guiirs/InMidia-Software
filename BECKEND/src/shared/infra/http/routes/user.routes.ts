import { Router } from 'express';
import { body } from 'express-validator';
import logger from '@shared/container/logger';
import { regenerateApiKeyLimiter } from '../middlewares/rate-limit.middleware';
import { UserController } from '@modules/users/user.controller';
import UserService from '@modules/users/user.service';
import authenticateToken from '../middlewares/auth.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';

const router = Router();

// Instanciar serviços e controllers
const userService = new UserService();
const userController = new UserController(userService);

// Verificação de componentes
if (!authenticateToken) {
    logger.error('[Routes User] ERRO CRÍTICO: Middleware de autenticação ausente.');
    throw new Error('Middleware de autenticação incompleto.');
}
logger.info('[Routes User] Componentes carregados com sucesso.');

logger.info('[Routes User] Definindo rotas de Utilizador...');

// Aplica autenticação a todas as rotas
router.use(authenticateToken);
logger.debug('[Routes User] Middleware de Autenticação aplicado a /user/*.');

// GET /api/v1/user/me - Perfil do Utilizador
router.get('/me', (req, res, next) => userController.getUserProfile(req, res, next));
logger.debug('[Routes User] Rota GET /me definida (Perfil do Utilizador).');

// GET /api/v1/user/me/empresa - Perfil da Empresa (Apenas Admin)
router.get('/me/empresa', (req, res, next) => userController.getEmpresaProfile(req, res, next));
logger.debug('[Routes User] Rota GET /me/empresa definida (Perfil da Empresa).');

// PUT /api/v1/user/me - Atualiza Perfil do Utilizador
router.put(
    '/me',
    [
        body('email')
            .optional()
            .isEmail().withMessage('O e-mail fornecido não é válido.')
            .normalizeEmail()
            .isLength({ max: 100 }).withMessage('E-mail muito longo (máx 100 caracteres).'),
        body('username')
            .optional()
            .trim()
            .isLength({ min: 3, max: 50 }).withMessage('O nome de utilizador deve ter entre 3 e 50 caracteres.')
            .escape(),
        body('password')
            .optional()
            .isLength({ min: 6 }).withMessage('A nova senha precisa ter no mínimo 6 caracteres.'),
        body('nome')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Nome muito longo (máx 100 caracteres).')
            .escape(),
        body('sobrenome')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Sobrenome muito longo (máx 100 caracteres).')
            .escape(),
        body('avatar_url')
            .optional({ checkFalsy: true })
            .trim()
            .isURL().withMessage('A URL do avatar fornecida não é válida.')
    ],
    handleValidationErrors,
    (req: any, res: any, next: any) => userController.updateUserProfile(req, res, next)
);
logger.debug('[Routes User] Rota PUT /me definida (Atualizar Perfil).');

// POST /api/v1/user/me/empresa/regenerate-api-key - Regenera API Key
router.post(
    '/me/empresa/regenerate-api-key',
    regenerateApiKeyLimiter,
    [
        body('password').notEmpty().withMessage('A sua senha atual é obrigatória para regenerar a chave.')
    ],
    handleValidationErrors,
    (req: any, res: any, next: any) => userController.regenerateEmpresaApiKey(req, res, next)
);
logger.debug('[Routes User] Rota POST /me/empresa/regenerate-api-key definida (Regenerar API Key) com rate limit 3/hora.');

logger.info('[Routes User] Rotas de Utilizador definidas com sucesso.');

export default router;
