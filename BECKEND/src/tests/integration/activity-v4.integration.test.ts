import request from 'supertest';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';

describe('Activity V4 integration', () => {
  let adminToken: string;
  let visualizadorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken       = generateTestToken({ role: 'admin_empresa' });
    // visualizador tem activity.read mas não activity.write
    visualizadorToken = generateTestToken({ role: 'visualizador' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  // ── Auth guard ────────────────────────────────────────────────

  it('retorna 401 sem token em /timeline', async () => {
    const res = await request(app).get('/api/v4/activity/timeline');
    expect(res.status).toBe(401);
  });

  it('retorna 401 sem token em /feed', async () => {
    const res = await request(app).get('/api/v4/activity/feed');
    expect(res.status).toBe(401);
  });

  it('retorna 401 sem token em /audit', async () => {
    const res = await request(app).get('/api/v4/activity/audit');
    expect(res.status).toBe(401);
  });

  it('retorna 401 sem token em /by-domain', async () => {
    const res = await request(app).get('/api/v4/activity/by-domain');
    expect(res.status).toBe(401);
  });

  // ── Permission guard ──────────────────────────────────────────

  it('visualizador com activity.read acessa timeline (200)', async () => {
    const res = await request(app)
      .get('/api/v4/activity/timeline')
      .set('Authorization', `Bearer ${visualizadorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('visualizador sem activity.write recebe 403 em POST /audit', async () => {
    const res = await request(app)
      .post('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .send({ domain: 'system', type: 'test', title: 'Tentativa sem permissao' });
    expect(res.status).toBe(403);
  });

  // ── Contrato de resposta ──────────────────────────────────────

  it('GET /timeline retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/activity/timeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        events: expect.any(Array),
        total: expect.any(Number),
      },
    });
  });

  it('GET /feed retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/activity/feed')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        items: expect.any(Array),
        total: expect.any(Number),
      },
    });
  });

  it('GET /audit retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        entries: expect.any(Array),
        total: expect.any(Number),
        generatedAt: expect.any(String),
      },
    });
  });

  it('GET /by-domain retorna 200 com contrato V4', async () => {
    const res = await request(app)
      .get('/api/v4/activity/by-domain')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        byDomain: expect.any(Object),
      },
    });
  });

  // ── Timeline vazia sem dados ──────────────────────────────────

  it('GET /timeline retorna lista vazia quando nao ha eventos', async () => {
    const res = await request(app)
      .get('/api/v4/activity/timeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.events).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // ── Criacao e recuperacao de audit entry ──────────────────────

  it('POST /audit cria entrada e GET /audit a recupera', async () => {
    const createRes = await request(app)
      .post('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        domain: 'contracts',
        type: 'contracts.status.changed',
        title: 'Contrato ativado via teste',
        description: 'Descricao de teste',
        status: 'created',
      })
      .expect(201);

    expect(createRes.body).toMatchObject({
      success: true,
      data: {
        entry: {
          domain: 'contracts',
          type: 'contracts.status.changed',
          title: 'Contrato ativado via teste',
        },
      },
    });

    const listRes = await request(app)
      .get('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body.data.entries).toHaveLength(1);
    expect(listRes.body.data.entries[0]).toMatchObject({
      domain: 'contracts',
      title: 'Contrato ativado via teste',
    });
    expect(listRes.body.data.total).toBe(1);
  });

  // ── Tenant isolation ──────────────────────────────────────────

  it('nao retorna entradas de outro tenant', async () => {
    const outroEmpresaToken = generateTestToken({ role: 'admin_empresa', empresaId: 'outro-empresa-id-99' });

    await request(app)
      .post('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ domain: 'system', type: 'test', title: 'Entrada do tenant principal' })
      .expect(201);

    const res = await request(app)
      .get('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${outroEmpresaToken}`)
      .expect(200);

    expect(res.body.data.entries).toHaveLength(0);
  });

  // ── Agrupamento por domínio ───────────────────────────────────

  it('GET /by-domain agrega contagens por dominio', async () => {
    await request(app)
      .post('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ domain: 'commercial', type: 'commercial.activity', title: 'Evento comercial' })
      .expect(201);

    await request(app)
      .post('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ domain: 'commercial', type: 'commercial.activity', title: 'Outro evento comercial' })
      .expect(201);

    await request(app)
      .post('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ domain: 'operations', type: 'operations.event', title: 'Evento operacional' })
      .expect(201);

    const res = await request(app)
      .get('/api/v4/activity/by-domain')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.byDomain.commercial?.count).toBe(2);
    expect(res.body.data.byDomain.operations?.count).toBe(1);
  });

  // ── Feed ──────────────────────────────────────────────────────

  it('GET /feed retorna itens criados', async () => {
    await request(app)
      .post('/api/v4/activity/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ domain: 'alerts', type: 'alerts.created', title: 'Alerta gerado' })
      .expect(201);

    const res = await request(app)
      .get('/api/v4/activity/feed')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0]).toMatchObject({
      domain: 'alerts',
      title: 'Alerta gerado',
    });
  });

  // ── Contrato de erro ──────────────────────────────────────────

  it('POST /audit retorna 401 sem token', async () => {
    const res = await request(app)
      .post('/api/v4/activity/audit')
      .send({ domain: 'system', type: 'test', title: 'Teste' });
    expect(res.status).toBe(401);
  });

  it('visualizador acessa GET /feed com 200', async () => {
    const res = await request(app)
      .get('/api/v4/activity/feed')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
