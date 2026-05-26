import request from 'supertest';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';

describe('System readiness V4 integration', () => {
  let adminToken: string;
  let vendedorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken    = generateTestToken({ role: 'admin_empresa' });
    vendedorToken = generateTestToken({ role: 'vendedor' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('retorna 401 sem token', async () => {
    expect((await request(app).get('/api/v4/system/readiness')).status).toBe(401);
  });

  it('retorna 200 com contrato V4 completo para qualquer papel', async () => {
    const res = await request(app)
      .get('/api/v4/system/readiness')
      .set('Authorization', `Bearer ${vendedorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      auth:       'ok',
      features:   'ok',
      inventory:  'ok',
      dashboard:  'ok',
      contracts:  'ok',
      commercial: 'ok',
      alerts:     'ok',
      operations: 'ok',
      reports:    'ok',
      realtime:   expect.any(String),
      checkedAt:  expect.any(String),
    });
  });

  it('checkedAt é ISO 8601 válido', async () => {
    const res = await request(app)
      .get('/api/v4/system/readiness')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ts = new Date(res.body.data.checkedAt);
    expect(Number.isFinite(ts.getTime())).toBe(true);
  });

  it('todos os domínios retornam ok', async () => {
    const res = await request(app)
      .get('/api/v4/system/readiness')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const data = res.body.data;
    const domains = ['auth', 'features', 'inventory', 'dashboard', 'contracts', 'commercial', 'alerts', 'operations', 'reports'];
    for (const d of domains) {
      expect(data[d]).toBe('ok');
    }
  });
});
