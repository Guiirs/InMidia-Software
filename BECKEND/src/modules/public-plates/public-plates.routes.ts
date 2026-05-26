import { Router } from 'express';
import {
  requirePublicKey,
  getPlacas,
  getPlacaBySlug,
  getRegioes,
  getDisponibilidade,
} from './public-plates.controller';

const router = Router();

router.get('/placas', requirePublicKey, getPlacas);
router.get('/placas/:slug', requirePublicKey, getPlacaBySlug);
router.get('/regioes', requirePublicKey, getRegioes);
router.get('/disponibilidade', requirePublicKey, getDisponibilidade);

export default router;
