import request from 'supertest';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  generateTestToken,
} from '../../../tests/integration/setup';

let adminToken: string;
let viewerToken: string;

beforeAll(async () => {
  await setupIntegrationDb();
  adminToken = generateTestToken({ role: 'admin_empresa', email: 'admin@inmidia.com' });
  viewerToken = generateTestToken({ role: 'vendedor', email: 'viewer@inmidia.com' });
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

function requestBody(capabilityId: string, overrides: Record<string, unknown> = {}) {
  return { capabilityId, ...overrides };
}

describe('GET /api/v1/marketplace/modules', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/marketplace/modules');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/modules')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns the marketplace catalog for admin', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/modules')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.modules)).toBe(true);
    expect(Array.isArray(res.body.capabilities)).toBe(true);
  });
});

describe('GET /api/v1/marketplace/capabilities', () => {
  it('returns the catalog for admin', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/capabilities')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.capabilities)).toBe(true);
    expect(res.body.capabilities.some((capability: { id: string }) => capability.id === 'enterprise-bi')).toBe(true);
  });
});

describe('POST /api/v1/marketplace/activate', () => {
  it('returns 400 when capabilityId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/activate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('activates beta capability for admin', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/activate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody('realtime-streams'));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('activated');
  });

  it('blocks planned capability', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/activate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody('marketplace-automation'));
    expect(res.status).toBe(403);
    expect(res.body.status).toBe('blocked');
  });

  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/activate')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(requestBody('exports'));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/marketplace/deactivate', () => {
  it('deactivates a capability', async () => {
    await request(app)
      .post('/api/v1/marketplace/activate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody('enterprise-bi'));

    const res = await request(app)
      .post('/api/v1/marketplace/deactivate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(requestBody('enterprise-bi'));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('deactivated');
  });
});
