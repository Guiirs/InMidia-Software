import request from 'supertest';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
  TEST_EMPRESA_ID,
} from './setup';

describe('Features V4 integration', () => {
  let adminToken: string;
  let vendedorToken: string;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken   = generateTestToken({ role: 'admin_empresa' });
    vendedorToken = generateTestToken({ role: 'vendedor' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
    // restaura env vars modificadas em cada teste
    Object.assign(process.env, originalEnv);
    delete process.env.V4_PAINEL_ALL;
    delete process.env.V4_ENABLED_TENANTS;
    delete process.env.V4_DEVTOOLS_ALL;
  });

  // ── Auth guard ──────────────────────────────────────────────────

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v4/features');
    expect(res.status).toBe(401);
  });

  // ── Contrato de resposta ─────────────────────────────────────────

  it('retorna 200 com contrato V4 completo', async () => {
    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      v4Painel:     expect.any(Boolean),
      v4Commercial: expect.any(Boolean),
      v4Reports:    expect.any(Boolean),
      v4Alerts:     expect.any(Boolean),
      v4Operations: expect.any(Boolean),
      syncDevtools: expect.any(Boolean),
    });
  });

  // ── Default: flags false em produção (sem env vars) ──────────────

  it('por default todos os flags retornam false', async () => {
    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const { data } = res.body;
    expect(data.v4Painel).toBe(false);
    expect(data.syncDevtools).toBe(false);
  });

  // ── V4_PAINEL_ALL habilita para todos ───────────────────────────

  it('V4_PAINEL_ALL=true habilita v4Painel para qualquer tenant', async () => {
    process.env.V4_PAINEL_ALL = 'true';

    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.v4Painel).toBe(true);
  });

  // ── V4_ENABLED_TENANTS habilita por tenant específico ────────────

  it('V4_ENABLED_TENANTS com tenantId habilitado retorna v4Painel true', async () => {
    process.env.V4_ENABLED_TENANTS = TEST_EMPRESA_ID;

    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.v4Painel).toBe(true);
  });

  it('V4_ENABLED_TENANTS com outro tenantId retorna v4Painel false', async () => {
    process.env.V4_ENABLED_TENANTS = 'outro-tenant-id-qualquer';

    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.v4Painel).toBe(false);
  });

  // ── syncDevtools nunca habilitado sem env var explícita ──────────

  it('syncDevtools false por default (seguro para producao)', async () => {
    process.env.V4_PAINEL_ALL = 'true';

    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.syncDevtools).toBe(false);
  });

  it('syncDevtools true somente com V4_DEVTOOLS_ALL=true', async () => {
    process.env.V4_DEVTOOLS_ALL = 'true';

    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.syncDevtools).toBe(true);
  });

  // ── Qualquer papel autenticado acessa as flags ──────────────────

  it('vendedor autenticado acessa flags', async () => {
    const res = await request(app)
      .get('/api/v4/features')
      .set('Authorization', `Bearer ${vendedorToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
