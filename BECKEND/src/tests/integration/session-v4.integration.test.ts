import request from 'supertest';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';

// Permissões legadas que NUNCA devem aparecer na resposta V4
const LEGACY_PERMISSIONS = [
  'placas.read', 'placas.create', 'placas.update', 'placas.delete',
  'contratos.read', 'contratos.create', 'contratos.approve',
  'propostas.read', 'propostas.create', 'propostas.update',
  'relatorios.read',
  'audit.read', 'audit.export',
  'admin.access', 'usuarios.manage', 'empresas.manage',
  'sync.diagnostics',
];

// Permissões V4 esperadas para gestor
const GESTOR_V4_EXPECTED = [
  'inventory.read', 'inventory.update',
  'dashboard.read',
  'contracts.read', 'contracts.create', 'contracts.update', 'contracts.cancel', 'contracts.renew',
  'commercial.read', 'commercial.create', 'commercial.update', 'commercial.convert',
  'alerts.read', 'alerts.update', 'alerts.resolve', 'alerts.dismiss', 'alerts.create',
  'operations.read', 'operations.create', 'operations.update', 'operations.assign', 'operations.complete',
  'reports.read', 'reports.export',
  'auth.session.read', 'realtime.read',
];

describe('Session V4 integration', () => {
  let adminToken: string;
  let gestorToken: string;
  let vendedorToken: string;
  let visualizadorToken: string;
  let financeiroToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken       = generateTestToken({ role: 'admin_empresa' });
    gestorToken      = generateTestToken({ role: 'gestor' });
    vendedorToken    = generateTestToken({ role: 'vendedor' });
    visualizadorToken = generateTestToken({ role: 'visualizador' });
    financeiroToken  = generateTestToken({ role: 'financeiro' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  // ── Auth guard ──────────────────────────────────────────────────

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v4/auth/session');
    expect(res.status).toBe(401);
  });

  // ── Contrato de resposta ─────────────────────────────────────────

  it('retorna 200 com contrato V4 completo para admin_empresa', async () => {
    const res = await request(app)
      .get('/api/v4/auth/session')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id:          expect.any(String),
      email:       expect.any(String),
      role:        expect.any(String),
      tenantId:    expect.any(String),
      permissions: expect.any(Array),
    });
    expect(res.body.data.permissions.length).toBeGreaterThan(0);
  });

  // ── Sem permissões legadas ────────────────────────────────────────

  it('admin_empresa: response nao contem permissoes legadas', async () => {
    const res = await request(app)
      .get('/api/v4/auth/session')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const perms: string[] = res.body.data.permissions;
    for (const legacy of LEGACY_PERMISSIONS) {
      expect(perms).not.toContain(legacy);
    }
  });

  it('todas as permissoes retornadas seguem formato domain.action', async () => {
    const res = await request(app)
      .get('/api/v4/auth/session')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const perms: string[] = res.body.data.permissions;
    for (const p of perms) {
      expect(p).toMatch(/^[a-z]+\.[a-z.]+$/);
    }
  });

  // ── Permissões por papel ──────────────────────────────────────────

  it('gestor recebe permissoes V4 esperadas', async () => {
    const res = await request(app)
      .get('/api/v4/auth/session')
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(200);

    const perms: string[] = res.body.data.permissions;
    for (const expected of GESTOR_V4_EXPECTED) {
      expect(perms).toContain(expected);
    }
    // gestor nao tem commercial.delete
    expect(perms).not.toContain('commercial.delete');
    // gestor nao tem reports.schedule
    expect(perms).not.toContain('reports.schedule');
  });

  it('vendedor nao tem contracts.cancel nem reports.read', async () => {
    const res = await request(app)
      .get('/api/v4/auth/session')
      .set('Authorization', `Bearer ${vendedorToken}`)
      .expect(200);

    const perms: string[] = res.body.data.permissions;
    expect(perms).not.toContain('contracts.cancel');
    expect(perms).not.toContain('reports.read');
    // vendedor tem
    expect(perms).toContain('inventory.read');
    expect(perms).toContain('contracts.read');
    expect(perms).toContain('commercial.read');
    expect(perms).toContain('alerts.read');
    expect(perms).toContain('operations.read');
  });

  it('visualizador tem somente leitura V4', async () => {
    const res = await request(app)
      .get('/api/v4/auth/session')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .expect(200);

    const perms: string[] = res.body.data.permissions;
    // tem todas as reads
    expect(perms).toContain('inventory.read');
    expect(perms).toContain('contracts.read');
    expect(perms).toContain('commercial.read');
    expect(perms).toContain('alerts.read');
    expect(perms).toContain('operations.read');
    expect(perms).toContain('reports.read');
    // nao tem nenhum write
    const writes = perms.filter((p) => !p.endsWith('.read') && !p.startsWith('auth.') && !p.startsWith('realtime.'));
    expect(writes).toHaveLength(0);
  });

  it('financeiro tem contracts + reports mas nao inventory.update', async () => {
    const res = await request(app)
      .get('/api/v4/auth/session')
      .set('Authorization', `Bearer ${financeiroToken}`)
      .expect(200);

    const perms: string[] = res.body.data.permissions;
    expect(perms).toContain('contracts.create');
    expect(perms).toContain('contracts.renew');
    expect(perms).toContain('reports.export');
    expect(perms).toContain('reports.schedule');
    expect(perms).not.toContain('inventory.update');
    expect(perms).not.toContain('commercial.read');
  });

  // ── auth.session.read e realtime.read sempre presentes ───────────

  it('todos os papeis recebem auth.session.read e realtime.read', async () => {
    const tokens = [adminToken, gestorToken, vendedorToken, visualizadorToken, financeiroToken];
    for (const token of tokens) {
      const res = await request(app)
        .get('/api/v4/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.permissions).toContain('auth.session.read');
      expect(res.body.data.permissions).toContain('realtime.read');
    }
  });
});
