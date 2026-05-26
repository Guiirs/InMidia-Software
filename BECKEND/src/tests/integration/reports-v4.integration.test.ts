import request from 'supertest';
import { Types } from 'mongoose';
import { eventBus } from '../../modules/realtime/event-bus.service';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  TEST_EMPRESA_ID,
  teardownIntegrationDb,
} from './setup';

describe('Reports V4 integration', () => {
  let adminToken: string;
  let gestorToken: string;
  let vendedorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken    = generateTestToken({ role: 'admin_empresa' });
    gestorToken   = generateTestToken({ role: 'gestor' });
    vendedorToken = generateTestToken({ role: 'vendedor' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  // ── Auth guard ──────────────────────────────────────────────────

  it('retorna 401 sem token em /summary', async () => {
    const res = await request(app).get('/api/v4/reports/summary');
    expect(res.status).toBe(401);
  });

  it('retorna 401 sem token em /analytics', async () => {
    const res = await request(app).get('/api/v4/reports/analytics');
    expect(res.status).toBe(401);
  });

  // ── Permission guard ─────────────────────────────────────────────

  it('vendedor sem reports.read recebe 403 em /summary', async () => {
    // vendedor não tem reports.read conforme RBAC
    const res = await request(app)
      .get('/api/v4/reports/summary')
      .set('Authorization', `Bearer ${vendedorToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('gestor com reports.read acessa summary', async () => {
    const res = await request(app)
      .get('/api/v4/reports/summary')
      .set('Authorization', `Bearer ${gestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Contrato de resposta ─────────────────────────────────────────

  it('GET /summary retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/reports/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        kpis: expect.any(Object),
        performance: expect.any(Object),
        revenue: expect.any(Object),
        occupancy: expect.any(Object),
      },
    });
  });

  it('GET /analytics retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/reports/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        byPeriod: expect.any(Array),
        byRegion: expect.any(Array),
        byDomain: expect.any(Array),
      },
    });
  });

  it('GET /exports retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/reports/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        exports: expect.any(Array),
        total: expect.any(Number),
      },
    });
  });

  it('GET /by-domain retorna 200 com contrato V4 por domínio', async () => {
    const res = await request(app)
      .get('/api/v4/reports/by-domain')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const { data } = res.body;
    expect(data).toMatchObject({
      inventory:  { total: expect.any(Number), available: expect.any(Number), occupied: expect.any(Number) },
      contracts:  { total: expect.any(Number) },
      commercial: { total: expect.any(Number), opportunities: expect.any(Number), proposals: expect.any(Number) },
      alerts:     { total: expect.any(Number), open: expect.any(Number) },
      operations: { tasks: expect.any(Number), events: expect.any(Number) },
      reports:    { exports: expect.any(Number), schedules: expect.any(Number) },
    });
  });

  it('GET /by-period retorna 200 com contrato V4 (byMonth/byWeek/byQuarter)', async () => {
    const res = await request(app)
      .get('/api/v4/reports/by-period')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      byMonth:   expect.any(Array),
      byWeek:    expect.any(Array),
      byQuarter: expect.any(Array),
      meta:      expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
    });
  });

  it('GET /by-period aceita query params start e end', async () => {
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();

    const res = await request(app)
      .get(`/api/v4/reports/by-period?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.meta.start).toBeDefined();
    expect(res.body.data.meta.end).toBeDefined();
  });

  // ── Todos os endpoints acessíveis para admin ─────────────────────

  it('admin acessa todos os endpoints de reports', async () => {
    const endpoints = [
      '/api/v4/reports/summary',
      '/api/v4/reports/analytics',
      '/api/v4/reports/exports',
      '/api/v4/reports/by-domain',
      '/api/v4/reports/by-period',
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('executa exports/schedules reais, persiste estado e emite realtime mínimo', async () => {
    const since = new Date(Date.now() - 1000).toISOString();

    const exportRes = await request(app)
      .post('/api/v4/reports/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'financial', filters: { period: 'month' }, format: 'csv' })
      .expect(201);

    const exportJob = exportRes.body.data.export;
    expect(exportJob).toMatchObject({ type: 'financial', format: 'csv', status: 'pending' });

    await request(app)
      .patch(`/api/v4/reports/exports/${exportJob.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    const scheduleRes = await request(app)
      .post('/api/v4/reports/schedules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'financial',
        cron: '0 9 * * 1',
        recipients: ['ops@inmidia.com'],
        filters: { period: 'week' },
      })
      .expect(201);

    const schedule = scheduleRes.body.data.schedule;
    expect(schedule).toMatchObject({ type: 'financial', cron: '0 9 * * 1', status: 'active' });

    await request(app)
      .patch(`/api/v4/reports/schedules/${schedule.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cron: '0 10 * * 1' })
      .expect(200);

    await request(app)
      .delete(`/api/v4/reports/schedules/${schedule.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const exportsList = await request(app)
      .get('/api/v4/reports/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(exportsList.body.data.total).toBe(1);
    expect(exportsList.body.data.exports[0]).toMatchObject({ id: exportJob.id, status: 'cancelled' });

    const events = eventBus.getRecentEvents(TEST_EMPRESA_ID, since).map((event) => event.type);
    expect(events).toEqual(expect.arrayContaining([
      'reports.export.created',
      'reports.export.cancelled',
      'reports.schedule.created',
      'reports.schedule.updated',
      'reports.schedule.deleted',
    ]));
  });

  it('bloqueia export para perfil sem reports.export', async () => {
    const res = await request(app)
      .post('/api/v4/reports/exports')
      .set('Authorization', `Bearer ${vendedorToken}`)
      .send({ type: 'financial', filters: {}, format: 'csv' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('analytics usa empresaId real — não ignora tenant', async () => {
    const res = await request(app)
      .get('/api/v4/reports/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // byDomain deve ter estrutura com 6 domínios calculados para o tenant
    const { byDomain } = res.body.data;
    expect(Array.isArray(byDomain)).toBe(true);
    const domains = byDomain.map((d: { domain: string }) => d.domain);
    expect(domains).toEqual(
      expect.arrayContaining(['inventory', 'contracts', 'commercial', 'alerts', 'operations', 'reports']),
    );
    for (const entry of byDomain) {
      expect(typeof entry.total).toBe('number');
    }
  });

  it('by-domain isola dados por tenant', async () => {
    // Cria export no tenant principal
    await request(app)
      .post('/api/v4/reports/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'financial', filters: {}, format: 'csv' })
      .expect(201);

    // Tenant diferente deve ver reports.exports = 0
    const otherToken = generateTestToken({
      role: 'admin_empresa',
      empresaId: new Types.ObjectId().toString(),
    });
    const res = await request(app)
      .get('/api/v4/reports/by-domain')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(res.body.data.reports.exports).toBe(0);
  });

  it('isola exports por tenant', async () => {
    await request(app)
      .post('/api/v4/reports/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'financial', filters: {}, format: 'csv' })
      .expect(201);

    const otherTenantToken = generateTestToken({
      role: 'admin_empresa',
      empresaId: new Types.ObjectId().toString(),
    });

    const res = await request(app)
      .get('/api/v4/reports/exports')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .expect(200);

    expect(res.body.data.total).toBe(0);
    expect(res.body.data.exports).toEqual([]);
  });
});
