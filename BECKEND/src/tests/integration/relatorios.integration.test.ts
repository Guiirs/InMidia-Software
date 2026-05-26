/**
 * Testes de Integração HTTP — Relatórios / Dashboard
 *
 * Contratos verificados:
 *   1. GET /dashboard-summary retorna totalPlacas, placasDisponiveis, regiaoPrincipal
 *   2. placasDisponiveis <= totalPlacas (invariante de negócio)
 *   3. GET /placas-por-regiao retorna array com regiao e total_placas
 *   4. Totais batem com os dados inseridos
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
let tokenEmpresaB: string;
const EMPRESA_B_ID = new Types.ObjectId().toString();

beforeAll(async () => {
  await setupIntegrationDb();
  token = generateTestToken();
  tokenEmpresaB = generateTestToken({ empresaId: EMPRESA_B_ID, email: 'rel-b@inmidia.com' });
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

// ─── GET /api/v1/relatorios/dashboard-summary ────────────────────────────────

describe('GET /api/v1/relatorios/dashboard-summary', () => {
  it('requer autenticação — 401 sem token', async () => {
    const res = await request(app).get('/api/v1/relatorios/dashboard-summary');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com shape canônico', async () => {
    const res = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data ?? res.body;
    expect(typeof data.totalPlacas).toBe('number');
    expect(typeof data.placasDisponiveis).toBe('number');
    expect(typeof data.regiaoPrincipal).toBe('string');
  });

  it('totalPlacas bate com dados inseridos', async () => {
    const regiao = await createTestRegiao();
    const rid = regiao._id.toString();
    await createTestPlaca(rid);
    await createTestPlaca(rid);
    await createTestPlaca(rid, { disponivel: false });

    const res = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    expect(data.totalPlacas).toBe(3);
  });

  it('placasDisponiveis conta apenas disponivel=true', async () => {
    const regiao = await createTestRegiao();
    const rid = regiao._id.toString();
    await createTestPlaca(rid, { disponivel: true });
    await createTestPlaca(rid, { disponivel: true });
    await createTestPlaca(rid, { disponivel: false });

    const res = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    expect(data.placasDisponiveis).toBe(2);
  });

  it('placasDisponiveis <= totalPlacas (invariante de negócio)', async () => {
    const regiao = await createTestRegiao();
    const rid = regiao._id.toString();
    await createTestPlaca(rid, { disponivel: true });
    await createTestPlaca(rid, { disponivel: false });

    const res = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    expect(data.placasDisponiveis).toBeLessThanOrEqual(data.totalPlacas);
  });

  it('regiaoPrincipal é string não vazia quando há placas', async () => {
    const regiao = await createTestRegiao({ nome: 'Norte' });
    await createTestPlaca(regiao._id.toString());

    const res = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    expect(typeof data.regiaoPrincipal).toBe('string');
    expect(data.regiaoPrincipal.length).toBeGreaterThan(0);
  });

  it('campos obrigatórios todos presentes — frontend não deve ver undefined', async () => {
    const res = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    const required = ['totalPlacas', 'placasDisponiveis', 'regiaoPrincipal'];
    required.forEach(field => {
      expect(field in data).toBe(true);
      expect(data[field]).not.toBeUndefined();
    });
  });

  it('totalPlacas = 0 quando empresa não tem placas', async () => {
    const res = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    const data = res.body.data ?? res.body;
    expect(data.totalPlacas).toBe(0);
    expect(data.placasDisponiveis).toBe(0);
  });

  it('respeita empresaId no resumo: empresa A não recebe dados da empresa B', async () => {
    const regiaoA = await createTestRegiao({ nome: 'Regiao A', codigo: 'RLA' });
    const regiaoB = await createTestRegiao({
      nome: 'Regiao B',
      codigo: 'RLB',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    await createTestPlaca(regiaoA._id.toString(), { numero_placa: 'REL-A-1', disponivel: true });
    await createTestPlaca(regiaoB._id.toString(), {
      numero_placa: 'REL-B-1',
      disponivel: true,
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });
    await createTestPlaca(regiaoB._id.toString(), {
      numero_placa: 'REL-B-2',
      disponivel: false,
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    const resA = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${token}`);

    const resB = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${tokenEmpresaB}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.totalPlacas).toBe(1);
    expect(resA.body.data.placasDisponiveis).toBe(1);

    expect(resB.status).toBe(200);
    expect(resB.body.data.totalPlacas).toBe(2);
    expect(resB.body.data.placasDisponiveis).toBe(1);
  });
});

// ─── GET /api/v1/relatorios/placas-por-regiao ────────────────────────────────

describe('GET /api/v1/relatorios/placas-por-regiao', () => {
  it('requer autenticação', async () => {
    const res = await request(app).get('/api/v1/relatorios/placas-por-regiao');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com array', async () => {
    const res = await request(app)
      .get('/api/v1/relatorios/placas-por-regiao')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    expect(Array.isArray(data)).toBe(true);
  });

  it('retorna shape com regiao e total_placas', async () => {
    const regiao = await createTestRegiao({ nome: 'Norte' });
    await createTestPlaca(regiao._id.toString());
    await createTestPlaca(regiao._id.toString());

    const res = await request(app)
      .get('/api/v1/relatorios/placas-por-regiao')
      .set('Authorization', `Bearer ${token}`);

    const list = res.body.data ?? res.body;
    expect(list.length).toBeGreaterThan(0);

    const item = list[0];
    expect(typeof item.regiao).toBe('string');
    expect(typeof item.total_placas).toBe('number');
  });

  it('total_placas bate com os dados inseridos', async () => {
    const regiao = await createTestRegiao({ nome: 'Norte' });
    await createTestPlaca(regiao._id.toString());
    await createTestPlaca(regiao._id.toString());
    await createTestPlaca(regiao._id.toString());

    const res = await request(app)
      .get('/api/v1/relatorios/placas-por-regiao')
      .set('Authorization', `Bearer ${token}`);

    const list = res.body.data ?? res.body;
    const norteItem = list.find((i: any) => i.regiao === 'Norte');
    expect(norteItem).toBeDefined();
    expect(norteItem.total_placas).toBe(3);
  });

  it('agrupa corretamente múltiplas regiões', async () => {
    const norte = await createTestRegiao({ nome: 'Norte', codigo: 'N' });
    const sul = await createTestRegiao({ nome: 'Sul', codigo: 'S' });

    await createTestPlaca(norte._id.toString());
    await createTestPlaca(norte._id.toString());
    await createTestPlaca(sul._id.toString());

    const res = await request(app)
      .get('/api/v1/relatorios/placas-por-regiao')
      .set('Authorization', `Bearer ${token}`);

    const list = res.body.data ?? res.body;
    const totalPorRegiao: Record<string, number> = {};
    list.forEach((i: any) => { totalPorRegiao[i.regiao] = i.total_placas; });

    expect(totalPorRegiao['Norte']).toBe(2);
    expect(totalPorRegiao['Sul']).toBe(1);
  });
});
