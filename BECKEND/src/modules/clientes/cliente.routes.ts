import { Router } from 'express';
import { body, param } from 'express-validator';
import logger from '@shared/container/logger';
import { handleValidationErrors } from '@modules/auth/authValidator';
import { validarCNPJ } from '../../../src/utils/validators';
import { ClienteController } from './controllers/cliente.controller';
import { ClienteService } from './services/cliente.service';
import { ClienteRepository } from './repositories/cliente.repository';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { upload } from '@shared/infra/http/middlewares/upload.middleware';

const router = Router();

// Instantiate dependencies
const clienteRepository = new ClienteRepository();
const clienteService = new ClienteService(clienteRepository);
const clienteController = new ClienteController(clienteService);

// Validações
const validateIdParam = [
    param('id').isMongoId().withMessage('O ID do cliente fornecido é inválido.')
];

const validateClienteBody = [
    body('nome')
        .trim()
        .notEmpty().withMessage('O nome do cliente é obrigatório.')
        .isLength({ max: 150 }).withMessage('Nome muito longo (máx 150 caracteres).')
        .escape(),
    body('cnpj')
        .optional({ checkFalsy: true })
        .trim()
        .custom(value => {
            if (value && !validarCNPJ(value)) {
                throw new Error('O CNPJ fornecido é inválido.');
            }
            return true;
        }),
    body('telefone')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 50 }).withMessage('Telefone muito longo (máx 50 caracteres).')
        .escape()
];

logger.info('[Routes Clientes] Definindo rotas de Clientes...');

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);
logger.debug('[Routes Clientes] Middleware de Autenticação aplicado a /clientes/*.');

// GET /api/v1/clientes - Busca todos os clientes
router.get('/', clienteController.getAllClientesController.bind(clienteController));
logger.debug('[Routes Clientes] Rota GET / definida (Listar Clientes).');

// GET /api/v1/clientes/:id - Busca um cliente por ID
router.get(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    clienteController.getClienteByIdController.bind(clienteController)
);
logger.debug('[Routes Clientes] Rota GET /:id definida (Buscar Cliente por ID).');

// POST /api/v1/clientes - Cria um novo cliente (com upload opcional de logo)
router.post(
    '/',
    upload!.single('logo'),
    validateClienteBody,
    handleValidationErrors,
    clienteController.createClienteController.bind(clienteController)
);
logger.debug('[Routes Clientes] Rota POST / definida (Criar Cliente com Upload).');

// PUT /api/v1/clientes/:id - Atualiza um cliente (com upload opcional de logo)
router.put(
    '/:id',
    upload!.single('logo'),
    validateIdParam,
    validateClienteBody,
    handleValidationErrors,
    clienteController.updateClienteController.bind(clienteController)
);
logger.debug('[Routes Clientes] Rota PUT /:id definida (Atualizar Cliente com Upload).');

// DELETE /api/v1/clientes/:id - Apaga um cliente
router.delete(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    clienteController.deleteClienteController.bind(clienteController)
);
logger.debug('[Routes Clientes] Rota DELETE /:id definida (Apagar Cliente).');

logger.info('[Routes Clientes] Rotas de Clientes definidas com sucesso.');
logger.debug('[Routes Clientes] Router exportado.');

export default router;
