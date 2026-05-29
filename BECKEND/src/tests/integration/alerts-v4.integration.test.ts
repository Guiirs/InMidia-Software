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

describe('Alerts V4 integration', () => {
  let adminToken: string;
  let gestorToken: string;
  let vendedorToken: string;
  let visualizadorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken       = generateTestToken({ role: 'admin_empresa' });
    gestorToken      = generateTestToken({ role: 'gestor' });
    vendedorToken    = generateTestToken({ role: 'vendedor' });
    visualizadorToken = generateTestToken({ role: 'visualizador' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  // ── Auth guard ──────────────────────────────────────────────────

  it('retorna 401 sem token em /', async () => {
    expect((await request(app).get('/api/v4/alerts')).status).toBe(401);
  });

  it('retorna 401 sem token em /summary', async () => {
    expect((await request(app).get('/api/v4/alerts/summary')).status).toBe(401);
  });

  it('retorna 401 sem token em /critical', async () => {
    expect((await request(app).get('/api/v4/alerts/critical')).status).toBe(401);
  });

  // ── Permission guard ────────────────────────────────────────────

  // visualizador tem alerts.read
  it('visualizador acessa /summary', async () => {
    const res = await request(app)
      .get('/api/v4/alerts/summary')
      .set('Authorization', `Bearer ${visualizadorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // vendedor tem alerts.read
  it('vendedor acessa /unread', async () => {
    const res = await request(app)
      .get('/api/v4/alerts/unread')
      .set('Authorization', `Bearer ${vendedorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Contrato de resposta ─────────────────────────────────────────

  it('GET / retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { alerts: expect.any(Array), total: expect.any(Number), unread: expect.any(Number) },
    });
  });

  it('GET /summary retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/alerts/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { total: expect.any(Number), critical: expect.any(Number), unread: expect.any(Number), byDomain: expect.any(Array) },
    });
  });

  it('GET /critical retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/alerts/critical')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ success: true, data: { alerts: expect.any(Array) } });
  });

  it('GET /unread retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/alerts/unread')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { alerts: expect.any(Array), count: expect.any(Number) },
    });
  });

  it('GET /by-domain retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/alerts/by-domain')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ success: true, data: { byDomain: expect.any(Object) } });
  });

  // ── Todos os endpoints acessíveis para gestor ─────────────────────

  it('gestor acessa todos os endpoints de alerts', async () => {
    for (const path of ['', '/summary', '/critical', '/unread', '/by-domain']) {
      const res = await request(app)
        .get(`/api/v4/alerts${path}`)
        .set('Authorization', `Bearer ${gestorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('executa writes reais, persiste estado e emite eventos realtime mínimos', async () => {
    const since = new Date(Date.now() - 1000).toISOString();

    const createdRes = await request(app)
      .post('/api/v4/alerts/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'operational', severity: 'critical', message: 'Teste crítico', domain: 'operations' })
      .expect(201);

    const alert = createdRes.body.data.alert;
    expect(alert).toMatchObject({ type: 'operational', severity: 'critical', message: 'Teste crítico', domain: 'operations' });

    await request(app)
      .patch(`/api/v4/alerts/${alert.id}/read`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    await request(app)
      .patch(`/api/v4/alerts/${alert.id}/dismiss`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    await request(app)
      .patch(`/api/v4/alerts/${alert.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'Resolvido em teste' })
      .expect(200);

    const secondAlert = await request(app)
      .post('/api/v4/alerts/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'inventory', severity: 'warning', message: 'Segundo alerta', domain: 'inventory' })
      .expect(201);

    const readAll = await request(app)
      .patch('/api/v4/alerts/read-all')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(readAll.body.data.count).toBeGreaterThanOrEqual(1);
    expect(secondAlert.body.data.alert.id).toEqual(expect.any(String));

    const unread = await request(app)
      .get('/api/v4/alerts/unread')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(unread.body.data.count).toBe(0);

    const events = eventBus.getRecentEvents(TEST_EMPRESA_ID, since).map((event) => event.type);
    expect(events).toEqual(expect.arrayContaining([
      'alerts.created',
      'alerts.read',
      'alerts.dismissed',
      'alerts.resolved',
      'alerts.updated',
    ]));
  });

  it('bloqueia criação manual para perfil somente leitura', async () => {
    const res = await request(app)
      .post('/api/v4/alerts/manual')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .send({ type: 'manual', severity: 'warning', message: 'Sem permissão' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('alertas operacionais expoem plateId canonico com fallback legado', async () => {
    const plateId = new Types.ObjectId().toString();
    const regionId = new Types.ObjectId().toString();
    const createdRes = await request(app)
      .post('/api/v4/alerts/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'operational',
        severity: 'critical',
        message: 'Operacao critica',
        domain: 'operations',
        placaId: plateId,
        regionId,
      })
      .expect(201);

    expect(createdRes.body.data.alert.plateId).toBe(plateId);
    expect(createdRes.body.data.alert.regionId).toBe(regionId);
    expect(createdRes.body.data.alert.payload.plateId).toBe(plateId);
  });

  it('isola alertas por tenant', async () => {
    await request(app)
      .post('/api/v4/alerts/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'manual', severity: 'warning', message: 'Tenant A' })
      .expect(201);

    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherTenantToken = generateTestToken({
      role: 'admin_empresa',
      empresaId: otherTenantId,
    });

    const res = await request(app)
      .get('/api/v4/alerts')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .expect(200);

    expect(res.body.data.total).toBe(0);
    expect(res.body.data.alerts).toEqual([]);
  });
});
