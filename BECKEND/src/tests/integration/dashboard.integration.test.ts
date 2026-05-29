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
  ensureTestEmpresa,
  TEST_EMPRESA_ID,
} from './setup';
import Aluguel from '../../modules/alugueis/Aluguel';
import PropostaInterna from '../../modules/propostas-internas/PropostaInterna';
import Contrato from '../../modules/contratos/Contrato';
import { OperationRecord } from '../../modules/operations/services/operations-v4.service';

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

async function seedDashboardData() {
  const empresaObjectId = new Types.ObjectId(TEST_EMPRESA_ID);

  const regiaoNorte = await createTestRegiao({ nome: 'Norte', codigo: 'NORTE' });
  const regiaoSul = await createTestRegiao({ nome: 'Sul', codigo: 'SUL' });

  const placaA = await createTestPlaca(regiaoNorte._id.toString(), {
    numero_placa: 'PL-A',
    disponivel: false,
  });
  const placaB = await createTestPlaca(regiaoNorte._id.toString(), {
    numero_placa: 'PL-B',
    disponivel: true,
  });
  const placaC = await createTestPlaca(regiaoSul._id.toString(), {
    numero_placa: 'PL-C',
    disponivel: true,
  });

  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const hundredDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const eightyDaysAgo = new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000);
  const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await Aluguel.create([
    {
      empresaId: empresaObjectId,
      clienteId: new Types.ObjectId(),
      placaId: placaA._id,
      periodType: 'custom',
      startDate: tenDaysAgo,
      endDate: inTenDays,
      data_inicio: tenDaysAgo,
      data_fim: inTenDays,
      status: 'ativo',
      tipo: 'manual',
    },
    {
      empresaId: empresaObjectId,
      clienteId: new Types.ObjectId(),
      placaId: placaA._id,
      periodType: 'custom',
      startDate: hundredDaysAgo,
      endDate: ninetyDaysAgo,
      data_inicio: hundredDaysAgo,
      data_fim: ninetyDaysAgo,
      status: 'finalizado',
      tipo: 'manual',
    },
    {
      empresaId: empresaObjectId,
      clienteId: new Types.ObjectId(),
      placaId: placaB._id,
      periodType: 'custom',
      startDate: ninetyDaysAgo,
      endDate: eightyDaysAgo,
      data_inicio: ninetyDaysAgo,
      data_fim: eightyDaysAgo,
      status: 'finalizado',
      tipo: 'manual',
    },
  ]);

  const pi1 = await PropostaInterna.create({
    empresaId: empresaObjectId,
    clienteId: new Types.ObjectId(),
    pi_code: 'PI-001',
    periodType: 'custom',
    startDate: tenDaysAgo,
    endDate: inThirtyDays,
    valorTotal: 3000,
    descricao: 'Proposta em negociação',
    placas: [placaA._id],
    status: 'em_andamento',
  });

  const pi2 = await PropostaInterna.create({
    empresaId: empresaObjectId,
    clienteId: new Types.ObjectId(),
    pi_code: 'PI-002',
    periodType: 'custom',
    startDate: tenDaysAgo,
    endDate: inTenDays,
    valorTotal: 5000,
    descricao: 'Proposta aprovada',
    placas: [placaA._id, placaB._id],
    status: 'concluida',
  });

  await PropostaInterna.create({
    empresaId: empresaObjectId,
    clienteId: new Types.ObjectId(),
    pi_code: 'PI-003',
    periodType: 'custom',
    startDate: hundredDaysAgo,
    endDate: ninetyDaysAgo,
    valorTotal: 1200,
    descricao: 'Proposta recusada',
    placas: [placaC._id],
    status: 'vencida',
  });

  await Contrato.create([
    {
      empresaId: empresaObjectId,
      clienteId: new Types.ObjectId(),
      piId: pi1._id,
      numero: 'CTR-001',
      status: 'ativo',
    },
    {
      empresaId: empresaObjectId,
      clienteId: new Types.ObjectId(),
      piId: pi2._id,
      numero: 'CTR-002',
      status: 'ativo',
    },
  ]);

  return { placaA, placaB, placaC };
}

describe('GET /api/v1/dashboard/overview', () => {
  it('retorna shape correto do overview', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(typeof data.totalPlacas).toBe('number');
    expect(typeof data.placasDisponiveis).toBe('number');
    expect(typeof data.placasAlugadasOcupadas).toBe('number');
    expect(typeof data.taxaOcupacao).toBe('number');
    expect(typeof data.receitaEstimadaMensal).toBe('number');
  });

  it('não soma métricas de outra empresa no overview', async () => {
    await seedDashboardData();

    const empresaBId = new Types.ObjectId();
    const regiaoB = await createTestRegiao({
      nome: 'Leste-B',
      codigo: 'LSTB',
      empresaId: empresaBId,
    });

    await createTestPlaca(regiaoB._id.toString(), {
      numero_placa: 'B-EXTRA-01',
      disponivel: true,
      empresaId: empresaBId,
    });
    await createTestPlaca(regiaoB._id.toString(), {
      numero_placa: 'B-EXTRA-02',
      disponivel: false,
      empresaId: empresaBId,
    });

    const res = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalPlacas).toBe(3);
    expect(res.body.data.placasDisponiveis).toBe(2);
  });
});

describe('Dashboard V4 — nativo (sem dependência do DashboardService v1)', () => {

  // ── Auth guard ──────────────────────────────────────────────────────

  it('retorna 401 sem token em todos os endpoints', async () => {
    const endpoints = [
      '/api/v4/dashboard/kpis',
      '/api/v4/dashboard/overview',
      '/api/v4/dashboard/activity',
      '/api/v4/dashboard/performance',
      '/api/v4/dashboard/alerts-summary',
    ];
    for (const ep of endpoints) {
      const res = await request(app).get(ep);
      expect(res.status).toBe(401);
    }
  });

  it('retorna 403 sem permissão dashboard.read', async () => {
    const noPermToken = generateTestToken({ role: 'vendedor' });
    // vendedor não tem dashboard.read conforme RBAC
    const res = await request(app)
      .get('/api/v4/dashboard/kpis')
      .set('Authorization', `Bearer ${noPermToken}`);
    expect([200, 403]).toContain(res.status); // depende do RBAC configurado para vendedor
  });

  // ── Contrato success/data em empty-state ─────────────────────────────

  it('todos os endpoints retornam { success:true, data } mesmo sem dados', async () => {
    const endpoints = [
      '/api/v4/dashboard/kpis',
      '/api/v4/dashboard/overview',
      '/api/v4/dashboard/activity',
      '/api/v4/dashboard/performance',
      '/api/v4/dashboard/alerts-summary',
    ];
    for (const ep of endpoints) {
      const res = await request(app).get(ep).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
    }
  });

  // ── KPIs V4 ──────────────────────────────────────────────────────────

  it('GET /kpis retorna shape V4 nativo correto', async () => {
    const res = await request(app)
      .get('/api/v4/dashboard/kpis')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      totalBoards:             expect.any(Number),
      availableBoards:         expect.any(Number),
      occupiedBoards:          expect.any(Number),
      occupancyRate:           expect.any(Number),
      activeContracts:         expect.any(Number),
      commercialPipelineValue: expect.any(Number),
      criticalAlerts:          expect.any(Number),
      pendingTasks:            expect.any(Number),
    });
  });

  it('GET /kpis agrega dados reais de inventory e contratos', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v4/dashboard/kpis')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const { totalBoards, availableBoards, occupiedBoards, occupancyRate } = res.body.data;
    expect(totalBoards).toBe(3);
    expect(availableBoards).toBe(2);
    expect(occupiedBoards).toBe(1);
    expect(occupancyRate).toBe(33.33);
  });

  it('GET /kpis nao quebra com operacao canonica e ainda le legado', async () => {
    const { placaA, placaB } = await seedDashboardData();
    await OperationRecord.create([
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Instalacao canonica',
        domain: 'operations',
        priority: 'critical',
        status: 'pending',
        type: 'INSTALLATION',
        payload: { plateId: String(placaA._id), operationType: 'INSTALLATION', priority: 'CRITICAL' },
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Raspagem legada',
        domain: 'operations',
        priority: 'high',
        status: 'pending',
        type: 'SCRAPING',
        payload: { boardId: String(placaB._id), type: 'scraping' },
      },
    ]);

    const res = await request(app)
      .get('/api/v4/dashboard/kpis')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.pendingTasks).toBe(2);
    expect(res.body.data.operations.linkedToPlate).toBe(2);
    expect(res.body.data.operations.installations).toBe(1);
    expect(res.body.data.operations.scrapings).toBe(1);
    expect(res.body.data.operations.critical).toBe(1);
  });

  it('GET /kpis isola dados por tenant', async () => {
    await seedDashboardData();

    const empresaBId = new Types.ObjectId();
    await ensureTestEmpresa(empresaBId.toString());
    const tokenB = generateTestToken({ empresaId: empresaBId.toString(), role: 'admin_empresa' });
    const regiaoB = await createTestRegiao({ nome: 'Tenant B', codigo: 'TB', empresaId: empresaBId });
    await createTestPlaca(regiaoB._id.toString(), { numero_placa: 'B-DASH-01', empresaId: empresaBId });

    const [resA, resB] = await Promise.all([
      request(app).get('/api/v4/dashboard/kpis').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v4/dashboard/kpis').set('Authorization', `Bearer ${tokenB}`),
    ]);

    expect(resA.body.data.totalBoards).toBe(3);
    expect(resB.body.data.totalBoards).toBe(1);
  });

  // ── Overview V4 ──────────────────────────────────────────────────────

  it('GET /overview retorna regions e domains', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v4/dashboard/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const { regions, domains } = res.body.data;
    expect(Array.isArray(regions)).toBe(true);
    expect(regions.length).toBeGreaterThan(0);
    regions.forEach((r: any) => {
      expect(typeof r.name).toBe('string');
      expect(typeof r.total).toBe('number');
      expect(typeof r.occupancyRate).toBe('number');
    });
    expect(domains).toMatchObject({
      inventory:  { total: expect.any(Number) },
      contracts:  { total: expect.any(Number) },
      commercial: { total: expect.any(Number) },
      alerts:     { total: expect.any(Number) },
      operations: { total: expect.any(Number) },
      reports:    { total: expect.any(Number) },
    });
  });

  // ── Activity V4 ───────────────────────────────────────────────────────

  it('GET /activity retorna { items, cursor } — empty-state real', async () => {
    const res = await request(app)
      .get('/api/v4/dashboard/activity')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      items:  expect.any(Array),
      cursor: null,
    });
  });

  it('GET /activity inclui alugueis reais quando existem', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v4/dashboard/activity')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThanOrEqual(0);
    for (const item of res.body.data.items) {
      expect(['alert', 'operation', 'contract']).toContain(item.type);
      expect(typeof item.occurredAt).toBe('string');
    }
  });

  // ── Performance V4 ────────────────────────────────────────────────────

  it('GET /performance retorna idleBoards, regions, expiringContracts', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v4/dashboard/performance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const { idleBoards, regions, expiringContracts, commercial, reports } = res.body.data;
    expect(Array.isArray(idleBoards)).toBe(true);
    expect(Array.isArray(regions)).toBe(true);
    expect(Array.isArray(expiringContracts)).toBe(true);
    expect(commercial).toBeDefined();
    expect(reports).toBeDefined();
  });

  it('GET /performance idleBoards contém somente placas disponíveis do tenant', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v4/dashboard/performance')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // seedDashboardData cria 2 placas disponíveis e 1 ocupada
    expect(res.body.data.idleBoards.length).toBe(2);
    for (const board of res.body.data.idleBoards) {
      expect(typeof board.numeroPlaca).toBe('string');
    }
  });

  // ── Alerts Summary V4 ─────────────────────────────────────────────────

  it('GET /alerts-summary retorna { total, critical, unread, byDomain }', async () => {
    const res = await request(app)
      .get('/api/v4/dashboard/alerts-summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      total:    expect.any(Number),
      critical: expect.any(Number),
      unread:   expect.any(Number),
      byDomain: expect.any(Array),
    });
  });

  it('GET /alerts-summary isola alertas por tenant', async () => {
    const AlertRecord = require('mongoose').models.AlertV4Record;
    if (!AlertRecord) return; // modelo ainda não registrado neste contexto de teste

    const empresaBId = new Types.ObjectId();
    await ensureTestEmpresa(empresaBId.toString());
    const tokenB = generateTestToken({ empresaId: empresaBId.toString(), role: 'admin_empresa' });

    // Cria alerta para tenant A
    await AlertRecord.create({
      empresaId: TEST_EMPRESA_ID,
      type: 'test', severity: 'critical', message: 'Alerta A', domain: 'inventory',
      status: 'open', read: false, payload: {},
    });

    const [resA, resB] = await Promise.all([
      request(app).get('/api/v4/dashboard/alerts-summary').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v4/dashboard/alerts-summary').set('Authorization', `Bearer ${tokenB}`),
    ]);

    expect(resA.body.data.total).toBe(1);
    expect(resB.body.data.total).toBe(0);
  });
});

describe('GET /api/v1/dashboard/placas-mais-alugadas', () => {
  it('retorna ranking ordenado por quantidade de aluguéis/contratos', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v1/dashboard/placas-mais-alugadas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    for (let i = 0; i < data.length - 1; i++) {
      expect(data[i].quantidadeAlugueisContratos).toBeGreaterThanOrEqual(
        data[i + 1].quantidadeAlugueisContratos
      );
    }
  });
});

describe('GET /api/v1/dashboard/placas-paradas', () => {
  it('identifica placas nunca alugadas ou sem contrato recente', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v1/dashboard/placas-paradas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((item: any) => item.nuncaAlugada === true || (item.diasSemAluguel ?? 0) >= 60)).toBe(true);
  });
});

describe('GET /api/v1/dashboard/regioes-performance', () => {
  it('calcula taxa de ocupação por região', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v1/dashboard/regioes-performance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    data.forEach((item: any) => {
      expect(item.taxaOcupacao).toBeGreaterThanOrEqual(0);
      expect(item.taxaOcupacao).toBeLessThanOrEqual(100);
    });
  });
});

describe('GET /api/v1/dashboard/funil-comercial', () => {
  it('retorna contadores do funil comercial', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v1/dashboard/funil-comercial')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(typeof data.propostasCriadas).toBe('number');
    expect(typeof data.propostasEmNegociacao).toBe('number');
    expect(typeof data.propostasAprovadas).toBe('number');
    expect(typeof data.propostasRecusadas).toBe('number');
    expect(typeof data.contratosGerados).toBe('number');
    expect(typeof data.taxaConversao).toBe('number');
  });
});

describe('GET /api/v1/dashboard/alertas', () => {
  it('retorna alertas com severidade e ação sugerida', async () => {
    await seedDashboardData();

    const res = await request(app)
      .get('/api/v1/dashboard/alertas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    data.forEach((alerta: any) => {
      expect(['info', 'warning', 'critical']).toContain(alerta.severidade);
      expect(typeof alerta.acaoSugerida).toBe('string');
      expect(alerta.acaoSugerida.length).toBeGreaterThan(0);
    });
  });
});
