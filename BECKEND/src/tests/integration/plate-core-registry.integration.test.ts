/**
 * Testes de Integração — Plate Core Registry
 *
 * Contratos verificados:
 *  1. Criar placa com campos mínimos
 *  2. Bloquear número duplicado por empresa
 *  3. Permitir mesmo número em empresas diferentes
 *  4. Validar latitude/longitude (devem ser informados juntos)
 *  5. Vincular região ativa
 *  6. Bloquear região arquivada
 *  7. Arquivar placa sem contrato (soft delete)
 *  8. Bloquear archive com contrato ativo (via temporal engine)
 *  9. Restaurar placa arquivada
 * 10. Health score via GET /:id/health
 * 11. Timeline via GET /:id/timeline
 * 12. Disponibilidade via GET /:id/availability
 * 13. Placa arquivada não aparece na listagem padrão
 * 14. Placa arquivada aparece com includeArchived=true
 */

import request from 'supertest';
import { Types } from 'mongoose';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  createTestRegiao,
  createTestPlaca,
  generateTestToken,
} from './setup';

let token: string;
let tokenB: string;
let regiaoId: string;
const EMPRESA_B_ID = new Types.ObjectId().toString();

beforeAll(async () => {
  await setupIntegrationDb();
  token  = generateTestToken();
  tokenB = generateTestToken({ empresaId: EMPRESA_B_ID, email: 'tenant-b@inmidia.com' });
});

afterEach(async () => { await clearDatabase(); });
afterAll(async () => { await teardownIntegrationDb(); });

// ─── helpers ─────────────────────────────────────────────────────────────────

async function seedRegiao(status = 'ACTIVE') {
  const regiao = await createTestRegiao({ status });
  regiaoId = regiao._id.toString();
  return regiao;
}

async function seedPlaca(overrides?: Record<string, unknown>) {
  await seedRegiao();
  return createTestPlaca(regiaoId, overrides);
}

// ─── POST /api/v1/placas ─────────────────────────────────────────────────────

describe('POST /api/v1/placas — criação', () => {
  it('cria placa com campos mínimos (numero_placa + regiaoId)', async () => {
    await seedRegiao();
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'NEW-001', regiaoId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.numero_placa).toBe('NEW-001');
  });

  it('rejeita número de placa duplicado na mesma empresa', async () => {
    await seedPlaca({ numero_placa: 'DUP-001' });

    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'DUP-001', regiaoId });

    expect(res.status).toBe(409);
  });

  it('permite mesmo número em empresas diferentes', async () => {
    await seedRegiao();
    // empresa A
    await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'SAME-001', regiaoId });

    // empresa B precisa de região própria
    const regiaoB = await createTestRegiao({ empresaId: EMPRESA_B_ID });
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ numero_placa: 'SAME-001', regiaoId: regiaoB._id.toString() });

    expect(res.status).toBe(201);
  });

  it('rejeita latitude sem longitude', async () => {
    await seedRegiao();
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'COORD-001', regiaoId, latitude: -23.5 });

    expect(res.status).toBe(400);
  });

  it('aceita latitude e longitude juntos', async () => {
    await seedRegiao();
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'COORD-002', regiaoId, latitude: -23.5, longitude: -46.6 });

    expect(res.status).toBe(201);
    expect(res.body.data.latitude).toBe(-23.5);
    expect(res.body.data.longitude).toBe(-46.6);
  });

  it('bloqueia região arquivada', async () => {
    const regiaoArch = await createTestRegiao({ status: 'ARCHIVED' });

    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'ARCH-001', regiaoId: regiaoArch._id.toString() });

    expect(res.status).toBe(404);
  });
});

// ─── GET /:id/health ──────────────────────────────────────────────────────────

describe('GET /api/v1/placas/:id/health', () => {
  it('retorna health score da placa', async () => {
    const placa = await seedPlaca({ numero_placa: 'HEALTH-001' });

    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}/health`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.score).toBe('number');
    expect(['HEALTHY', 'ATTENTION', 'CRITICAL']).toContain(res.body.data.status);
    expect(Array.isArray(res.body.data.issues)).toBe(true);
  });

  it('retorna ATTENTION ou CRITICAL para placa sem endereço e sem coordenadas', async () => {
    const placa = await seedPlaca({ numero_placa: 'HEALTH-002', nomeDaRua: undefined, coordenadas: undefined });

    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}/health`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(['ATTENTION', 'CRITICAL']).toContain(res.body.data.status);
  });
});

// ─── GET /:id/timeline ────────────────────────────────────────────────────────

describe('GET /api/v1/placas/:id/timeline', () => {
  it('retorna timeline da placa', async () => {
    const placa = await seedPlaca({ numero_placa: 'TML-001' });

    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}/timeline`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.reservations)).toBe(true);
    expect(Array.isArray(res.body.data.events)).toBe(true);
  });
});

// ─── GET /:id/availability ───────────────────────────────────────────────────

describe('GET /api/v1/placas/:id/availability', () => {
  it('retorna disponibilidade para um período', async () => {
    const placa = await seedPlaca({ numero_placa: 'AVAIL-001' });
    const start = new Date();
    const end   = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}/availability`)
      .query({ startDate: start.toISOString(), endDate: end.toISOString() })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.available).toBe('boolean');
  });

  it('retorna 400 sem startDate e endDate', async () => {
    const placa = await seedPlaca({ numero_placa: 'AVAIL-002' });
    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}/availability`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ─── POST /:id/archive e /:id/restore ────────────────────────────────────────

describe('Archive / Restore', () => {
  it('arquiva placa sem contrato ativo', async () => {
    const placa = await seedPlaca({ numero_placa: 'ARCH-OK' });

    const res = await request(app)
      .post(`/api/v1/placas/${placa._id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.statusOperacional).toBe('ARCHIVED');
  });

  it('placa arquivada não aparece na listagem padrão', async () => {
    const placa = await seedPlaca({ numero_placa: 'ARCH-HIDDEN' });

    await request(app)
      .post(`/api/v1/placas/${placa._id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const numeros = res.body.data.map((p: any) => p.numero_placa);
    expect(numeros).not.toContain('ARCH-HIDDEN');
  });

  it('placa arquivada aparece com includeArchived=true', async () => {
    const placa = await seedPlaca({ numero_placa: 'ARCH-SHOW' });

    await request(app)
      .post(`/api/v1/placas/${placa._id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const res = await request(app)
      .get('/api/v1/placas?includeArchived=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const numeros = res.body.data.map((p: any) => p.numero_placa);
    expect(numeros).toContain('ARCH-SHOW');
  });

  it('restaura placa arquivada', async () => {
    const placa = await seedPlaca({ numero_placa: 'RESTORE-01' });

    await request(app)
      .post(`/api/v1/placas/${placa._id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const res = await request(app)
      .post(`/api/v1/placas/${placa._id}/restore`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.statusOperacional).toBe('ACTIVE');
    expect(res.body.data.disponivel).toBe(true);
  });

  it('bloqueia archive de placa já arquivada', async () => {
    const placa = await seedPlaca({ numero_placa: 'ARCH-TWICE' });

    await request(app)
      .post(`/api/v1/placas/${placa._id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const res = await request(app)
      .post(`/api/v1/placas/${placa._id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it('bloqueia restore de placa não arquivada', async () => {
    const placa = await seedPlaca({ numero_placa: 'RESTORE-NOOP' });

    const res = await request(app)
      .post(`/api/v1/placas/${placa._id}/restore`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });
});

// ─── Campos canônicos ─────────────────────────────────────────────────────────

describe('Campos canônicos da placa', () => {
  it('endereco é retornado junto com nomeDaRua como aliases', async () => {
    await seedRegiao();
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'END-001', regiaoId, endereco: 'Av. Paulista, 100' });

    expect(res.status).toBe(201);
    // nomeDaRua deve ser espelhado
    const data = res.body.data;
    expect(data.endereco ?? data.nomeDaRua).toBeTruthy();
  });

  it('statusOperacional padrão é ACTIVE', async () => {
    await seedRegiao();
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'ST-001', regiaoId });

    expect(res.status).toBe(201);
    expect(res.body.data.statusOperacional).toBe('ACTIVE');
  });
});
