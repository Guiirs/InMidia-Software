import { Router, Request, Response, NextFunction } from 'express';
import * as publicApiController from './public-api.controller';
import { requirePublicApiScope } from './middlewares/public-api-auth.middleware';
import { shortCache, availabilityCache, mediaCache } from './middlewares/public-cache.middleware';
import { getPlacaById, getPlacas, requirePublicKey } from '@modules/public-plates/public-plates.controller';
import { getPlacaImagem, imageRateLimiter } from '@modules/public-plates/public-plates-image.controller';
import { imageAccessMiddleware } from '@modules/public-plates/image-hotlink.middleware';

const router = Router();

// Deprecation notice: this path is the legacy route. Canonical path is /public/v1/*.
function deprecationWarning(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</public/v1>; rel="successor-version"');
  next();
}

router.use(deprecationWarning);

// Routes prefixed with /v1 when mounted under /api/v1/public (legacy path).
router.get('/v1/catalog', shortCache, requirePublicApiScope('catalog:read'), publicApiController.getCatalog);
router.get('/v1/inventory', shortCache, requirePublicApiScope('inventory:read'), publicApiController.getInventory);
router.get('/v1/inventory/:id', shortCache, requirePublicApiScope('inventory:read'), publicApiController.getInventoryItem);
router.get('/v1/availability', availabilityCache, requirePublicApiScope('inventory:availability'), publicApiController.getAvailability);
router.get('/v1/media/:id', mediaCache, requirePublicApiScope('media:read'), publicApiController.getMedia);
router.get('/v1/geo', shortCache, requirePublicApiScope('geo:read'), publicApiController.getGeo);

// Legacy compatibility routes kept for existing integrations.
router.get('/placas/disponiveis', shortCache, requirePublicApiScope('inventory:read'), publicApiController.getAvailablePlacas);
router.get('/placas', shortCache, requirePublicKey, getPlacas);
// Proxy público de imagem — SEM requirePublicKey (WordPress/JetEngine usa <img src="">)
router.get('/placas/:id/imagem', imageRateLimiter, imageAccessMiddleware, getPlacaImagem);
router.get('/placas/:id', shortCache, requirePublicKey, getPlacaById);

export default router;
