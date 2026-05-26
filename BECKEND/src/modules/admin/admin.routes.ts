/**
 * Admin Routes
 * Rotas administrativas
 */
import { Router } from 'express';
import { body, param } from 'express-validator';
import logger from '../../shared/container/logger';
import * as adminController from './admin.controller';
import authenticateToken from '../../shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '../../shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '../../shared/infra/http/middlewares/permissions.middleware';
import { handleValidationErrors } from '../auth/authValidator';

const router = Router();

logger.info('[Routes Admin] Definindo rotas de Administração...');

// Validações
const validateUserCreation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('O nome de utilizador deve ter entre 3 e 50 caracteres.')
        .escape(),
    body('email')
        .isEmail().withMessage('Forneça um e-mail válido.')
        .normalizeEmail()
        .isLength({ max: 100 }).withMessage('E-mail muito longo (máx 100 caracteres).'),
    body('password')
        .isLength({ min: 6 }).withMessage('A senha deve ter no mínimo 6 caracteres.'),
    body('nome')
        .trim()
        .notEmpty().withMessage('O nome é obrigatório.')
        .isLength({ max: 100 }).withMessage('Nome muito longo (máx 100 caracteres).')
        .escape(),
    body('sobrenome')
        .trim()
        .notEmpty().withMessage('O sobrenome é obrigatório.')
        .isLength({ max: 100 }).withMessage('Sobrenome muito longo (máx 100 caracteres).')
        .escape(),
    body('role')
        .optional()
        .isIn(['superadmin', 'admin_empresa', 'gestor', 'vendedor', 'financeiro', 'visualizador', 'admin', 'user'])
        .withMessage("A 'role' fornecida é inválida para RBAC.")
];

const validateRoleUpdate = [
    param('id').isMongoId().withMessage('O ID do utilizador fornecido é inválido.'),
    body('role')
        .notEmpty().withMessage("O campo 'role' é obrigatório.")
        .isIn(['superadmin', 'admin_empresa', 'gestor', 'vendedor', 'financeiro', 'visualizador', 'admin', 'user'])
        .withMessage("A 'role' fornecida é inválida para RBAC.")
];

const validateIdParam = [
    param('id').isMongoId().withMessage('O ID do utilizador fornecido é inválido.')
];

// Middlewares aplicados a todas as rotas
router.use(authenticateToken, requireTenantGuard);
logger.debug('[Routes Admin] Middleware de Autenticação aplicado a /admin/*.');

router.use(requirePermission('admin.access'));
logger.debug('[Routes Admin] Middleware RBAC aplicado a /admin/*.');

// GET /api/v1/admin/users
router.get('/users', requirePermission('usuarios.manage'), adminController.getAllUsers);
logger.debug('[Routes Admin] Rota GET /users definida (Listar Utilizadores).');

// POST /api/v1/admin/users
router.post(
    '/users',
    requirePermission('usuarios.manage'),
    validateUserCreation,
    handleValidationErrors,
    adminController.createUser
);
logger.debug('[Routes Admin] Rota POST /users definida (Criar Utilizador).');

// PUT /api/v1/admin/users/:id/role
router.put(
    '/users/:id/role',
    requirePermission('usuarios.manage'),
    validateRoleUpdate,
    handleValidationErrors,
    adminController.updateUserRole
);
logger.debug('[Routes Admin] Rota PUT /users/:id/role definida (Atualizar Role).');

// DELETE /api/v1/admin/users/:id
router.delete(
    '/users/:id',
    requirePermission('usuarios.manage'),
    validateIdParam,
    handleValidationErrors,
    adminController.deleteUser
);
logger.debug('[Routes Admin] Rota DELETE /users/:id definida (Apagar Utilizador).');

logger.info('[Routes Admin] Rotas de Administração definidas com sucesso.');
logger.debug('[Routes Admin] Router exportado.');

export default router;
