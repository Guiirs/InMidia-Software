/**
 * Setup compartilhado para testes de integração HTTP.
 *
 * IMPORTANTE: Este arquivo configura variáveis de ambiente ANTES de qualquer
 * import de módulos da aplicação. O import do `app` é feito estaticamente
 * mas só é avaliado depois que as variáveis estão no processo.
 */

// ── Env vars devem ser configuradas PRIMEIRO ──────────────────────────────────
// O jest.config.js garante que este arquivo roda antes dos testes via setupFilesAfterFramework,
// mas as env vars abaixo são necessárias para que config.ts não chame process.exit(1).
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-arch2';
}
process.env.NODE_ENV = 'test';
// Redis desabilitado — não há servidor Redis nos testes de integração
process.env.REDIS_HOST = '';
process.env.REDIS_ENABLED = 'false';
process.env.REDIS_URL = '';
delete process.env.METRICS_USER;
delete process.env.METRICS_PASSWORD;

// ── Imports após env ──────────────────────────────────────────────────────────

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';

// Import estático do app — ts-jest resolve os aliases corretamente
// dbMongo.ts pula a conexão quando NODE_ENV=test
const app = require('../../shared/infra/http/app').default as import('express').Application;

// Modelos — importados para garantir o registro no Mongoose
import Regiao from '../../modules/regioes/Regiao';
import Placa from '../../modules/placas/Placa';
import Empresa from '../../modules/empresas/Empresa';

export { app };

// ─── IDs fixos para testes ────────────────────────────────────────────────────

export const TEST_EMPRESA_ID = new Types.ObjectId().toString();
export const TEST_USER_ID = new Types.ObjectId().toString();
const registeredTenantIds = new Set<string>([TEST_EMPRESA_ID]);

export async function ensureTestEmpresa(empresaId: string): Promise<void> {
  if (!Types.ObjectId.isValid(empresaId)) {
    return;
  }

  const objectId = new Types.ObjectId(empresaId);
  const existingEmpresa = await Empresa.exists({ _id: objectId });
  if (existingEmpresa) {
    return;
  }

  const cnpj = `${Date.now()}${Math.floor(Math.random() * 1000000)}`
    .slice(0, 14)
    .padEnd(14, '0');

  await Empresa.create({
    _id: objectId,
    nome: `Empresa Teste ${empresaId.slice(-4)}`,
    cnpj,
  });
}

async function ensureRegisteredTestEmpresas(): Promise<void> {
  for (const empresaId of registeredTenantIds) {
    await ensureTestEmpresa(empresaId);
  }
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

export function generateTestToken(overrides?: Partial<{
  id: string;
  empresaId: string;
  role: string;
  email: string;
  username: string;
}>): string {
  const payload = {
    id: overrides?.id ?? TEST_USER_ID,
    empresaId: overrides?.empresaId ?? TEST_EMPRESA_ID,
    role: overrides?.role ?? 'admin',
    email: overrides?.email ?? 'test@inmidia.com',
    username: overrides?.username ?? 'testuser',
  };

  registeredTenantIds.add(payload.empresaId);
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

let mongoServer: MongoMemoryServer;

export async function setupIntegrationDb(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  // Conectar ao in-memory server — sobrescreve qualquer conexão anterior
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
  await ensureRegisteredTestEmpresas();
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(col => col.deleteMany({}))
  );
  await ensureRegisteredTestEmpresas();
}

export async function teardownIntegrationDb(): Promise<void> {
  try {
    const { redisManager } = require('../../config/redis') as typeof import('../../config/redis');
    await redisManager.disconnect();
  } catch {
    // Test teardown must not fail if Redis was never bootstrapped.
  }
  try {
    const { closeMetrics } = require('../../shared/infra/monitoring/metrics') as typeof import('../../shared/infra/monitoring/metrics');
    await closeMetrics();
  } catch {
    // Metrics collectors may not be loaded in narrow unit tests.
  }
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export async function createTestRegiao(overrides?: Record<string, unknown>): Promise<any> {
  const empresaIdValue = overrides?.empresaId
    ? String(overrides.empresaId)
    : TEST_EMPRESA_ID;
  await ensureTestEmpresa(empresaIdValue);

  return Regiao.create({
    nome: 'Região Teste',
    codigo: 'RT',
    ativo: true,
    empresaId: new Types.ObjectId(empresaIdValue),
    ...overrides,
  });
}

export async function createTestPlaca(regiaoId: string, overrides?: Record<string, unknown>): Promise<any> {
  const empresaIdValue = overrides?.empresaId
    ? String(overrides.empresaId)
    : TEST_EMPRESA_ID;
  await ensureTestEmpresa(empresaIdValue);

  return Placa.create({
    numero_placa: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    disponivel: true,
    regiaoId: new Types.ObjectId(regiaoId),
    empresaId: new Types.ObjectId(empresaIdValue),
    localizacao: 'Rua de Teste, 123',
    ...overrides,
  });
}
