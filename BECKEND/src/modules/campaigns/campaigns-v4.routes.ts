import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { CampaignsV4Controller } from './controllers/campaigns-v4.controller';
import { CampaignsV4Service } from './services/campaigns-v4.service';

const router = Router();
const controller = new CampaignsV4Controller(new CampaignsV4Service());

router.use(authenticateToken, requireTenantGuard);

router.get('/summary',     requirePermission('campaigns.read'), controller.getSummary);
router.get('/',            requirePermission('campaigns.read'), controller.listCampaigns);
router.get('/active',      requirePermission('campaigns.read'), controller.getActive);
router.get('/scheduled',   requirePermission('campaigns.read'), controller.getScheduled);
router.get('/performance', requirePermission('campaigns.read'), controller.getPerformance);

router.post('/',                   requirePermission('campaigns.create'), controller.createCampaign);
router.patch('/:id',               requirePermission('campaigns.update'), controller.updateCampaign);
router.patch('/:id/pause',         requirePermission('campaigns.update'), controller.pauseCampaign);
router.patch('/:id/activate',      requirePermission('campaigns.update'), controller.activateCampaign);
router.delete('/:id',              requirePermission('campaigns.delete'), controller.deleteCampaign);

export default router;
