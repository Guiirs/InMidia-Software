/**
 * Testes de Integração — Operation Area Core V4.1
 *
 * Contratos verificados:
 *  1. Criar instalação com plateId válido
 *  2. Bloquear instalação sem plateId
 *  3. Criar raspagem com plateId
 *  4. Criar manutenção com plateId + motivo
 *  5. Criar bloqueio com plateId + motivo
 *  6. Start muda status para IN_PROGRESS + cria evento timeline
 *  7. Complete muda status para DONE + cria evento timeline
 *  8. Complete instalação atualiza endereço da placa quando informado
 *  9. Complete instalação respeita critical lock (placa com contrato ativo)
 * 10. Cancel muda status para CANCELLED + cria evento timeline
 * 11. Cancel impede cancelar operação já concluída
 * 12. GET / lista com filtros (tipo, status, prioridade)
 * 13. GET /by-plate/:plateId retorna operações da placa
 * 14. GET /by-region/:regionId retorna operações da região
 * 15. GET /:id retorna operação individual
 * 16. Summary calcula atrasadas/críticas corretamente
 * 17. by-region respeita tenant
 * 18. by-plate respeita tenant
 * 19. Eventos OPERATION_PLATE_BLOCKED e OPERATION_PLATE_UNBLOCKED gerados por BLOCK
 */

import request from 'supertest';
import { Types } from 'mongoose';
import Placa from '../../modules/placas/Placa';
import TemporalReservation from '../../modules/temporal/TemporalReservation';
import {
  OperationRecord,
} from '../../modules/operations/services/operations-v4.service';
import {
  app,
  clearDatabase,
  ensureTestEmpresa,
  generateTestToken,
  setupIntegrationDb,
  TEST_EMPRESA_ID,
  teardownIntegrationDb,
} from './setup';

describe('Operation Area Core V4.1 integration', () => {
  let adminToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken  = generateTestToken({ role: 'admin_empresa' });
  });

  afterAll(async () => { await teardownIntegrationDb(); });
  afterEach(async () => { await clearDatabase(); });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function seedPlate(overrides: Record<string, unknown> = {}) {
    const regionId = overrides.regionId ?? new Types.ObjectId();
    return Placa.create({
      numero_placa: overrides.numero_placa ?? 'OP-CORE-001',
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
      regiaoId: regionId,
      regionId,
      regionalLot: overrides.regionalLot ?? 'Lote Core',
      loteRegional: overrides.regionalLot ?? 'Lote Core',
      disponivel: true,
    });
  }

  async function createOp(payload: Record<string, unknown>, token = adminToken) {
    return request(app)
      .post('/api/v4/operations')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
  }

  // ── PARTE 1: Criação com contrato canônico ───────────────────────────────────

  it('1. cria instalação com plateId válido e salva payload canônico', async () => {
    const regionId = new Types.ObjectId();
    const plate = await seedPlate({ regionId, regionalLot: 'Lote Install' });

    const res = await createOp({
      operationType: 'INSTALLATION',
      plateId: String(plate._id),
      priority: 'HIGH',
      scheduledAt: '2026-07-01T08:00:00.000Z',
      dueAt: '2026-07-05T18:00:00.000Z',
      notes: 'Instalação programada',
    });

    expect(res.status).toBe(201);
    const { payload } = res.body.data.task;
    expect(payload.operationType).toBe('INSTALLATION');
    expect(payload.plateId).toBe(String(plate._id));
    expect(payload.regionId).toBe(String(regionId));
    expect(payload.regionalLot).toBe('Lote Install');
    expect(payload.priority).toBe('HIGH');
    expect(payload.slaStatus).toBeDefined();
  });

  it('2. bloqueia instalação sem plateId', async () => {
    const res = await createOp({ operationType: 'INSTALLATION', priority: 'MEDIUM' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('3. cria raspagem com plateId', async () => {
    const plate = await seedPlate();
    const res = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'MEDIUM' });
    expect(res.status).toBe(201);
    expect(res.body.data.task.payload.operationType).toBe('SCRAPING');
    expect(res.body.data.task.payload.plateId).toBe(String(plate._id));
  });

  it('4. cria manutenção com plateId e motivo', async () => {
    const plate = await seedPlate();
    const res = await createOp({
      operationType: 'MAINTENANCE',
      plateId: String(plate._id),
      priority: 'HIGH',
      reason: 'Estrutura danificada por chuva',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.task.payload.operationType).toBe('MAINTENANCE');
  });

  it('5. cria bloqueio com plateId e motivo', async () => {
    const plate = await seedPlate();
    const res = await createOp({
      operationType: 'BLOCK',
      plateId: String(plate._id),
      priority: 'CRITICAL',
      reason: 'Obra no local',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.task.payload.operationType).toBe('BLOCK');
  });

  // ── PARTE 2: Transições de status ─────────────────────────────────────────

  it('6. POST /:id/start muda status para IN_PROGRESS e cria evento timeline', async () => {
    const plate = await seedPlate();
    const created = await createOp({ operationType: 'MAINTENANCE', plateId: String(plate._id), priority: 'MEDIUM' });
    const taskId = created.body.data.task.id;

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    const task = res.body.data.task;
    expect(task.payload.operationStatus).toBe('IN_PROGRESS');
    expect(task.payload.startedAt).toBeTruthy();

    const events = await OperationRecord.find({ empresaId: TEST_EMPRESA_ID, kind: 'event', type: 'OPERATION_STARTED' }).lean();
    expect(events).toHaveLength(1);
  });

  it('7. POST /:id/complete muda status para DONE e cria evento timeline', async () => {
    const plate = await seedPlate();
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.task.payload.operationStatus).toBe('DONE');
    expect(res.body.data.task.payload.completedAt).toBeTruthy();

    const events = await OperationRecord.find({ empresaId: TEST_EMPRESA_ID, kind: 'event', type: 'OPERATION_SCRAPING_COMPLETED' }).lean();
    expect(events).toHaveLength(1);
  });

  it('8. complete instalação atualiza endereço da placa quando informado', async () => {
    const plate = await seedPlate({ numero_placa: 'INST-ADDR' });
    const created = await createOp({
      operationType: 'INSTALLATION',
      plateId: String(plate._id),
      priority: 'HIGH',
    });
    const taskId = created.body.data.task.id;

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newAddress: 'Av. Nova Instalação, 100', newLatitude: -23.55, newLongitude: -46.63 });

    expect(res.status).toBe(200);
    expect(res.body.data.task.payload.operationStatus).toBe('DONE');
    expect(res.body.data.task.payload.installationAddress).toBe('Av. Nova Instalação, 100');

    const updatedPlate = await Placa.findById(plate._id).lean<any>();
    expect(updatedPlate.nomeDaRua).toBe('Av. Nova Instalação, 100');
    expect(updatedPlate.latitude).toBeCloseTo(-23.55);
    expect(updatedPlate.longitude).toBeCloseTo(-46.63);
  });

  it('9. complete instalação respeita critical lock (placa com contrato ativo)', async () => {
    const plate = await seedPlate({ numero_placa: 'CRIT-LOCK' });
    await TemporalReservation.create({
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: new Types.ObjectId().toString(),
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      status: 'ACTIVE',
      reason: 'Contrato ativo',
    });

    const created = await createOp({
      operationType: 'INSTALLATION',
      plateId: String(plate._id),
      priority: 'HIGH',
    });
    const taskId = created.body.data.task.id;
    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newAddress: 'Endereço bloqueado', newLatitude: -23.55, newLongitude: -46.63 });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('10. POST /:id/cancel muda status para CANCELLED e cria evento timeline', async () => {
    const plate = await seedPlate();
    const created = await createOp({ operationType: 'BLOCK', plateId: String(plate._id), priority: 'CRITICAL', reason: 'Teste' });
    const taskId = created.body.data.task.id;

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Situação normalizada' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.payload.operationStatus).toBe('CANCELLED');
    expect(res.body.data.task.payload.cancellationReason).toBe('Situação normalizada');

    const events = await OperationRecord.find({ empresaId: TEST_EMPRESA_ID, kind: 'event', type: 'OPERATION_PLATE_UNBLOCKED' }).lean();
    expect(events).toHaveLength(1);
  });

  it('11. cancel impede cancelar operação já concluída', async () => {
    const plate = await seedPlate();
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});
    await request(app).post(`/api/v4/operations/${taskId}/complete`).set('Authorization', `Bearer ${adminToken}`).send({});

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // ── PARTE 3: Listagem e filtros ──────────────────────────────────────────────

  it('12. GET / lista operações com filtros (tipo, status)', async () => {
    const plate = await seedPlate();
    await createOp({ operationType: 'INSTALLATION', plateId: String(plate._id), priority: 'HIGH' });
    await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });

    const allRes = await request(app).get('/api/v4/operations').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(allRes.body.data.total).toBe(2);

    const filteredRes = await request(app)
      .get('/api/v4/operations')
      .query({ operationType: 'INSTALLATION' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(filteredRes.body.data.total).toBe(1);
    expect(filteredRes.body.data.tasks[0].payload.operationType).toBe('INSTALLATION');
  });

  it('13. GET /by-plate/:plateId retorna operações da placa e respeita tenant', async () => {
    const plate = await seedPlate();
    await createOp({ operationType: 'MAINTENANCE', plateId: String(plate._id), priority: 'MEDIUM' });
    await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });

    const res = await request(app)
      .get(`/api/v4/operations/by-plate/${plate._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.total).toBe(2);
    res.body.data.tasks.forEach((task: any) => {
      expect(task.payload.plateId).toBe(String(plate._id));
    });

    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherToken = generateTestToken({ role: 'admin_empresa', empresaId: otherTenantId });
    const otherRes = await request(app)
      .get(`/api/v4/operations/by-plate/${plate._id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(otherRes.body.data.total).toBe(0);
  });

  it('14. GET /by-region/:regionId retorna operações da região e respeita tenant', async () => {
    const regionId = new Types.ObjectId();
    const plate = await seedPlate({ regionId, regionalLot: 'Lote Filter' });

    await createOp({ operationType: 'INSTALLATION', plateId: String(plate._id), priority: 'HIGH' });

    const res = await request(app)
      .get(`/api/v4/operations/by-region/${regionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.total).toBe(1);
    expect(res.body.data.tasks[0].regionId).toBe(String(regionId));

    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherToken = generateTestToken({ role: 'admin_empresa', empresaId: otherTenantId });
    const otherRes = await request(app)
      .get(`/api/v4/operations/by-region/${regionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(otherRes.body.data.total).toBe(0);
  });

  it('15. GET /:id retorna operação individual', async () => {
    const plate = await seedPlate();
    const created = await createOp({ operationType: 'INSPECTION', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    const res = await request(app)
      .get(`/api/v4/operations/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(taskId);
    expect(res.body.data.payload.operationType).toBe('INSPECTION');
  });

  it('16. summary calcula atrasadas/críticas corretamente', async () => {
    const plate = await seedPlate();
    await createOp({
      operationType: 'MAINTENANCE',
      plateId: String(plate._id),
      priority: 'CRITICAL',
      dueAt: '2020-01-01T00:00:00.000Z',
    });
    await createOp({
      operationType: 'SCRAPING',
      plateId: String(plate._id),
      priority: 'LOW',
      dueAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    });

    const res = await request(app)
      .get('/api/v4/operations/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.sla.overdueOperations).toBeGreaterThanOrEqual(1);
    expect(res.body.data.sla.criticalBacklog).toBeGreaterThanOrEqual(1);
  });

  it('19. start de operação BLOCK gera evento OPERATION_PLATE_BLOCKED', async () => {
    const plate = await seedPlate();
    const created = await createOp({
      operationType: 'BLOCK',
      plateId: String(plate._id),
      priority: 'CRITICAL',
      reason: 'Bloqueio para obra',
    });
    const taskId = created.body.data.task.id;

    await request(app)
      .post(`/api/v4/operations/${taskId}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const events = await OperationRecord.find({
      empresaId: TEST_EMPRESA_ID,
      kind: 'event',
      type: 'OPERATION_PLATE_BLOCKED',
    }).lean();

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(String((event.payload as any).plateId)).toBe(String(plate._id));
  });
});
