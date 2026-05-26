/**
 * Testes de Integração HTTP — Regiões
 *
 * Contratos verificados:
 *   1. GET /regioes retorna shape canônico com id e nome
 *   2. Limite padrão não trava frontend com < 50 regiões
 *   3. limit=500 aceito (após aumento do limite)
 *   4. limit=501 retornado como 400
 */

import request from 'supertest';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  createTestRegiao,
  generateTestToken,
} from './setup';

let token: string;

beforeAll(async () => {
  await setupIntegrationDb();
  token = generateTestToken();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

// ─── GET /api/v1/regioes ──────────────────────────────────────────────────────

describe('GET /api/v1/regioes', () => {
  it('requer autenticação — 401 sem token', async () => {
    const res = await request(app).get('/api/v1/regioes');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com array de regiões', async () => {
    await createTestRegiao({ nome: 'Norte', codigo: 'N' });

    const res = await request(app)
      .get('/api/v1/regioes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
  });

  it('retorna shape canônico: id, nome, ativo', async () => {
    await createTestRegiao({ nome: 'Norte', codigo: 'N' });

    const res = await request(app)
      .get('/api/v1/regioes')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    const item = data[0];
    expect(typeof (item.id ?? item._id)).toBe('string');
    expect(typeof item.nome).toBe('string');
    expect(typeof item.ativo).toBe('boolean');
  });

  it('não retorna lista vazia quando há regiões (regressão do dropdown)', async () => {
    for (let i = 0; i < 5; i++) {
      await createTestRegiao({ nome: `Região ${i}`, codigo: `R${i}` });
    }

    const res = await request(app)
      .get('/api/v1/regioes')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    expect(data.length).toBe(5);
  });

  it('aceita limit=500 (limite aumentado na ARCH-2)', async () => {
    await createTestRegiao();

    const res = await request(app)
      .get('/api/v1/regioes?limit=500')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(400);
    expect(res.status).toBe(200);
  });

  it('retorna 400 para limit > 500', async () => {
    const res = await request(app)
      .get('/api/v1/regioes?limit=501')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('default limit=100 retorna até 100 resultados (ARCH-2: aumentado de 50)', async () => {
    for (let i = 0; i < 120; i++) {
      await createTestRegiao({ nome: `Região ${i}`, codigo: `R${String(i).padStart(3, '0')}` });
    }

    const res = await request(app)
      .get('/api/v1/regioes')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    // Default é 100 — não deve retornar mais que 100
    expect(data.length).toBeLessThanOrEqual(100);
    // E deve retornar 100 quando há mais que 100
    expect(data.length).toBe(100);
  });

  it('paginação funciona — page=2 retorna resultado diferente de page=1', async () => {
    for (let i = 0; i < 60; i++) {
      await createTestRegiao({ nome: `Região ${i}`, codigo: `R${String(i).padStart(2, '0')}` });
    }

    const res1 = await request(app)
      .get('/api/v1/regioes?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    const res2 = await request(app)
      .get('/api/v1/regioes?page=2&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const data1 = res1.body.data ?? res1.body;
    const data2 = res2.body.data ?? res2.body;

    const ids1 = data1.map((r: any) => r.id ?? r._id);
    const ids2 = data2.map((r: any) => r.id ?? r._id);

    // As páginas não devem ter os mesmos itens
    expect(ids1).not.toEqual(expect.arrayContaining(ids2));
  });

  it('filtra por ativo=true', async () => {
    await createTestRegiao({ nome: 'Ativa', codigo: 'AT', ativo: true });
    await createTestRegiao({ nome: 'Inativa', codigo: 'IN', ativo: false });

    const res = await request(app)
      .get('/api/v1/regioes?ativo=true')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    expect(data.every((r: any) => r.ativo === true)).toBe(true);
  });
});
