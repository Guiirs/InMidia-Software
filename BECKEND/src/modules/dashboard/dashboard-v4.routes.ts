/**
 * Dashboard V4 Routes — serviço nativo V4.
 *
 * Frontend mapping (dashboardV4Service.js):
 *   getDashboardKpis          → GET /api/v4/dashboard/kpis
 *   getDashboardOverview      → GET /api/v4/dashboard/overview
 *   getDashboardActivity      → GET /api/v4/dashboard/activity
 *   getDashboardPerformance   → GET /api/v4/dashboard/performance
 *   getDashboardAlertsSummary → GET /api/v4/dashboard/alerts-summary
 */

import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { DashboardV4Service } from './dashboard-v4.service';
import { DashboardV4Controller } from './dashboard-v4.controller';

const router = Router();
const controller = new DashboardV4Controller(new DashboardV4Service());

router.use(authenticateToken, requireTenantGuard);

router.get('/kpis',          requirePermission('dashboard.read'), controller.getKpis);
router.get('/overview',      requirePermission('dashboard.read'), controller.getOverview);
router.get('/activity',      requirePermission('dashboard.read'), controller.getActivity);
router.get('/performance',   requirePermission('dashboard.read'), controller.getPerformance);
router.get('/alerts-summary', requirePermission('dashboard.read'), controller.getAlertsSummary);

export default router;
