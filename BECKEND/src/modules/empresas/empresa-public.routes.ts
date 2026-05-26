/**
 * Empresa Public Routes
 * Rotas publicas de empresas (sem autenticacao)
 */

import { Router } from 'express';
import { z } from 'zod';
import Empresa from './Empresa';
import { EmpresaRepository } from './repositories/empresa.repository';
import { EmpresaService } from './services/empresa.service';
import { EmpresaController } from './empresa.controller';
import logger from '@shared/container/logger';
import { validate } from '@shared/infra/http/middlewares/validate.middleware';

const router = Router();

const repository = new EmpresaRepository(Empresa);
const service = new EmpresaService(repository);
const controller = new EmpresaController(service);

const registerSchema = z.object({
  body: z.object({
    nome_empresa: z.string().trim().min(1).max(200),
    cnpj: z.string().trim().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/, 'CNPJ invalido'),
    email: z.string().trim().email('Email invalido'),
    password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
    username: z.string().trim().min(3).max(50),
    nome: z.string().trim().min(1).max(100),
    sobrenome: z.string().trim().min(1).max(100),
  }),
});

router.post('/register', validate(registerSchema), controller.register);

logger.info('[Routes EmpresaPublic] Rota POST /register definida com validacao.');

export default router;
