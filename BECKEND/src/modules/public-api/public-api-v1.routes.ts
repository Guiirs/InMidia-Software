import { Router } from 'express';
import * as publicApiController from './public-api.controller';
import { requirePublicApiScope } from './middlewares/public-api-auth.middleware';
import { shortCache, availabilityCache, mediaCache } from './middlewares/public-cache.middleware';

/**
 * Canonical public integration API router.
 * Mounted at /public/v1 — routes here have no /v1 prefix.
 *
 * The legacy router (public-api.routes.ts) at /api/v1/public still works
 * for backward compatibility with existing integrations.
 */
const router = Router();

router.get('/catalog',       shortCache, requirePublicApiScope('catalog:read'),             publicApiController.getCatalog);
router.get('/inventory',     shortCache, requirePublicApiScope('inventory:read'),            publicApiController.getInventory);
router.get('/inventory/:id', shortCache, requirePublicApiScope('inventory:read'),            publicApiController.getInventoryItem);
router.get('/availability',  availabilityCache, requirePublicApiScope('inventory:availability'), publicApiController.getAvailability);
router.get('/media/:id',     mediaCache, requirePublicApiScope('media:read'),               publicApiController.getMedia);
router.get('/geo',           shortCache, requirePublicApiScope('geo:read'),                 publicApiController.getGeo);

export default router;
