import request from 'supertest';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  generateTestToken,
} from './setup';

let adminToken: string;
let vendedorToken: string;

beforeAll(async () => {
  await setupIntegrationDb();
  adminToken = generateTestToken({ role: 'admin_empresa', email: 'admin@inmidia.com' });
  vendedorToken = generateTestToken({ role: 'vendedor', email: 'vendedor@inmidia.com' });
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

describe('Enterprise BI Endpoints', () => {
  describe('GET /api/v1/enterprise-bi/snapshot', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/enterprise-bi/snapshot');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/snapshot')
        .set('Authorization', `Bearer ${vendedorToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 with empty state when no snapshot exists', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/snapshot')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.empty).toBe(true);
      expect(res.body.data).toBeNull();
      expect(typeof res.body.message).toBe('string');
    });
  });

  describe('GET /api/v1/enterprise-bi/datasets/executive', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/enterprise-bi/datasets/executive');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/datasets/executive')
        .set('Authorization', `Bearer ${vendedorToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 with empty state when no snapshot exists', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/datasets/executive')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.empty).toBe(true);
      expect(res.body.data).toBeNull();
    });
  });

  describe('GET /api/v1/enterprise-bi/datasets/regional', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/enterprise-bi/datasets/regional');
      expect(res.status).toBe(401);
    });

    it('returns 200 with empty state when no snapshot exists', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/datasets/regional')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.empty).toBe(true);
    });
  });

  describe('GET /api/v1/enterprise-bi/datasets/inventory', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/enterprise-bi/datasets/inventory');
      expect(res.status).toBe(401);
    });

    it('returns 200 with empty state when no snapshot exists', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/datasets/inventory')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.empty).toBe(true);
    });
  });

  describe('GET /api/v1/enterprise-bi/datasets/quality', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/enterprise-bi/datasets/quality');
      expect(res.status).toBe(401);
    });

    it('returns 200 with empty state when no snapshot exists', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/datasets/quality')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.empty).toBe(true);
    });
  });

  describe('GET /api/v1/enterprise-bi/datasets/governance', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/enterprise-bi/datasets/governance');
      expect(res.status).toBe(401);
    });

    it('returns 200 with empty state when no snapshot exists', async () => {
      const res = await request(app)
        .get('/api/v1/enterprise-bi/datasets/governance')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.empty).toBe(true);
    });
  });
});
