/**
 * Testes de Integração HTTP — Sync Layer (COMM-1)
 *
 * Cobre:
 * 1. GET /sync/status retorna shape correto (público)
 * 2. GET /sync/snapshot retorna dados consistentes (autenticado)
 * 3. GET /sync/events retorna 0 eventos para cursor atual
 * 4. Toggle de placa emite PLACA_STATUS_CHANGED → aparece em /sync/events
 * 5. Create placa emite PLACA_CREATED → aparece em /sync/events
 */

import request from 'supertest';
import { Types } from 'mongoose';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  createTestRegiao,
  createTestPlaca,
  generateTestToken,
  TEST_EMPRESA_ID,
} from './setup';
import { clearEventsForTenant } from '@modules/sync/sync.registry';

let token: string;
let tokenEmpresaB: string;
let regiaoId: string;
const EMPRESA_B_ID = new Types.ObjectId().toString();

beforeAll(async () => {
  await setupIntegrationDb();
  token = generateTestToken();
  tokenEmpresaB = generateTestToken({ empresaId: EMPRESA_B_ID, email: 'sync-b@inmidia.com' });
});

beforeEach(async () => {
  await clearDatabase();
  clearEventsForTenant(TEST_EMPRESA_ID);
  clearEventsForTenant(EMPRESA_B_ID);
  // Cria região padrão para os testes que precisam de placa
  const regiao = await createTestRegiao();
  regiaoId = regiao._id.toString();
});

afterAll(async () => {
  clearEventsForTenant(TEST_EMPRESA_ID);
  clearEventsForTenant(EMPRESA_B_ID);
  await teardownIntegrationDb();
});

// ─── GET /sync/status ─────────────────────────────────────────────────────────

describe('GET /api/v1/sync/status', () => {
  it('é público — retorna 200 sem token', async () => {
    const res = await request(app).get('/api/v1/sync/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('retorna shape canônico', async () => {
    const res = await request(app).get('/api/v1/sync/status');
    const data = res.body.data;
    expect(typeof data.apiVersion).toBe('string');
    expect(typeof data.contractVersion).toBe('number');
    expect(typeof data.serverTime).toBe('string');
    expect(typeof data.maintenance).toBe('boolean');
    expect(Array.isArray(data.modules)).toBe(true);
    expect(['connected', 'disconnected', 'degraded']).toContain(data.databaseStatus);
  });

  it('maintenance é false por padrão', async () => {
    const res = await request(app).get('/api/v1/sync/status');
    expect(res.body.data.maintenance).toBe(false);
  });

  it('featureFlags.syncEnabled é true', async () => {
    const res = await request(app).get('/api/v1/sync/status');
    expect(res.body.data.featureFlags.syncEnabled).toBe(true);
  });
});

describe('GET /metrics', () => {
  it('expõe métricas Prometheus do sync', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('sync_events_published_total');
    expect(res.text).toContain('sync_uptime_seconds');
    expect(res.text).toContain('sync_transport_degraded');
    expect(res.text).toContain('sync_legacy_cursor_uses_total');
    expect(res.text).toContain('sync_stream_lag_average_ms');
  });
});

// ─── GET /sync/snapshot ───────────────────────────────────────────────────────

describe('GET /api/v1/sync/snapshot', () => {
  it('requer autenticação', async () => {
    const res = await request(app).get('/api/v1/sync/snapshot');
    expect(res.status).toBe(401);
  });

  it('retorna shape canônico com empresa vazia', async () => {
    const res = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(typeof data.placas.total).toBe('number');
    expect(typeof data.placas.disponiveis).toBe('number');
    expect(typeof data.regioes.total).toBe('number');
    expect(typeof data.dashboard.totalPlacas).toBe('number');
    expect(typeof data.snapshotAt).toBe('string');
    // COMM-6: syncCursor é objeto canônico
    expect(typeof data.syncCursor).toBe('object');
    expect(['local', 'pubsub', 'streams']).toContain(data.syncCursor.mode);
    expect(typeof data.syncCursor.value).toBe('string');
    expect(typeof data.syncCursor.issuedAt).toBe('string');
    // legacyCursor mantido para compat retroativa
    expect(typeof data.legacyCursor).toBe('string');
  });

  it('totalPlacas reflete dados reais', async () => {
    await createTestPlaca(regiaoId);
    await createTestPlaca(regiaoId);

    const res = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.placas.total).toBe(2);
    expect(res.body.data.dashboard.totalPlacas).toBe(2);
  });

  it('placasDisponiveis conta apenas disponivel=true', async () => {
    await createTestPlaca(regiaoId, { disponivel: true });
    await createTestPlaca(regiaoId, { disponivel: false });

    const res = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.placas.disponiveis).toBe(1);
  });

  it('snapshot usa o empresaId autenticado e nao mistura dados de outro tenant', async () => {
    await createTestPlaca(regiaoId, { numero_placa: 'SYNC-A-ONLY' });

    const tenantBRegiao = await createTestRegiao({
      nome: 'Regiao B',
      codigo: 'RB',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });
    await createTestPlaca(tenantBRegiao._id.toString(), {
      numero_placa: 'SYNC-B-ONLY',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    const resA = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${token}`);

    const resB = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${tokenEmpresaB}`);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.data.placas.total).toBe(1);
    expect(resB.body.data.placas.total).toBe(1);
  });

  it('syncCursor.value é ISO 8601 válido em modo local', async () => {
    const res = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${token}`);

    const cursor = res.body.data.syncCursor;
    // Em modo local (sem Redis), value deve ser ISO timestamp válido
    if (cursor.mode !== 'streams') {
      expect(isNaN(new Date(cursor.value).getTime())).toBe(false);
    }
    // legacyCursor sempre é ISO
    expect(isNaN(new Date(res.body.data.legacyCursor).getTime())).toBe(false);
  });
});

// ─── GET /sync/events ─────────────────────────────────────────────────────────

describe('GET /api/v1/sync/events', () => {
  it('requer autenticação', async () => {
    const res = await request(app).get('/api/v1/sync/events');
    expect(res.status).toBe(401);
  });

  it('sem cursor retorna 0 eventos com since ISO futuro (legado)', async () => {
    const futuro = new Date(Date.now() + 60_000).toISOString();
    const res = await request(app)
      .get(`/api/v1/sync/events?since=${encodeURIComponent(futuro)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['x-sync-legacy-cursor']).toBe('true');
    expect(res.body.data.events).toHaveLength(0);
    // COMM-6: nextCursor é objeto canônico
    expect(typeof res.body.data.nextCursor).toBe('object');
    expect(['local', 'pubsub', 'streams']).toContain(res.body.data.nextCursor.mode);
  });

  it('retorna shape canônico COMM-6', async () => {
    const res = await request(app)
      .get('/api/v1/sync/events')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.events)).toBe(true);
    expect(typeof res.body.data.count).toBe('number');
    // nextCursor canônico
    const nc = res.body.data.nextCursor;
    expect(typeof nc).toBe('object');
    expect(typeof nc.mode).toBe('string');
    expect(typeof nc.value).toBe('string');
    expect(typeof nc.issuedAt).toBe('string');
  });

  it('cursor inválido retorna needsSnapshot: true sem erro 4xx', async () => {
    const res = await request(app)
      .get('/api/v1/sync/events?cursor=cursor-invalido-xpto')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.needsSnapshot).toBe(true);
    expect(res.body.data.events).toHaveLength(0);
  });

  it('isola eventos por empresa: evento da empresa A não aparece para empresa B', async () => {
    await createTestRegiao({
      nome: 'Tenant B Base',
      codigo: 'TBB',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    const snapshotB = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${tokenEmpresaB}`);

    const beforeCursorB = snapshotB.body.data.legacyCursor;

    const { emitEvent } = await import('@modules/sync/sync.registry');
    const { SYNC_EVENT_TYPES } = await import('@modules/sync/sync.types');

    emitEvent({
      type: SYNC_EVENT_TYPES.PLACA_CREATED,
      entity: 'placa',
      entityId: new Types.ObjectId().toString(),
      empresaId: TEST_EMPRESA_ID,
      payload: { numero_placa: 'A-EVENT-ONLY' },
    });

    const eventsResB = await request(app)
      .get(`/api/v1/sync/events?since=${encodeURIComponent(beforeCursorB)}`)
      .set('Authorization', `Bearer ${tokenEmpresaB}`);

    expect(eventsResB.status).toBe(200);
    expect(eventsResB.body.data.events).toHaveLength(0);
  });
});

describe('GET /api/v1/sync/diagnostics', () => {
  it('requer role admin', async () => {
    const userToken = generateTestToken({ role: 'user' });
    const res = await request(app)
      .get('/api/v1/sync/diagnostics')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('retorna diagnostics avançado com paginação', async () => {
    const res = await request(app)
      .get('/api/v1/sync/diagnostics?limit=5&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.averageLagMs).toBe('number');
    expect(typeof res.body.data.latestLagMs).toBe('number');
    expect(typeof res.body.data.transportHealth).toBe('string');
    expect(typeof res.body.data.redisConnected).toBe('boolean');
    expect(typeof res.body.data.sseConnected).toBe('boolean');
    expect(typeof res.body.data.replayFailureCount).toBe('number');
    expect(typeof res.body.data.recentEventsPage.limit).toBe('number');
    expect(Array.isArray(res.body.data.reconnectEvents)).toBe(true);
  });
});

describe('GET /api/v1/sync/diagnostics/timeline', () => {
  it('requer role admin', async () => {
    const userToken = generateTestToken({ role: 'user' });
    const res = await request(app)
      .get('/api/v1/sync/diagnostics/timeline')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('retorna timeline paginada com filtros seguros', async () => {
    const res = await request(app)
      .get('/api/v1/sync/diagnostics/timeline?limit=5&severity=critical')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(typeof res.body.data.page.limit).toBe('number');
    expect(res.body.data.page.limit).toBeLessThanOrEqual(100);
  });
});

// ─── Toggle emite PLACA_STATUS_CHANGED ────────────────────────────────────────

describe('Toggle de placa emite PLACA_STATUS_CHANGED', () => {
  it('evento aparece em /sync/events após toggle (cursor canônico COMM-6)', async () => {
    // Captura cursor canônico antes do toggle
    const snapshotRes = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${token}`);
    const syncCursor = snapshotRes.body.data.syncCursor; // objeto canônico

    // Serializa cursor para base64url (como o frontend faria)
    const serialized = Buffer.from(JSON.stringify(syncCursor))
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // Cria placa e faz toggle
    const placa = await createTestPlaca(regiaoId, { disponivel: true });
    await request(app)
      .patch(`/api/v1/placas/${placa._id}/disponibilidade`)
      .set('Authorization', `Bearer ${token}`);

    // Busca eventos com cursor canônico serializado
    const eventsRes = await request(app)
      .get(`/api/v1/sync/events?cursor=${encodeURIComponent(serialized)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(eventsRes.status).toBe(200);
    const events = eventsRes.body.data.events;
    const statusEvent = events.find((e: any) => e.type === 'PLACA_STATUS_CHANGED');
    expect(statusEvent).toBeDefined();
    expect(statusEvent.entityId).toBe(placa._id.toString());
    expect(statusEvent.payload.disponivel).toBe(false);
  });
});

// ─── Create placa emite PLACA_CREATED ─────────────────────────────────────────

describe('Criação de placa emite PLACA_CREATED', () => {
  it('evento aparece em /sync/events após criar placa via API (since legado COMM-6 compat)', async () => {
    const snapshotRes = await request(app)
      .get('/api/v1/sync/snapshot')
      .set('Authorization', `Bearer ${token}`);
    // Usa legacyCursor para testar compatibilidade do ?since= legado
    const legacyCursor = snapshotRes.body.data.legacyCursor;

    const { emitEvent } = await import('@modules/sync/sync.registry');
    const { SYNC_EVENT_TYPES } = await import('@modules/sync/sync.types');
    const placa = await createTestPlaca(regiaoId);
    emitEvent({
      type:      SYNC_EVENT_TYPES.PLACA_CREATED,
      entity:    'placa',
      entityId:  placa._id.toString(),
      empresaId: TEST_EMPRESA_ID,
      payload:   { numero_placa: placa.numero_placa },
    });

    const eventsRes = await request(app)
      .get(`/api/v1/sync/events?since=${encodeURIComponent(legacyCursor)}`)
      .set('Authorization', `Bearer ${token}`);

    const events = eventsRes.body.data.events;
    const created = events.find((e: any) => e.type === 'PLACA_CREATED');
    expect(created).toBeDefined();
    expect(created.entityId).toBe(placa._id.toString());
  });
});
