import request from 'supertest';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  generateTestToken,
} from '../integration/setup';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function validRequest(overrides: Record<string, unknown> = {}) {
  return { profile: 'executive-summary', format: 'json', ...overrides };
}

// ── Endpoint protection ───────────────────────────────────────────────────────

describe('POST /api/v1/exports — RBAC', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/exports').send(validRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${vendedorToken}`)
      .send(validRequest());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/exports/profiles — RBAC', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/exports/profiles');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const res = await request(app)
      .get('/api/v1/exports/profiles')
      .set('Authorization', `Bearer ${vendedorToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Invalid requests ──────────────────────────────────────────────────────────

describe('POST /api/v1/exports — invalid request', () => {
  it('returns 400 when profile is missing', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ format: 'json' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'profile')).toBe(true);
  });

  it('returns 400 when format is missing', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ profile: 'executive-summary' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'format')).toBe(true);
  });

  it('returns 400 for unknown profile', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ profile: 'hack-report', format: 'json' });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'profile')).toBe(true);
  });

  it('returns 400 for unknown format', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ profile: 'executive-summary', format: 'docx' });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'format')).toBe(true);
  });
});

// ── Empty-store responses (no snapshot) ───────────────────────────────────────

describe('POST /api/v1/exports — no snapshot', () => {
  it('returns 422 with failed status when no BI snapshot available (json)', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validRequest({ format: 'json' }));
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.exportId).toBe('string');
    expect(typeof res.body.error).toBe('string');
  });

  it('returns 422 with failed status when no BI snapshot available (csv)', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validRequest({ format: 'csv' }));
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// ── Planned formats ───────────────────────────────────────────────────────────

describe('POST /api/v1/exports — planned formats', () => {
  it('returns 202 for pdf format with planned status', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validRequest({ format: 'pdf' }));
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('planned');
    expect(typeof res.body.exportId).toBe('string');
    expect(res.body.message).toContain('pdf');
  });

  it('returns 202 for xlsx format with planned status', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validRequest({ format: 'xlsx' }));
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('planned');
  });
});

// ── Profiles endpoint ─────────────────────────────────────────────────────────

describe('GET /api/v1/exports/profiles', () => {
  it('returns all 5 profiles for admin', async () => {
    const res = await request(app)
      .get('/api/v1/exports/profiles')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.profiles)).toBe(true);
    expect(res.body.profiles).toHaveLength(5);
    const profileNames = res.body.profiles.map((p: { profile: string }) => p.profile);
    expect(profileNames).toContain('executive-summary');
    expect(profileNames).toContain('regional-performance');
    expect(profileNames).toContain('inventory-health');
    expect(profileNames).toContain('quality-report');
    expect(profileNames).toContain('governance-report');
  });

  it('includes blockedFields list', async () => {
    const res = await request(app)
      .get('/api/v1/exports/profiles')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.blockedFields).toBeInstanceOf(Array);
    expect(res.body.blockedFields).toContain('password');
    expect(res.body.blockedFields).toContain('email');
    expect(res.body.blockedFields).toContain('tenantId');
  });

  it('each profile has json and csv in availableFormats', async () => {
    const res = await request(app)
      .get('/api/v1/exports/profiles')
      .set('Authorization', `Bearer ${adminToken}`);
    for (const spec of res.body.profiles) {
      expect(spec.availableFormats).toContain('json');
      expect(spec.availableFormats).toContain('csv');
    }
  });
});

// ── Status endpoint ───────────────────────────────────────────────────────────

describe('GET /api/v1/exports/:id/status', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/exports/abc12345/status');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown export id', async () => {
    const res = await request(app)
      .get('/api/v1/exports/nonexistent-id/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns status for a planned export', async () => {
    // First create a planned export to get its ID
    const createRes = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validRequest({ format: 'pdf' }));
    expect(createRes.status).toBe(202);
    const exportId = createRes.body.exportId;

    const statusRes = await request(app)
      .get(`/api/v1/exports/${exportId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.success).toBe(true);
    expect(statusRes.body.status).toBe('planned');
    expect(statusRes.body.exportId).toBe(exportId);
  });
});
