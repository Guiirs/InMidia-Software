/**
 * Aluguel Routes
 * Rotas com Dependency Injection
 */

import { Router } from 'express';
import authenticateToken from '@middlewares/auth.middleware';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '@modules/auth/authValidator';
import { Log } from '@shared/core';

// Dependency Injection
import { AluguelRepository } from './repositories/aluguel.repository';
import { AluguelService } from './services/aluguel.service';
import { AluguelController } from './controllers/aluguel.controller';

const router = Router();

Log.info('[Routes Aluguel] Inicializando rotas de Aluguéis com DI...');

// Instanciar camadas
const aluguelRepository = new AluguelRepository();
const aluguelService = new AluguelService(aluguelRepository);
const aluguelController = new AluguelController(aluguelService);

// Autenticação em todas as rotas
router.use(authenticateToken);

// Validações
const validateIdParam = [
    param('id').isMongoId().withMessage('O ID do aluguel fornecido é inválido.')
];

const validatePlacaIdParam = [
    param('placaId').isMongoId().withMessage('O ID da placa fornecido e invalido.')
];

const validateAluguelCreateBody = [
    body('placaId')
        .notEmpty().withMessage('A placa é obrigatória.')
        .isMongoId().withMessage('O ID da placa é inválido.'),
    body('clienteId')
        .notEmpty().withMessage('O cliente é obrigatório.')
        .isMongoId().withMessage('O ID do cliente é inválido.'),
    body('startDate')
        .notEmpty().withMessage('A data de início é obrigatória.')
        .isISO8601().withMessage('Data de início inválida.'),
    body('endDate')
        .notEmpty().withMessage('A data de fim é obrigatória.')
        .isISO8601().withMessage('Data de fim inválida.'),
    body('periodType')
        .optional()
        .isIn(['quinzenal', 'mensal', 'custom']).withMessage('Tipo de período inválido.'),
    body('status')
        .optional()
        .isIn(['ativo', 'finalizado', 'cancelado']).withMessage('Status inválido.'),
    body('tipo')
        .optional()
        .isIn(['manual', 'pi']).withMessage('Tipo inválido.')
];

const validateAluguelUpdateBody = [
    body('startDate')
        .optional()
        .isISO8601().withMessage('Data de início inválida.'),
    body('endDate')
        .optional()
        .isISO8601().withMessage('Data de fim inválida.'),
    body('status')
        .optional()
        .isIn(['ativo', 'finalizado', 'cancelado']).withMessage('Status inválido.')
];

const validateCheckDisponibilidadeBody = [
    body('placaId')
        .notEmpty().withMessage('A placa é obrigatória.')
        .isMongoId().withMessage('O ID da placa é inválido.'),
    body('startDate')
        .notEmpty().withMessage('A data de início é obrigatória.')
        .isISO8601().withMessage('Data de início inválida.'),
    body('endDate')
        .notEmpty().withMessage('A data de fim é obrigatória.')
        .isISO8601().withMessage('Data de fim inválida.')
];

// POST /api/v1/alugueis - Cria um novo aluguel
router.post(
    '/',
    validateAluguelCreateBody,
    handleValidationErrors,
    aluguelController.createAluguel
);

// GET /api/v1/alugueis - Lista todos os aluguéis (com filtros)
router.get(
    '/',
    aluguelController.listAlugueis
);

// GET /api/v1/alugueis/:id - Busca um aluguel específico
router.get(
    '/placa/:placaId',
    validatePlacaIdParam,
    handleValidationErrors,
    aluguelController.getAlugueisByPlaca
);

router.get(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    aluguelController.getAluguelById
);

// PATCH /api/v1/alugueis/:id - Atualiza um aluguel
router.patch(
    '/:id',
    validateIdParam,
    validateAluguelUpdateBody,
    handleValidationErrors,
    aluguelController.updateAluguel
);

// DELETE /api/v1/alugueis/:id - Deleta um aluguel
router.delete(
    '/:id',
    validateIdParam,
    handleValidationErrors,
    aluguelController.deleteAluguel
);

// POST /api/v1/alugueis/check-disponibilidade - Verifica disponibilidade
router.post(
    '/check-disponibilidade',
    validateCheckDisponibilidadeBody,
    handleValidationErrors,
    aluguelController.checkDisponibilidade
);

// TODO: Migrar rotas específicas de BI-Week posteriormente
// GET /api/v1/alugueis/bi-week/:biWeekId
// GET /api/v1/alugueis/bi-week/:biWeekId/disponiveis

Log.info('[Routes Aluguel] Rotas de Alugueis definidas com sucesso.');

export default router;
