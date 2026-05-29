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

describe('Commercial V4 integration', () => {
  let adminToken: string;
  let vendedorToken: string;
  let visualizadorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken     = generateTestToken({ role: 'admin_empresa' });
    vendedorToken  = generateTestToken({ role: 'vendedor' });
    visualizadorToken = generateTestToken({ role: 'visualizador' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  // ── Auth guard ──────────────────────────────────────────────────

  it('retorna 401 sem token em /pipeline', async () => {
    const res = await request(app).get('/api/v4/commercial/pipeline');
    expect(res.status).toBe(401);
  });

  it('retorna 401 sem token em /opportunities', async () => {
    const res = await request(app).get('/api/v4/commercial/opportunities');
    expect(res.status).toBe(401);
  });

  // ── Permission guard ────────────────────────────────────────────

  // visualizador tem commercial.read — deve retornar 200
  it('visualizador com commercial.read acessa pipeline', async () => {
    const res = await request(app)
      .get('/api/v4/commercial/pipeline')
      .set('Authorization', `Bearer ${visualizadorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Contrato de resposta ─────────────────────────────────────────

  it('GET /pipeline retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/commercial/pipeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        stages: expect.any(Array),
        totalValue: expect.any(Number),
        count: expect.any(Number),
        conversionRate: expect.any(Number),
      },
    });
  });

  it('GET /opportunities retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/commercial/opportunities')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        opportunities: expect.any(Array),
        total: expect.any(Number),
      },
    });
  });

  it('GET /proposals retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/commercial/proposals')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        proposals: expect.any(Array),
        total: expect.any(Number),
      },
    });
  });

  it('GET /conversions retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/commercial/conversions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        conversions: expect.any(Array),
        total: expect.any(Number),
        rate: expect.any(Number),
      },
    });
  });

  it('GET /activities retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/commercial/activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        activities: expect.any(Array),
        total: expect.any(Number),
      },
    });
  });

  // ── Isolamento de tenant ─────────────────────────────────────────

  it('vendedor com commercial.read acessa todos os endpoints', async () => {
    const endpoints = [
      '/api/v4/commercial/pipeline',
      '/api/v4/commercial/opportunities',
      '/api/v4/commercial/proposals',
      '/api/v4/commercial/conversions',
      '/api/v4/commercial/activities',
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${vendedorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('executa writes reais, persiste dados e emite eventos realtime mínimos', async () => {
    const since = new Date(Date.now() - 1000).toISOString();

    const opportunityRes = await request(app)
      .post('/api/v4/commercial/opportunities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: 'client-1', boardId: 'board-1', value: 1500, stage: 'lead' })
      .expect(201);

    const opportunity = opportunityRes.body.data.opportunity;
    expect(opportunity).toMatchObject({ clientId: 'client-1', stage: 'lead', value: 1500 });

    await request(app)
      .patch(`/api/v4/commercial/opportunities/${opportunity.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 1800 })
      .expect(200);

    await request(app)
      .patch(`/api/v4/commercial/opportunities/${opportunity.id}/stage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stage: 'proposal' })
      .expect(200);

    const proposalRes = await request(app)
      .post('/api/v4/commercial/proposals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opportunityId: opportunity.id, boardIds: ['board-1'], value: 1800 })
      .expect(201);

    const proposal = proposalRes.body.data.proposal;
    await request(app)
      .patch(`/api/v4/commercial/proposals/${proposal.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 1900 })
      .expect(200);

    await request(app)
      .post(`/api/v4/commercial/proposals/${proposal.id}/convert`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: '2026-06-01', endDate: '2026-07-01' })
      .expect(200);

    await request(app)
      .post('/api/v4/commercial/activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'note', opportunityId: opportunity.id, note: 'Contato registrado' })
      .expect(201);

    const persisted = await request(app)
      .get('/api/v4/commercial/opportunities')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(persisted.body.data.total).toBe(1);
    expect(persisted.body.data.opportunities[0]).toMatchObject({ id: opportunity.id, stage: 'proposal', value: 1800 });

    const events = eventBus.getRecentEvents(TEST_EMPRESA_ID, since).map((event) => event.type);
    expect(events).toEqual(expect.arrayContaining([
      'commercial.opportunity.created',
      'commercial.opportunity.updated',
      'commercial.opportunity.stage.changed',
      'commercial.proposal.created',
      'commercial.proposal.updated',
      'commercial.proposal.converted',
      'commercial.activity.created',
    ]));
  });

  it('bloqueia writes para perfil somente leitura', async () => {
    const res = await request(app)
      .post('/api/v4/commercial/opportunities')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .send({ clientId: 'client-1', value: 1000, stage: 'lead' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('isola registros comerciais por tenant', async () => {
    await request(app)
      .post('/api/v4/commercial/opportunities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: 'client-1', value: 1000, stage: 'lead' })
      .expect(201);

    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherTenantToken = generateTestToken({
      role: 'admin_empresa',
      empresaId: otherTenantId,
    });

    const res = await request(app)
      .get('/api/v4/commercial/opportunities')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .expect(200);

    expect(res.body.data.total).toBe(0);
    expect(res.body.data.opportunities).toEqual([]);
  });
});
