/**
 * Empresa Routes
 * Rotas HTTP com Dependency Injection
 */

import { Router, Request, Response } from 'express';
import Empresa from './Empresa';
import { EmpresaRepository } from './repositories/empresa.repository';
import { EmpresaService } from './services/empresa.service';
import { EmpresaController } from './empresa.controller';
import authMiddleware from '@middlewares/auth.middleware';

const router = Router();

// Dependency Injection
const repository = new EmpresaRepository(Empresa);
const service = new EmpresaService(repository);
const controller = new EmpresaController(service);

// Sistema single-tenant: cadastro publico desativado
router.post('/register', (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Cadastro publico desativado. Use a credencial master para acessar o sistema.',
    code: 'PUBLIC_REGISTRATION_DISABLED',
  });
});

// Todas as rotas requerem autenticacao
router.use(authMiddleware);

// GET /api/v1/empresas/api-key - Busca API Key
router.get('/api-key', controller.getApiKey);

// POST /api/v1/empresas/api-key/regenerate - Regenera API Key
router.post('/api-key/regenerate', controller.regenerateApiKey);

// GET /api/v1/empresas/details - Busca detalhes da empresa
router.get('/details', controller.getEmpresaDetails);

// PATCH /api/v1/empresas/details - Atualiza detalhes da empresa
router.patch('/details', controller.updateEmpresaDetails);

export default router;
