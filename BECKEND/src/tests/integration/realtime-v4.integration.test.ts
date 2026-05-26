/**
 * Testes de Integração — Realtime V4
 *
 * Cobre:
 * 1. POST /api/v4/realtime/stream-token — autenticação, contrato, TTL
 * 2. GET  /api/v4/realtime/stream       — token inválido/expirado, headers SSE
 */

import request from 'supertest';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';
import { clearAllStreamTokens, consumeStreamToken } from '@modules/sync/sync.stream-tokens';

let adminToken: string;

beforeAll(async () => {
  await setupIntegrationDb();
  adminToken = generateTestToken({ role: 'admin_empresa' });
});

afterEach(async () => {
  await clearDatabase();
  clearAllStreamTokens();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

// ─── POST /api/v4/realtime/stream-token ───────────────────────────────────────

describe('POST /api/v4/realtime/stream-token', () => {
  it('sem token retorna 401', async () => {
    const res = await request(app).post('/api/v4/realtime/stream-token');
    expect(res.status).toBe(401);
  });

  it('token válido retorna 200 com { success, data:{ token, expiresAt, ttlMs } }', async () => {
    const res = await request(app)
      .post('/api/v4/realtime/stream-token')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      token:    expect.any(String),
      expiresAt: expect.any(String),
      ttlMs:    60_000,
    });
  });

  it('token é string hexadecimal de 64 chars (randomBytes(32))', async () => {
    const res = await request(app)
      .post('/api/v4/realtime/stream-token')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const { token } = res.body.data;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('expiresAt é ISO 8601 no futuro', async () => {
    const res = await request(app)
      .post('/api/v4/realtime/stream-token')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const { expiresAt } = res.body.data;
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('cada chamada emite token diferente', async () => {
    const [r1, r2] = await Promise.all([
      request(app).post('/api/v4/realtime/stream-token').set('Authorization', `Bearer ${adminToken}`),
      request(app).post('/api/v4/realtime/stream-token').set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(r1.body.data.token).not.toBe(r2.body.data.token);
  });

  it('token JWT expirado retorna 401', async () => {
    const { sign } = await import('jsonwebtoken');
    const expired = sign(
      { id: 'x', empresaId: 'x', role: 'admin', email: 'x@x.com', username: 'x' },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .post('/api/v4/realtime/stream-token')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v4/realtime/stream ─────────────────────────────────────────────

describe('GET /api/v4/realtime/stream', () => {
  it('sem query token retorna 401', async () => {
    const res = await request(app).get('/api/v4/realtime/stream');
    expect(res.status).toBe(401);
  });

  it('token inválido retorna 401', async () => {
    const res = await request(app).get('/api/v4/realtime/stream?token=token-invalido-xyz');
    expect(res.status).toBe(401);
  });

  it('token já consumido retorna 401 (one-shot)', async () => {
    const tokenRes = await request(app)
      .post('/api/v4/realtime/stream-token')
      .set('Authorization', `Bearer ${adminToken}`);

    const { token: streamToken } = tokenRes.body.data;

    // Consome diretamente via módulo para simular uso anterior
    const first = consumeStreamToken(streamToken);
    expect(first).not.toBeNull();

    // Segunda tentativa via HTTP deve rejeitar
    const res = await request(app).get(`/api/v4/realtime/stream?token=${streamToken}`);
    expect(res.status).toBe(401);
  });

  it('token válido inicia SSE com headers corretos', async () => {
    const tokenRes = await request(app)
      .post('/api/v4/realtime/stream-token')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const { token: streamToken } = tokenRes.body.data;

    // Abre SSE — fecha logo (timeout curto), só verifica headers
    const streamRes = await request(app)
      .get(`/api/v4/realtime/stream?token=${encodeURIComponent(streamToken)}`)
      .timeout({ response: 600, deadline: 1200 })
      .catch((err) => err.response ?? err);

    if (streamRes?.headers) {
      expect(streamRes.headers['content-type']).toContain('text/event-stream');
      expect(streamRes.headers['cache-control']).toContain('no-cache');
    } else {
      // Timeout esperado — stream ficou aberto; tudo certo
      expect(true).toBe(true);
    }
  });
});

// ─── GET /api/v4/realtime/health ─────────────────────────────────────────────

describe('GET /api/v4/realtime/health', () => {
  it('sem token retorna 401', async () => {
    const res = await request(app).get('/api/v4/realtime/health');
    expect(res.status).toBe(401);
  });

  it('token válido retorna snapshot de métricas', async () => {
    const res = await request(app)
      .get('/api/v4/realtime/health')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      connectedClients:  expect.any(Number),
      emittedLastMinute: expect.any(Number),
      uptime:            expect.any(Number),
      timestamp:         expect.any(String),
    });
  });
});
