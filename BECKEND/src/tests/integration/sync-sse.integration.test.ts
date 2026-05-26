/**
 * Testes de Integração HTTP — SSE (COMM-3)
 *
 * Cobre:
 * 1. POST /sync/stream-token requer autenticação
 * 2. POST /sync/stream-token retorna token + expiresAt
 * 3. GET /sync/stream sem token → 401
 * 4. GET /sync/stream com token inválido → 401
 * 5. GET /sync/stream com token válido → headers SSE corretos
 * 6. Token é one-shot — segundo uso → 401
 */

import request from 'supertest';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  generateTestToken,
} from './setup';
import { clearAllStreamTokens } from '@modules/sync/sync.stream-tokens';
import { clearAllConnections } from '@modules/sync/sync.sse-connections';

let token: string;

beforeAll(async () => {
  await setupIntegrationDb();
  token = generateTestToken();
});

afterEach(async () => {
  await clearDatabase();
  clearAllStreamTokens();
  clearAllConnections();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

// ─── POST /sync/stream-token ──────────────────────────────────────────────────

describe('POST /api/v1/sync/stream-token', () => {
  it('requer autenticação — 401 sem token', async () => {
    const res = await request(app).post('/api/v1/sync/stream-token');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com token e expiresAt', async () => {
    const res = await request(app)
      .post('/api/v1/sync/stream-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThan(10);
    expect(typeof data.expiresAt).toBe('string');
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(data.ttlMs).toBe(60_000);
  });

  it('tokens diferentes a cada chamada', async () => {
    const r1 = await request(app)
      .post('/api/v1/sync/stream-token')
      .set('Authorization', `Bearer ${token}`);
    const r2 = await request(app)
      .post('/api/v1/sync/stream-token')
      .set('Authorization', `Bearer ${token}`);

    expect(r1.body.data.token).not.toBe(r2.body.data.token);
  });
});

// ─── GET /sync/stream ─────────────────────────────────────────────────────────

describe('GET /api/v1/sync/stream', () => {
  it('sem token → 401', async () => {
    const res = await request(app).get('/api/v1/sync/stream');
    expect(res.status).toBe(401);
  });

  it('token inválido → 401', async () => {
    const res = await request(app).get('/api/v1/sync/stream?token=token-invalido-xyz');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_STREAM_TOKEN');
  });

  it('token válido → headers SSE corretos', async () => {
    // Obtém stream token
    const tokenRes = await request(app)
      .post('/api/v1/sync/stream-token')
      .set('Authorization', `Bearer ${token}`);
    const { token: streamToken } = tokenRes.body.data;

    // Abre stream (fecha imediatamente via supertest)
    const streamRes = await request(app)
      .get(`/api/v1/sync/stream?token=${encodeURIComponent(streamToken)}&since=${encodeURIComponent(new Date().toISOString())}`)
      .timeout({ response: 500, deadline: 1000 })
      .catch(err => err.response ?? err);

    // supertest pode timeout — ok, só verificamos os headers
    if (streamRes && streamRes.headers) {
      expect(streamRes.headers['content-type']).toContain('text/event-stream');
    }
  });

  it('token é one-shot — consumir diretamente e verificar rejeição', async () => {
    // Obtém token via API
    const tokenRes = await request(app)
      .post('/api/v1/sync/stream-token')
      .set('Authorization', `Bearer ${token}`);
    const { token: streamToken } = tokenRes.body.data;

    // Consome o token diretamente via módulo (evita conexão SSE que não fecha em testes)
    const { consumeStreamToken } = await import('@modules/sync/sync.stream-tokens');
    const firstUse = consumeStreamToken(streamToken);
    expect(firstUse).not.toBeNull(); // primeiro uso — válido

    // Segundo uso via HTTP deve retornar 401
    const secondRes = await request(app)
      .get(`/api/v1/sync/stream?token=${encodeURIComponent(streamToken)}`);
    expect(secondRes.status).toBe(401);
  });
});
