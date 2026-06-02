import { Router, type Request, type Response, type NextFunction } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { privateApiRateLimiter } from '@shared/infra/http/middlewares/rate-limit.middleware';

import userRoutes from '@modules/users/user.routes';
import empresaRoutes from '@modules/empresas/empresa.routes';
import clienteRoutes from '@modules/clientes/cliente.routes';
import placaRoutes from '@modules/placas/placas.routes';
import regiaoRoutes from '@modules/regioes/regiao.routes';
import aluguelRoutes from '@modules/alugueis/aluguel.routes';
import piRoutes from '@modules/propostas-internas/pi.routes';
import contratoRoutes from '@modules/contratos/contrato.routes';
import contractsV4Routes from '@modules/contratos/contracts-v4.routes';
import boardContractsV4Routes from '@modules/contratos/board-contracts-v4.routes';
import biWeekRoutes from '@modules/biweeks/biWeeks.routes';
import webhookRoutes from '@modules/webhooks/webhook.routes';
import relatorioRoutes from '@modules/relatorios/relatorios.routes';
import adminRoutes from '@modules/admin/admin.routes';
import checkingRoutes from '@modules/checking/checking.routes';
import queueRoutes from '@modules/system/queue/queue.routes';
import sseRoutes from '@modules/system/sse/sse.routes';
import realtimeHealthRoutes from '@modules/system/realtime-health.routes';
import syncRoutes from '@modules/sync/sync.routes';
import dashboardRoutes from '@modules/dashboard/dashboard.routes';
import auditRoutes from '@modules/audit/audit.routes';
import enterpriseBIRoutes from '@modules/enterprise-bi/enterprise-bi.routes';
import exportRoutes from '@modules/export/routes/export.routes';
import marketplaceRoutes from '@modules/marketplace/routes/marketplace.routes';
import inventoryRoutes from '@modules/inventory/inventory.routes';
import realtimeRoutes from '@modules/realtime/realtime.routes';
import sessionV4Routes from '@modules/auth/session-v4.routes';
import dashboardV4Routes from '@modules/dashboard/dashboard-v4.routes';
import commercialV4Routes from '@modules/commercial/commercial-v4.routes';
import reportsV4Routes from '@modules/relatorios/reports-v4.routes';
import alertsV4Routes from '@modules/alerts/alerts-v4.routes';
import operationsV4Routes from '@modules/operations/operations-v4.routes';
import featuresV4Routes from '@modules/features/features-v4.routes';
import activityV4Routes from '@modules/activity/activity-v4.routes';
import campaignsV4Routes from '@modules/campaigns/campaigns-v4.routes';
import rbacRoutes from '@modules/auth/rbac.routes';
import temporalRoutes from '@modules/temporal/temporal.routes';
import regionsRoutes from '@modules/regions/regions.routes';
import clientsV4Routes from '@modules/clientes/clients.routes';
import mediaRoutes from '@modules/media/media.routes';
import diagnosticsRoutes from '@modules/diagnostics/diagnostics.routes';
import commercialProjectionRoutes from '@modules/commercial-projection/commercial-projection.routes';
import { FEATURES } from '@config/features';
import { isPublicPathForbiddenInPrivateApi, PRIVATE_API_MOUNTS } from './private-api.contract';

const router = Router();
const disabledRouter = Router();
const whatsappRoutes: Router = FEATURES.whatsapp
  ? (require('@modules/whatsapp/whatsapp.routes').default as Router)
  : disabledRouter;

function blockPublicResources(req: Request, res: Response, next: NextFunction): void {
  if (isPublicPathForbiddenInPrivateApi(req.path)) {
    res.status(404).json({
      success: false,
      code: 'PRIVATE_API_PUBLIC_RESOURCE_FORBIDDEN',
      message: 'Recurso publico nao esta disponivel na API privada.',
    });
    return;
  }
  next();
}

router.use(blockPublicResources);
router.use(authenticateToken, requireTenantGuard, privateApiRateLimiter);

router.get('/_meta', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      boundary: 'private',
      basePath: '/api/v1/private',
      protections: ['JWT', 'RBAC', 'tenant', 'private-rate-limit'],
      publicResourcesMounted: false,
      mounts: PRIVATE_API_MOUNTS,
    },
  });
});

router.use('/user', userRoutes);
router.use('/users', userRoutes);
router.use('/empresas', empresaRoutes);
router.use('/empresa', empresaRoutes);
router.use('/admin', adminRoutes);
router.use('/audit', auditRoutes);
router.use('/placas', placaRoutes);
router.use('/regioes', regiaoRoutes);
router.use('/clientes', clienteRoutes);
router.use('/alugueis', aluguelRoutes);
router.use('/pis', piRoutes);
router.use('/contratos', contratoRoutes);
router.use('/bi-weeks', biWeekRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/relatorios', relatorioRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/contracts', contractsV4Routes);
router.use('/boards', boardContractsV4Routes);
router.use('/session', sessionV4Routes);
router.use('/dashboard-v4', dashboardV4Routes);
router.use('/temporal', temporalRoutes);
router.use('/regions', regionsRoutes);
router.use('/clients', clientsV4Routes);
router.use('/media', mediaRoutes);
router.use('/features', featuresV4Routes);
router.use('/alerts', alertsV4Routes);
router.use('/operations', operationsV4Routes);
router.use('/commercial', commercialV4Routes);
router.use('/reports', reportsV4Routes);
router.use('/activity', activityV4Routes);
router.use('/campaigns', campaignsV4Routes);
router.use('/realtime', realtimeRoutes);
router.use('/system', realtimeHealthRoutes);
router.use('/checking', checkingRoutes);
router.use('/diagnostics', diagnosticsRoutes);
router.use('/commercial-projection', commercialProjectionRoutes);
router.use('/queue', queueRoutes);
router.use('/sse', sseRoutes);
router.use('/sync', syncRoutes);
router.use('/enterprise-bi', enterpriseBIRoutes);
router.use('/exports', exportRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/rbac', rbacRoutes);

export default router;
