/**
 * BiWeeks Routes (legacy filename)
 */
import { Router } from 'express';
import * as biWeekController from './bi-week.controller';
import * as biWeekValidator from '@validators/biWeekValidator';
import authMiddleware from '@middlewares/auth.middleware';
import adminAuthMiddleware from '@middlewares/admin-auth.middleware';
import { handleValidationErrors } from '@modules/auth/authValidator';

const router = Router();

/**
 * Rotas para gerenciamento do calendário de Bi-Semanas (períodos de 14 dias)
 * Base URL: /api/v1/bi-weeks
 */

// =============================================================================
// ROTAS PÚBLICAS (Autenticação apenas)
// =============================================================================

/**
 * GET /api/v1/bi-weeks/calendar
 * Retorna o calendário completo de Bi-Semanas
 * Query params: ?ano=2026&ativo=true
 */
router.get(
    '/calendar',
    authMiddleware,
    ...biWeekValidator.calendarFilterValidationRules,
    handleValidationErrors,
    biWeekController.getCalendar
);

/**
 * GET /api/v1/bi-weeks/years
 * Retorna lista de anos disponíveis no calendário
 */
router.get(
    '/years',
    authMiddleware,
    biWeekController.getYears
);

/**
 * GET /api/v1/bi-weeks/find-by-date
 * Busca a Bi-Semana que contém uma data específica
 * Query param: ?date=2026-01-15
 */
router.get(
    '/find-by-date',
    authMiddleware,
    ...biWeekValidator.findByDateValidationRules,
    handleValidationErrors,
    biWeekController.findByDate
);

/**
 * POST /api/v1/bi-weeks/validate
 * Valida se um período está alinhado com Bi-Semanas
 * Body: { "start_date": "2026-01-01", "end_date": "2026-01-14" }
 */
router.post(
    '/validate',
    authMiddleware,
    ...biWeekValidator.validatePeriodRules,
    handleValidationErrors,
    biWeekController.validatePeriod
);

/**
 * GET /api/v1/bi-weeks/:id
 * Retorna uma Bi-Semana específica por ID (ObjectId ou bi_week_id)
 */
router.get(
    '/:id',
    authMiddleware,
    ...biWeekValidator.idValidationRules,
    handleValidationErrors,
    biWeekController.getBiWeekById
);

// =============================================================================
// ROTAS ADMINISTRATIVAS (Requerem permissão de admin)
// =============================================================================

/**
 * POST /api/v1/bi-weeks
 * Cria uma nova Bi-Semana
 * Body: { "bi_week_id": "2026-01", "ano": 2026, "numero": 1, "start_date": "2026-01-01", "end_date": "2026-01-14" }
 */
router.post(
    '/',
    authMiddleware,
    adminAuthMiddleware,
    ...biWeekValidator.createBiWeekValidationRules,
    handleValidationErrors,
    biWeekController.createBiWeek
);

/**
 * PUT /api/v1/bi-weeks/:id
 * Atualiza uma Bi-Semana existente
 * Body: { "descricao": "Nova descrição", "ativo": false }
 */
router.put(
    '/:id',
    authMiddleware,
    adminAuthMiddleware,
    ...biWeekValidator.updateBiWeekValidationRules,
    handleValidationErrors,
    biWeekController.updateBiWeek
);

/**
 * DELETE /api/v1/bi-weeks/:id
 * Deleta uma Bi-Semana
 */
router.delete(
    '/:id',
    authMiddleware,
    adminAuthMiddleware,
    ...biWeekValidator.idValidationRules,
    handleValidationErrors,
    biWeekController.deleteBiWeek
);

/**
 * POST /api/v1/bi-weeks/generate
 * Gera automaticamente o calendário de Bi-Semanas para um ano
 * Body: { "ano": 2027, "overwrite": false }
 */
router.post(
    '/generate',
    authMiddleware,
    adminAuthMiddleware,
    ...biWeekValidator.generateCalendarValidationRules,
    handleValidationErrors,
    biWeekController.generateCalendar
);

export default router;
