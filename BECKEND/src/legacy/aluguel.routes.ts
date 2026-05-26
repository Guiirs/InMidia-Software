// @ts-nocheck
import { Router } from 'express';
import { AluguelController } from '@modules/alugueis/aluguel.controller';
import AluguelService from '@modules/alugueis/aluguel.service';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import * as aluguelValidator from '@validators/aluguelValidator';
import { handleValidationErrors } from '@modules/auth/authValidator';
import logger from '@shared/container/logger';

const router = Router();

// Instancia o serviço e controlador com injeção de dependência
const aluguelService = new AluguelService();
const aluguelController = new AluguelController(aluguelService);

logger.info('[Routes Aluguel] Definindo rotas de Alugueis...');

// Aplica autenticação a todas as rotas
router.use(authenticateToken);
logger.debug('[Routes Aluguel] Middleware de Autenticação aplicado a /alugueis/*.');

// POST /api/v1/alugueis/
router.post(
    '/',
    aluguelValidator.validateAluguel,
    handleValidationErrors,
    aluguelValidator.validateBiWeekAlignment,
    aluguelController.createAluguel.bind(aluguelController)
);
logger.debug('[Routes Aluguel] Rota POST / definida (Criar Aluguel).');

// DELETE /api/v1/alugueis/:id
router.delete(
    '/:id',
    aluguelValidator.validateIdParam,
    handleValidationErrors,
    aluguelController.deleteAluguel.bind(aluguelController)
);
logger.debug('[Routes Aluguel] Rota DELETE /:id definida (Apagar Aluguel).');

// GET /api/v1/alugueis/placa/:placaId
router.get(
    '/placa/:placaId',
    aluguelValidator.validatePlacaIdParam,
    handleValidationErrors,
    aluguelController.getAlugueisByPlaca.bind(aluguelController)
);
logger.debug('[Routes Aluguel] Rota GET /placa/:placaId definida (Listar por Placa).');

// GET /api/v1/alugueis/bi-week/:biWeekId
router.get(
    '/bi-week/:biWeekId',
    aluguelController.getAlugueisByBiWeek.bind(aluguelController)
);
logger.debug('[Routes Aluguel] Rota GET /bi-week/:biWeekId definida (Listar por Bi-Semana).');

// GET /api/v1/alugueis/bi-week/:biWeekId/disponiveis
router.get(
    '/bi-week/:biWeekId/disponiveis',
    aluguelController.getPlacasDisponiveisByBiWeek.bind(aluguelController)
);
logger.debug('[Routes Aluguel] Rota GET /bi-week/:biWeekId/disponiveis definida (Placas Disponíveis).');

// GET /api/v1/alugueis/bi-week/:biWeekId/relatorio
router.get(
    '/bi-week/:biWeekId/relatorio',
    aluguelController.getRelatorioOcupacaoBiWeek.bind(aluguelController)
);
logger.debug('[Routes Aluguel] Rota GET /bi-week/:biWeekId/relatorio definida (Relatório de Ocupação).');

logger.info('[Routes Aluguel] Rotas de Alugueis definidas com sucesso.');
logger.debug('[Routes Aluguel] Router exportado.');

export default router;
