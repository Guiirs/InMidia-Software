import request from 'supertest';
import { Types } from 'mongoose';
import { eventBus } from '../../modules/realtime/event-bus.service';
import {
  app,
  clearDatabase,
  ensureTestEmpresa,
  generateTestToken,
  setupIntegrationDb,
  TEST_EMPRESA_ID,
  teardownIntegrationDb,
} from './setup';

describe('Campaigns V4 integration', () => {
  let adminToken: string;
  let gestorToken: string;
  let vendedorToken: string;
  let visualizadorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken        = generateTestToken({ role: 'admin_empresa' });
    gestorToken       = generateTestToken({ role: 'gestor' });
    vendedorToken     = generateTestToken({ role: 'vendedor' });
    visualizadorToken = generateTestToken({ role: 'visualizador' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  // ── Auth guard ──────────────────────────────────────────────────

  it('retorna 401 sem token em /summary', async () => {
    expect((await request(app).get('/api/v4/campaigns/summary')).status).toBe(401);
  });

  it('retorna 401 sem token em /', async () => {
    expect((await request(app).get('/api/v4/campaigns')).status).toBe(401);
  });

  it('retorna 401 sem token em /active', async () => {
    expect((await request(app).get('/api/v4/campaigns/active')).status).toBe(401);
  });

  it('retorna 401 sem token em /scheduled', async () => {
    expect((await request(app).get('/api/v4/campaigns/scheduled')).status).toBe(401);
  });

  it('retorna 401 sem token em /performance', async () => {
    expect((await request(app).get('/api/v4/campaigns/performance')).status).toBe(401);
  });

  // ── Permission guard ────────────────────────────────────────────

  it('visualizador acessa /summary', async () => {
    const res = await request(app)
      .get('/api/v4/campaigns/summary')
      .set('Authorization', `Bearer ${visualizadorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('vendedor acessa /summary e lista', async () => {
    for (const path of ['/summary', '/', '/active', '/scheduled', '/performance']) {
      const res = await request(app)
        .get(`/api/v4/campaigns${path}`)
        .set('Authorization', `Bearer ${vendedorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('visualizador nao pode criar campanhas', async () => {
    const res = await request(app)
      .post('/api/v4/campaigns')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .send({ name: 'Sem permissão' });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ── Contrato de resposta ─────────────────────────────────────────

  it('GET /summary retorna contrato V4 correto (empty state real)', async () => {
    const res = await request(app)
      .get('/api/v4/campaigns/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        total:       expect.any(Number),
        active:      expect.any(Number),
        scheduled:   expect.any(Number),
        paused:      expect.any(Number),
        draft:       expect.any(Number),
        completed:   expect.any(Number),
        generatedAt: expect.any(String),
      },
    });
    expect(res.body.data.total).toBe(0);
  });

  it('GET / retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { campaigns: expect.any(Array), total: expect.any(Number) },
    });
    expect(res.body.data.total).toBe(0);
  });

  it('GET /active retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/campaigns/active')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { campaigns: expect.any(Array), count: expect.any(Number) },
    });
  });

  it('GET /scheduled retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/campaigns/scheduled')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { campaigns: expect.any(Array), count: expect.any(Number) },
    });
  });

  it('GET /performance retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/campaigns/performance')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        totalTracked: expect.any(Number),
        byStatus:     expect.any(Object),
        activeBudget: expect.any(Number),
        generatedAt:  expect.any(String),
      },
    });
  });

  it('gestor acessa todos os endpoints de campaigns', async () => {
    for (const path of ['/summary', '/', '/active', '/scheduled', '/performance']) {
      const res = await request(app)
        .get(`/api/v4/campaigns${path}`)
        .set('Authorization', `Bearer ${gestorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  // ── CRUD completo + realtime ─────────────────────────────────────

  it('executa CRUD real, persiste campanhas e emite eventos realtime', async () => {
    const since = new Date(Date.now() - 1000).toISOString();

    // create
    const createdRes = await request(app)
      .post('/api/v4/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:      'Campanha Verão 2026',
        status:    'draft',
        startDate: '2026-06-01',
        endDate:   '2026-08-31',
        budget:    15000,
        target:    'Jovens 18-35',
      })
      .expect(201);

    const campaign = createdRes.body.data.campaign;
    expect(campaign).toMatchObject({
      name:   'Campanha Verão 2026',
      status: 'draft',
      budget: 15000,
    });
    expect(campaign.id).toBeTruthy();

    // update
    const updatedRes = await request(app)
      .patch(`/api/v4/campaigns/${campaign.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ budget: 20000, status: 'scheduled' })
      .expect(200);
    expect(updatedRes.body.data.campaign.budget).toBe(20000);
    expect(updatedRes.body.data.campaign.status).toBe('scheduled');

    // activate
    const activatedRes = await request(app)
      .patch(`/api/v4/campaigns/${campaign.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(activatedRes.body.data.campaign.status).toBe('active');

    // pause
    const pausedRes = await request(app)
      .patch(`/api/v4/campaigns/${campaign.id}/pause`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(pausedRes.body.data.campaign.status).toBe('paused');

    // verify summary reflects real data
    const summaryRes = await request(app)
      .get('/api/v4/campaigns/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(summaryRes.body.data.total).toBe(1);
    expect(summaryRes.body.data.paused).toBe(1);

    // verify list
    const listRes = await request(app)
      .get('/api/v4/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listRes.body.data.total).toBe(1);
    expect(listRes.body.data.campaigns[0].name).toBe('Campanha Verão 2026');

    // delete
    await request(app)
      .delete(`/api/v4/campaigns/${campaign.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const afterDelete = await request(app)
      .get('/api/v4/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterDelete.body.data.total).toBe(0);

    // realtime events
    const events = eventBus.getRecentEvents(TEST_EMPRESA_ID, since).map((e) => e.type);
    expect(events).toEqual(expect.arrayContaining([
      'campaigns.created',
      'campaigns.updated',
      'campaigns.activated',
      'campaigns.paused',
      'campaigns.deleted',
    ]));
  });

  it('retorna 400 ao criar campanha sem nome', async () => {
    const res = await request(app)
      .post('/api/v4/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'draft' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('isola campanhas por tenant', async () => {
    await request(app)
      .post('/api/v4/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Tenant A Campaign' })
      .expect(201);

    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherTenantToken = generateTestToken({
      role: 'admin_empresa',
      empresaId: otherTenantId,
    });

    const res = await request(app)
      .get('/api/v4/campaigns')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .expect(200);

    expect(res.body.data.total).toBe(0);
    expect(res.body.data.campaigns).toEqual([]);
  });

  it('retorna 404 ao operar sobre campanha de outro tenant', async () => {
    const createdRes = await request(app)
      .post('/api/v4/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Campaign Tenant A' })
      .expect(201);

    const id = createdRes.body.data.campaign.id;
    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherToken = generateTestToken({
      role: 'admin_empresa',
      empresaId: otherTenantId,
    });

    const res = await request(app)
      .patch(`/api/v4/campaigns/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijack' });

    expect(res.status).toBe(404);
  });
});
