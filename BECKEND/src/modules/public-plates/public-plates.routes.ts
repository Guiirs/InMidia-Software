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

const router = Router();

validatePublicApiBaseUrlAtStartup();

router.get('/placas', requirePublicKey, getPlacas);
// Proxy público de imagem — SEM requirePublicKey (WordPress/JetEngine usa <img src="">)
router.get('/placas/:id/imagem', imageRateLimiter, imageAccessMiddleware, getPlacaImagem);
router.get('/placas/:slug', requirePublicKey, getPlacaBySlug);
router.get('/regioes', requirePublicKey, getRegioes);
router.get('/disponibilidade', requirePublicKey, getDisponibilidade);

export default router;
