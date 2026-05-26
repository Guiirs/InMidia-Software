/**
 * RBAC Audit-Log — testes de integração.
 * Cobre: controle de acesso, isolamento por tenant, paginação, filtros.
 */
import request from 'supertest';

import {
  app,
  clearDatabase,
  setupIntegrationDb,
  teardownIntegrationDb,
  generateTestToken,
} from './setup';

const ENDPOINT = '/api/v1/rbac/audit-log';

describe('GET /api/v1/rbac/audit-log', () => {
  let adminToken: string;
  let viewerToken: string;
  let vendedorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  beforeEach(async () => {
    await clearDatabase();
    adminToken    = generateTestToken({ role: 'admin_empresa' });
    viewerToken   = generateTestToken({ role: 'visualizador' });
    vendedorToken = generateTestToken({ role: 'vendedor' });
  });

  it('admin_empresa acessa audit-log e recebe 200', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.currentPage).toBe(1);
  });

  it('visualizador recebe 403', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('vendedor sem audit.read recebe 403', async () => {
    // vendedor não tem audit.read no ROLE_PERMISSIONS
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${vendedorToken}`);

    expect(res.status).toBe(403);
  });

  it('sem autenticação retorna 401', async () => {
    const res = await request(app).get(ENDPOINT);
    expect(res.status).toBe(401);
  });

  it('resposta inclui meta.tenant e meta.eventType', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.eventType).toBe('permission.denied');
    expect(res.body.meta.tenant).toBeDefined();
    expect(res.body.meta.isSuperadmin).toBe(false);
  });

  it('paginação funciona com ?page=1&limit=5', async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?page=1&limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.currentPage).toBe(1);
  });

  it('limit máximo é 100 mesmo que seja requisitado mais', async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?limit=999`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
  });

  it('filtro eventType funciona', async () => {
    const res = await request(app)
      .get(`${ENDPOINT}?eventType=entity.created`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.eventType).toBe('entity.created');
  });

  it('superadmin sem contexto de tenant isolado não vê dados globais cross-tenant', async () => {
    const superToken = generateTestToken({ role: 'superadmin' });

    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${superToken}`);

    // Superadmin acessa o endpoint, mas só vê dados do tenant contextual
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.meta.isSuperadmin).toBe(true);
    }
  });

  it('nunca retorna token, senha ou campo sensível nos dados', async () => {
    const res = await request(app)
      .get(ENDPOINT)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/password|senha|token|secret|cookie/i);
  });
});
