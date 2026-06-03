import { Router } from 'express';
import {
  requirePublicKey,
  getPlacas,
  getPlacasExport,
  getPlacaBySlug,
  getRegioes,
  getDisponibilidade,
} from './public-plates.controller';
import { getPlacaImagem, imageRateLimiter, publicImageSecurityHeaders } from './public-plates-image.controller';
import { imageAccessMiddleware } from './image-hotlink.middleware';
import { validatePublicApiBaseUrlAtStartup } from './public-plates.presenter';
import { publicApiCacheSafetyMiddleware } from '@modules/public-api/middlewares/public-api-cache-safety.middleware';
import { publicExportRateLimiter } from '@shared/infra/http/middlewares/rate-limit.middleware';

const router = Router();

validatePublicApiBaseUrlAtStartup();

// Apply cache-safety to all authenticated routes: enforces Vary: x-api-key and
// blocks API keys in query strings before any handler or auth middleware runs.
router.get('/placas', publicApiCacheSafetyMiddleware, requirePublicKey, getPlacas);
// Export must be registered BEFORE /:slug to avoid Express matching "export" as a slug param.
router.get('/placas/export', publicApiCacheSafetyMiddleware, publicExportRateLimiter, requirePublicKey, getPlacasExport);
// Image proxy is unauthenticated (WordPress <img src=""> usage) — no safety middleware.
router.get('/placas/:id/imagem', imageRateLimiter, imageAccessMiddleware, publicImageSecurityHeaders, getPlacaImagem);
router.get('/placas/:slug', publicApiCacheSafetyMiddleware, requirePublicKey, getPlacaBySlug);
router.get('/regioes', publicApiCacheSafetyMiddleware, requirePublicKey, getRegioes);
router.get('/disponibilidade', publicApiCacheSafetyMiddleware, requirePublicKey, getDisponibilidade);

export default router;
