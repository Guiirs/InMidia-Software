import { Router } from 'express';
import * as publicApiController from './public-api.controller';
import { requirePublicApiScope } from './middlewares/public-api-auth.middleware';

const router = Router();

router.get('/v1/catalog', requirePublicApiScope('catalog:read'), publicApiController.getCatalog);
router.get('/v1/inventory', requirePublicApiScope('inventory:read'), publicApiController.getInventory);
router.get('/v1/inventory/:id', requirePublicApiScope('inventory:read'), publicApiController.getInventoryItem);
router.get('/v1/availability', requirePublicApiScope('inventory:availability'), publicApiController.getAvailability);
router.get('/v1/media/:id', requirePublicApiScope('media:read'), publicApiController.getMedia);
router.get('/v1/geo', requirePublicApiScope('geo:read'), publicApiController.getGeo);

// Compatibilidade com a rota publica anterior. A resposta agora passa pelo presenter publico.
router.get('/placas/disponiveis', requirePublicApiScope('inventory:read'), publicApiController.getAvailablePlacas);

export default router;
