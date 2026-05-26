import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { CommercialV4Controller } from './controllers/commercial-v4.controller';
import { CommercialV4Service } from './services/commercial-v4.service';

const router = Router();
const controller = new CommercialV4Controller(new CommercialV4Service());

router.use(authenticateToken, requireTenantGuard);

router.get('/pipeline',       requirePermission('commercial.read'), controller.getPipeline);
router.get('/opportunities',  requirePermission('commercial.read'), controller.listOpportunities);
router.get('/proposals',      requirePermission('commercial.read'), controller.listProposals);
router.get('/conversions',    requirePermission('commercial.read'), controller.getConversions);
router.get('/activities',     requirePermission('commercial.read'), controller.listActivities);

router.post('/opportunities',             requirePermission('commercial.create'), controller.createOpportunity);
router.patch('/opportunities/:id',        requirePermission('commercial.update'), controller.updateOpportunity);
router.patch('/opportunities/:id/stage',  requirePermission('commercial.update'), controller.changeOpportunityStage);
router.post('/proposals',                 requirePermission('commercial.create'), controller.createProposal);
router.patch('/proposals/:id',            requirePermission('commercial.update'), controller.updateProposal);
router.post('/proposals/:id/convert',     requirePermission('commercial.convert'), controller.convertProposal);
router.post('/activities',                requirePermission('commercial.create'), controller.createActivity);

export default router;
