import { Router } from 'express';
import {
  requirePublicKey,
  getPlacas,
  getPlacaBySlug,
  getRegioes,
  getDisponibilidade,
} from './public-plates.controller';
import { getPlacaImagem, imageRateLimiter } from './public-plates-image.controller';
import { imageAccessMiddleware } from './image-hotlink.middleware';
import { validatePublicApiBaseUrlAtStartup } from './public-plates.presenter';
import { publicApiCacheSafetyMiddleware } from '@modules/public-api/middlewares/public-api-cache-safety.middleware';

const router = Router();

validatePublicApiBaseUrlAtStartup();

// Apply cache-safety to all authenticated routes: enforces Vary: x-api-key and
// blocks API keys in query strings before any handler or auth middleware runs.
router.get('/placas', publicApiCacheSafetyMiddleware, requirePublicKey, getPlacas);
// Image proxy is unauthenticated (WordPress <img src=""> usage) — no safety middleware.
router.get('/placas/:id/imagem', imageRateLimiter, imageAccessMiddleware, getPlacaImagem);
router.get('/placas/:slug', publicApiCacheSafetyMiddleware, requirePublicKey, getPlacaBySlug);
router.get('/regioes', publicApiCacheSafetyMiddleware, requirePublicKey, getRegioes);
router.get('/disponibilidade', publicApiCacheSafetyMiddleware, requirePublicKey, getDisponibilidade);

export default router;
