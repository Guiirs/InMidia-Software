/**
 * Integration: Coordinate Persistence — Real HTTP Flow
 *
 * Proves the full stack: multipart/FormData → multer → DTO coercion →
 * Zod validation → Mongoose → MongoDB → GET /placas/locations.
 *
 * These tests are the ground truth that unit tests cannot provide:
 * they prove string lat/lng from a real browser form are saved as
 * numbers in MongoDB and returned correctly by the map endpoint.
 *
 * Scope: ONLY latitude, longitude, coordenadas.
 * Not tested here: auth, regions, images, commercial fields.
 */

import request from 'supertest';
import Placa from '../../modules/placas/Placa';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  createTestRegiao,
  generateTestToken,
} from './setup';

let token: string;
let regiaoId: string;

beforeAll(async () => {
  await setupIntegrationDb();
  token = generateTestToken();
});

beforeEach(async () => {
  const regiao = await createTestRegiao();
  regiaoId = regiao._id.toString();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

// ─── POST — create with coordinate strings ────────────────────────────────────

describe('POST /api/v1/placas — coordinate persistence', () => {
  it('saves latitude/longitude as numbers when FormData sends strings', async () => {
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'COORD-001')
      .field('regiaoId', regiaoId)
      .field('latitude', '-23.55052')
      .field('longitude', '-46.633308')
      .field('coordenadas', '-23.55052,-46.633308');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const placa = await Placa.findOne({ numero_placa: 'COORD-001' }).lean();
    expect(placa).not.toBeNull();
    expect(typeof placa!.latitude).toBe('number');
    expect(typeof placa!.longitude).toBe('number');
    expect(placa!.latitude).toBeCloseTo(-23.55052, 5);
    expect(placa!.longitude).toBeCloseTo(-46.633308, 5);
    expect(placa!.coordenadas).toBe('-23.55052,-46.633308');
  });

  it('saves coordinates with Brazilian comma-decimal strings', async () => {
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'COORD-002')
      .field('regiaoId', regiaoId)
      .field('latitude', '-23,55052')
      .field('longitude', '-46,633308');

    expect(res.status).toBe(201);

    const placa = await Placa.findOne({ numero_placa: 'COORD-002' }).lean();
    expect(placa!.latitude).toBeCloseTo(-23.55052, 5);
    expect(placa!.longitude).toBeCloseTo(-46.633308, 5);
  });

  it('creates placa without coordinates when none are provided', async () => {
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'COORD-003')
      .field('regiaoId', regiaoId);

    expect(res.status).toBe(201);

    const placa = await Placa.findOne({ numero_placa: 'COORD-003' }).lean();
    expect(placa!.latitude == null).toBe(true);
    expect(placa!.longitude == null).toBe(true);
  });

  it('API response contains latitude/longitude fields after create', async () => {
    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'COORD-004')
      .field('regiaoId', regiaoId)
      .field('latitude', '-10.0')
      .field('longitude', '45.0')
      .field('coordenadas', '-10.0,45.0');

    expect(res.status).toBe(201);
    // The response data should carry lat/lng for the frontend to pick up
    const data = res.body.data;
    expect(typeof data.latitude === 'number' || data.latitude === -10.0).toBe(true);
  });
});

// ─── PUT — update coordinates on existing placa ───────────────────────────────

describe('PUT /api/v1/placas/:id — coordinate update', () => {
  it('adds coordinates to a placa that had none', async () => {
    // Create without coordinates
    const createRes = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'COORD-UPD-001')
      .field('regiaoId', regiaoId);

    expect(createRes.status).toBe(201);
    const placaId = createRes.body.data?._id || createRes.body.data?.id;
    expect(placaId).toBeTruthy();

    // Verify no coordinates before update
    const before = await Placa.findById(placaId).lean();
    expect(before!.latitude == null).toBe(true);

    // Update with coordinates
    const updateRes = await request(app)
      .put(`/api/v1/placas/${placaId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('latitude', '-10.123')
      .field('longitude', '45.678')
      .field('coordenadas', '-10.123,45.678');

    expect(updateRes.status).toBe(200);

    const after = await Placa.findById(placaId).lean();
    expect(typeof after!.latitude).toBe('number');
    expect(after!.latitude).toBeCloseTo(-10.123, 3);
    expect(after!.longitude).toBeCloseTo(45.678, 3);
    expect(after!.coordenadas).toBe('-10.123,45.678');
  });

  it('overwrites existing coordinates with new string values', async () => {
    const createRes = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'COORD-UPD-002')
      .field('regiaoId', regiaoId)
      .field('latitude', '-5.0')
      .field('longitude', '35.0')
      .field('coordenadas', '-5.0,35.0');

    const placaId = createRes.body.data?._id || createRes.body.data?.id;

    const updateRes = await request(app)
      .put(`/api/v1/placas/${placaId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('latitude', '-20.999')
      .field('longitude', '-43.111')
      .field('coordenadas', '-20.999,-43.111');

    expect(updateRes.status).toBe(200);

    const placa = await Placa.findById(placaId).lean();
    expect(placa!.latitude).toBeCloseTo(-20.999, 3);
    expect(placa!.longitude).toBeCloseTo(-43.111, 3);
    expect(placa!.coordenadas).toBe('-20.999,-43.111');
  });
});

// ─── GET /api/v1/placas/locations — map endpoint ─────────────────────────────

describe('GET /api/v1/placas/locations', () => {
  it('returns coordenadas string for placas with coordinates', async () => {
    await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'COORD-MAP-001')
      .field('regiaoId', regiaoId)
      .field('latitude', '-23.55052')
      .field('longitude', '-46.633308')
      .field('coordenadas', '-23.55052,-46.633308');

    const res = await request(app)
      .get('/api/v1/placas/locations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const loc = res.body.data.find((l: any) => l.numero_placa === 'COORD-MAP-001');
    expect(loc).not.toBeUndefined();
    // coordenadas must be a parseable "lat,lng" string
    expect(typeof loc.coordenadas).toBe('string');
    const [lat, lng] = loc.coordenadas.split(',').map(Number);
    expect(lat).toBeCloseTo(-23.55052, 4);
    expect(lng).toBeCloseTo(-46.633308, 4);
  });

  it('omits placas without coordinates from locations', async () => {
    await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'NO-COORD-001')
      .field('regiaoId', regiaoId);

    const res = await request(app)
      .get('/api/v1/placas/locations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const loc = res.body.data.find((l: any) => l.numero_placa === 'NO-COORD-001');
    expect(loc).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/placas/locations');
    expect(res.status).toBe(401);
  });
});
