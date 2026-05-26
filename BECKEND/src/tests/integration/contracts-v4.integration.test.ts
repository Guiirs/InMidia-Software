import request from 'supertest';
import { Types } from 'mongoose';
import {
  app,
  clearDatabase,
  createTestPlaca,
  createTestRegiao,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
  TEST_EMPRESA_ID,
} from './setup';
import Cliente from '../../modules/clientes/Cliente';
import { eventBus } from '../../modules/realtime/event-bus.service';
import { OPERATIONAL_EVENT_TYPES } from '../../modules/realtime/domain-events';

describe('Contracts V4 integration', () => {
  let token: string;
  let viewerToken: string;
  let otherTenantToken: string;
  let boardId: string;
  let clientId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    token = generateTestToken({ role: 'admin_empresa' });
    viewerToken = generateTestToken({ role: 'visualizador' });
    otherTenantId = new Types.ObjectId().toString();
    otherTenantToken = generateTestToken({ role: 'admin_empresa', empresaId: otherTenantId });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  beforeEach(async () => {
    await clearDatabase();
    const regiao = await createTestRegiao();
    const placa = await createTestPlaca(String(regiao._id));
    const cliente = await Cliente.create({
      nome: 'Cliente Contracts V4',
      cpfCnpj: `00.000.000/0001-${Math.floor(Math.random() * 90 + 10)}`,
      email: 'contracts-v4@inmidia.com',
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
    });

    boardId = String(placa._id);
    clientId = String(cliente._id);
  });

  it('creates and lists operational contracts through the V4 contract', async () => {
    const createRes = await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boardId,
        clientId,
        startDate: '2026-05-01',
        endDate: '2026-07-01',
        observacoes: 'Campanha V4',
      })
      .expect(201);

    expect(createRes.body).toMatchObject({ success: true });
    expect(createRes.body.data).toMatchObject({
      boardId,
      clientName: 'Cliente Contracts V4',
      status: 'active',
    });

    const listRes = await request(app)
      .get('/api/v4/contracts/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(createRes.body.data.id);
  });

  it('serves summary, active and expiring resources with success/data envelope', async () => {
    await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boardId,
        clientId,
        startDate: '2026-05-01',
        endDate: '2026-05-30',
      })
      .expect(201);

    const [summaryRes, activeRes, expiringRes] = await Promise.all([
      request(app).get('/api/v4/contracts/summary').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v4/contracts/active').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v4/contracts/expiring?days=30').set('Authorization', `Bearer ${token}`),
    ]);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.success).toBe(true);
    expect(summaryRes.body.data.totals.activeContracts).toBeGreaterThanOrEqual(1);
    expect(activeRes.body).toMatchObject({ success: true });
    expect(expiringRes.body).toMatchObject({ success: true });
  });

  it('serves a real timeline resource with success/data envelope', async () => {
    await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boardId,
        clientId,
        startDate: '2026-05-01',
        endDate: '2026-06-01',
      })
      .expect(201);

    const res = await request(app)
      .get('/api/v4/contracts/timeline')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.timeline).toHaveLength(1);
    expect(res.body.data.timeline[0]).toMatchObject({
      type: 'contract',
      clientName: 'Cliente Contracts V4',
    });
  });

  it('updates status, cancels and renews contracts', async () => {
    const createRes = await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boardId,
        clientId,
        startDate: '2026-05-01',
        endDate: '2026-07-01',
      })
      .expect(201);

    const id = createRes.body.data.id;

    const updateRes = await request(app)
      .put(`/api/v4/contracts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ observacoes: 'Atualizado pelo Sync Core' })
      .expect(200);

    expect(updateRes.body.success).toBe(true);

    const cancelRes = await request(app)
      .post(`/api/v4/contracts/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Teste de cancelamento' })
      .expect(200);

    expect(cancelRes.body.data.status).toBe('cancelled');

    const renewRes = await request(app)
      .post(`/api/v4/contracts/${id}/renew`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newEndDate: '2026-08-15' })
      .expect(200);

    expect(renewRes.body.success).toBe(true);
    expect(renewRes.body.data.status).toBe('active');
    expect(renewRes.body.data.endDate).toContain('2026-08-15');
  });

  it('keeps contracts isolated by tenant', async () => {
    const otherRegiao = await createTestRegiao({ empresaId: new Types.ObjectId(otherTenantId) });
    const otherBoard = await createTestPlaca(String(otherRegiao._id), { empresaId: new Types.ObjectId(otherTenantId) });
    const otherClient = await Cliente.create({
      nome: 'Cliente Outro Tenant',
      cpfCnpj: `11.000.000/0001-${Math.floor(Math.random() * 90 + 10)}`,
      email: 'contracts-v4-other@inmidia.com',
      empresaId: new Types.ObjectId(otherTenantId),
    });

    await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .send({
        boardId: String(otherBoard._id),
        clientId: String(otherClient._id),
        startDate: '2026-05-01',
        endDate: '2026-07-01',
      })
      .expect(201);

    const res = await request(app)
      .get('/api/v4/contracts/list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 401 without token and 403 without granular permission', async () => {
    await request(app)
      .get('/api/v4/contracts/list')
      .expect(401);

    const forbiddenRes = await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        boardId,
        clientId,
        startDate: '2026-05-01',
        endDate: '2026-07-01',
      })
      .expect(403);

    expect(forbiddenRes.body.success).toBe(false);
  });

  it('emits realtime contract events for mutations', async () => {
    const emitSpy = jest.spyOn(eventBus, 'emitFromInput');

    const createRes = await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        boardId,
        clientId,
        startDate: '2026-05-01',
        endDate: '2026-07-01',
      })
      .expect(201);

    await request(app)
      .patch(`/api/v4/contracts/${createRes.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' })
      .expect(200);

    await request(app)
      .post(`/api/v4/contracts/${createRes.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Teste de evento' })
      .expect(200);

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: OPERATIONAL_EVENT_TYPES.CONTRACT_CREATED,
    }));
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: OPERATIONAL_EVENT_TYPES.CONTRACT_STATUS_CHANGED,
    }));
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: OPERATIONAL_EVENT_TYPES.CONTRACT_CANCELLED,
    }));

    emitSpy.mockRestore();
  });

  it('keeps V4 errors in the standardized contract', async () => {
    const res = await request(app)
      .post('/api/v4/contracts')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId: 'invalid' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBeDefined();
    expect(res.body.message).toBeDefined();
  });
});
