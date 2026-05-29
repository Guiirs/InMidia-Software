import request from 'supertest';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';
import { recordProjectionMetric, resetProjectionMetrics } from '@shared/infra/monitoring/projection-metrics';

describe('Observability V4 integration', () => {
  let adminToken: string;
  let vendedorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken = generateTestToken({ role: 'admin_empresa' });
    vendedorToken = generateTestToken({ role: 'vendedor' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    resetProjectionMetrics();
    await clearDatabase();
  });

  it('health de sistema responde apenas liveness simples', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body).toEqual({ status: 'healthy' });
  });

  it('readiness retorna status consolidado e checks operacionais', async () => {
    const res = await request(app)
      .get('/api/v4/system/readiness')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(['ready', 'degraded']).toContain(res.body.data.status);
    expect(res.body.data.checks).toMatchObject({
      database: expect.objectContaining({ status: 'ok' }),
      realtime: expect.objectContaining({ status: expect.any(String) }),
      eventBus: expect.objectContaining({ status: expect.any(String) }),
      projections: expect.objectContaining({ status: expect.any(String) }),
      api: expect.objectContaining({ status: expect.any(String) }),
    });
  });

  it('operational score e protegido por permissao administrativa', async () => {
    await request(app)
      .get('/api/v1/diagnostics/score')
      .set('Authorization', `Bearer ${vendedorToken}`)
      .expect(403);

    const res = await request(app)
      .get('/api/v1/diagnostics/score')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      score: expect.any(Number),
      status: expect.stringMatching(/healthy|degraded|critical/),
      readiness: expect.objectContaining({
        status: expect.stringMatching(/ready|degraded|not_ready/),
      }),
    });
  });

  it('diagnostics realtime expõe conexões, listeners e event bus sem dados sensiveis', async () => {
    const res = await request(app)
      .get('/api/v1/diagnostics/realtime')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      realtime: expect.objectContaining({
        connectedClients: expect.any(Number),
        activeListeners: expect.any(Number),
        totals: expect.any(Object),
      }),
      eventBus: expect.objectContaining({
        listenerCount: expect.any(Number),
        recentEvents: expect.any(Number),
      }),
      subscribers: expect.objectContaining({
        active: expect.any(Number),
        orphanCandidates: expect.any(Number),
        byChannel: expect.any(Object),
      }),
      checkedAt: expect.any(String),
    });
  });

  it('diagnostics metrics expõe métricas de projection e domínio', async () => {
    recordProjectionMetric({
      projection: 'commercial',
      durationMs: 12,
      plateCount: 25,
      fallbackCount: 1,
    });

    const res = await request(app)
      .get('/api/v1/diagnostics/metrics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.projections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        projection: 'commercial',
        calls: 1,
        totalPlates: 25,
        fallbackCount: 1,
      }),
    ]));
    expect(Array.isArray(res.body.data.domains)).toBe(true);
  });
});
