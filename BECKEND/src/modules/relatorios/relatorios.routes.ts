/**
 * Relatorios Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router } from 'express';
import Placa from '@modules/placas/Placa';
import Aluguel from '@modules/alugueis/Aluguel';
import Regiao from '@modules/regioes/Regiao';
import Cliente from '@modules/clientes/Cliente';
import { RelatorioRepository } from './repositories/relatorio.repository';
import { RelatorioService } from './services/relatorio.service';
import { RelatorioController } from './controllers/relatorio.controller';
import authenticateToken from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';

const router = Router();

// Dependency Injection
const repository = new RelatorioRepository(Placa, Aluguel, Regiao, Cliente);
const service = new RelatorioService(repository);
const controller = new RelatorioController(service);

// Todas as rotas requerem autenticação
router.use(authenticateToken, requireTenantGuard);

// GET /api/v1/relatorios/dashboard-summary - Resumo do dashboard
router.get(
  '/dashboard-summary',
  requirePermission('relatorios.read'),
  controller.getDashboardSummary
);

// GET /api/v1/relatorios/placas-por-regiao - Placas agrupadas por região
router.get(
  '/placas-por-regiao',
  requirePermission('relatorios.read'),
  controller.getPlacasPorRegiao
);

// GET /api/v1/relatorios/ocupacao-por-periodo - Ocupação por período
router.get(
  '/ocupacao-por-periodo',
  requirePermission('relatorios.read'),
  controller.getOcupacaoPorPeriodo
);

export default router;
