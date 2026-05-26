// @ts-nocheck
/**
 * Public API Routes
 * Rotas públicas com validação de API Key
 */

import { Router } from 'express';
import { PublicApiRepository } from './repositories/public-api.repository';
import { PublicApiService } from './services/public-api.service.refactored';
import { PublicApiController } from './controllers/public-api.controller.refactored';

const router = Router();

// Dependency Injection
const repository = new PublicApiRepository();
const service = new PublicApiService(repository);
const controller = new PublicApiController(service);

// GET /api/public/placas/:placa - Buscar informações de uma placa
router.get('/placas/:placa', controller.getPlacaInfo);

// POST /api/public/placas - Registrar nova placa
router.post(
  '/placas',
  controller.registerPlaca
);

// GET /api/public/placas/:placa/disponibilidade - Verificar disponibilidade
router.get('/placas/:placa/disponibilidade', controller.checkAvailability);

// POST /api/public/validate-key - Validar API key
router.post('/validate-key', controller.validateApiKey);

export default router;
