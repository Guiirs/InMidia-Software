import { Router } from 'express';
import authenticateToken from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import Placa from '@modules/placas/Placa';
import Aluguel from '@modules/alugueis/Aluguel';
import Regiao from '@modules/regioes/Regiao';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import Contrato from '@modules/contratos/Contrato';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

const router = Router();
const service = new DashboardService(Placa, Aluguel, Regiao, PropostaInterna, Contrato);
const controller = new DashboardController(service);

router.use(authenticateToken, requireTenantGuard);

router.get('/overview', requirePermission('dashboard.read'), controller.getOverview);
router.get('/placas-mais-alugadas', requirePermission('dashboard.read'), controller.getMostRentedBoards);
router.get('/placas-paradas', requirePermission('dashboard.read'), controller.getIdleBoards);
router.get('/regioes-performance', requirePermission('dashboard.read'), controller.getRegionPerformance);
router.get('/funil-comercial', requirePermission('dashboard.read'), controller.getSalesFunnel);
router.get('/alertas', requirePermission('dashboard.read'), controller.getAlerts);

export default router;
