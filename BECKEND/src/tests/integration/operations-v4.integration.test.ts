import request from 'supertest';
import { Types } from 'mongoose';
import { eventBus } from '../../modules/realtime/event-bus.service';
import AuditLog from '../../modules/audit/audit.model';
import Placa from '../../modules/placas/Placa';
import {
  OperationRecord,
  OperationsV4Service,
  resolveOperationPlateId,
  resolveOperationRegionId,
  resolveOperationSla,
} from '../../modules/operations/services/operations-v4.service';
import { prepareOperationSlaAlert } from '../../modules/alerts/services/alerts-v4.service';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  TEST_EMPRESA_ID,
  teardownIntegrationDb,
} from './setup';

describe('Operations V4 integration', () => {
  let adminToken: string;
  let gestorToken: string;
  let vendedorToken: string;
  let visualizadorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken        = generateTestToken({ role: 'admin_empresa' });
    gestorToken       = generateTestToken({ role: 'gestor' });
    vendedorToken     = generateTestToken({ role: 'vendedor' });
    visualizadorToken = generateTestToken({ role: 'visualizador' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  async function createPlate(overrides: Record<string, unknown> = {}) {
    return Placa.create({
      numero_placa: overrides.numero_placa ?? 'OP-001',
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
      regiaoId: overrides.regiaoId ?? new Types.ObjectId(),
      regionId: overrides.regionId ?? overrides.regiaoId ?? new Types.ObjectId(),
      regionalLot: overrides.regionalLot ?? 'Lote Norte',
      loteRegional: overrides.loteRegional ?? overrides.regionalLot ?? 'Lote Norte',
      disponivel: true,
    });
  }

  it('resolveOperationPlateId prioriza plateId e usa fallback legado', () => {
    expect(resolveOperationPlateId({ payload: { plateId: 'p1', placaId: 'legacy', boardId: 'board' } })).toBe('p1');
    expect(resolveOperationPlateId({ payload: { placaId: 'legacy' } })).toBe('legacy');
    expect(resolveOperationPlateId({ payload: { boardId: 'board' } })).toBe('board');
    expect(resolveOperationPlateId({ payload: {} })).toBeNull();
  });

  it('resolveOperationRegionId usa payload.regionId e resolve pela placa quando possivel', async () => {
    const regionId = new Types.ObjectId();
    const plate = await createPlate({ regiaoId: regionId, regionId });

    await expect(resolveOperationRegionId({ payload: { regionId: String(regionId) } }, TEST_EMPRESA_ID))
      .resolves.toBe(String(regionId));
    await expect(resolveOperationRegionId({ payload: { plateId: String(plate._id) } }, TEST_EMPRESA_ID))
      .resolves.toBe(String(regionId));
    await expect(resolveOperationRegionId({ payload: {} }, TEST_EMPRESA_ID))
      .resolves.toBeNull();
  });

  it('resolveOperationSla classifica prazos e resolucao', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');

    expect(resolveOperationSla({ payload: {} }, { now }).slaStatus).toBe('UNKNOWN');
    expect(resolveOperationSla({ dueDate: '2026-06-20T12:00:00.000Z', payload: {} }, { now }).slaStatus).toBe('ON_TRACK');
    expect(resolveOperationSla({ dueDate: '2026-06-16T10:00:00.000Z', payload: {} }, { now }).slaStatus).toBe('DUE_SOON');
    const overdue = resolveOperationSla({ dueDate: '2026-06-14T12:00:00.000Z', payload: { priority: 'low' } }, { now });
    expect(overdue.slaStatus).toBe('OVERDUE');
    expect(overdue.overdueMinutes).toBe(1440);
    expect(overdue.slaPriority).toBe('CRITICAL');
    expect(resolveOperationSla({ status: 'done', payload: {} }, { now }).slaStatus).toBe('RESOLVED');
    expect(resolveOperationSla({ status: 'cancelled', payload: {} }, { now }).slaStatus).toBe('CANCELLED');
    expect(resolveOperationSla({
      payload: { startedAt: '2026-06-15T10:00:00.000Z', completedAt: '2026-06-15T11:15:00.000Z' },
    }, { now }).resolutionMinutes).toBe(75);
    expect(resolveOperationSla({ dueDate: '2026-06-15T10:00:00.000Z', payload: { priority: 'critical' } }, { now }).slaPriority).toBe('CRITICAL');
  });

  it('alert bridge prepara alerta de operacao atrasada', () => {
    const alert = prepareOperationSlaAlert({
      _id: 'op-1',
      title: 'Manutencao critica',
      dueDate: '2020-01-01T12:00:00.000Z',
      priority: 'critical',
      payload: { plateId: 'plate-1', regionId: 'region-1' },
    });

    expect(alert).toMatchObject({
      type: 'OPERATION_SLA_OVERDUE',
      severity: 'critical',
      payload: { plateId: 'plate-1', regionId: 'region-1', slaStatus: 'OVERDUE' },
    });
  });

  // ── Auth guard ──────────────────────────────────────────────────

  it('retorna 401 sem token em /timeline', async () => {
    expect((await request(app).get('/api/v4/operations/timeline')).status).toBe(401);
  });

  it('retorna 401 sem token em /summary', async () => {
    expect((await request(app).get('/api/v4/operations/summary')).status).toBe(401);
  });

  it('retorna 401 sem token em /tasks', async () => {
    expect((await request(app).get('/api/v4/operations/tasks')).status).toBe(401);
  });

  // ── Permission guard ────────────────────────────────────────────

  // visualizador tem operations.read
  it('visualizador acessa /summary', async () => {
    const res = await request(app)
      .get('/api/v4/operations/summary')
      .set('Authorization', `Bearer ${visualizadorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // vendedor tem operations.read
  it('vendedor acessa /timeline', async () => {
    const res = await request(app)
      .get('/api/v4/operations/timeline')
      .set('Authorization', `Bearer ${vendedorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Contrato de resposta ─────────────────────────────────────────

  it('GET /timeline retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/operations/timeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { events: expect.any(Array), cursor: null },
    });
  });

  it('GET /summary retorna contrato V4 correto', async () => {
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Atrasada',
      domain: 'operations',
      priority: 'critical',
      status: 'pending',
      dueDate: new Date('2020-01-01T00:00:00.000Z'),
      payload: {},
    });

    const res = await request(app)
      .get('/api/v4/operations/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        health: expect.any(String),
        pendingCount: expect.any(Number),
        completedToday: expect.any(Number),
        sla: expect.objectContaining({
          overdueOperations: expect.any(Number),
          dueSoonOperations: expect.any(Number),
          criticalBacklog: expect.any(Number),
          operationsSlaHealth: expect.any(String),
        }),
      },
    });
    expect(res.body.data.sla.overdueOperations).toBeGreaterThanOrEqual(1);
  });

  it('GET /tasks retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { tasks: expect.any(Array), total: expect.any(Number) },
    });
  });

  it('GET /tasks/pending retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/operations/tasks/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      success: true,
      data: { tasks: expect.any(Array), count: expect.any(Number) },
    });
  });

  it('GET /by-domain retorna contrato V4 correto', async () => {
    const res = await request(app)
      .get('/api/v4/operations/by-domain')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ success: true, data: { byDomain: expect.any(Object) } });
  });

  // ── Todos os endpoints acessíveis para gestor ─────────────────────

  it('gestor acessa todos os endpoints de operations', async () => {
    for (const path of ['/timeline', '/summary', '/tasks', '/tasks/pending', '/by-domain']) {
      const res = await request(app)
        .get(`/api/v4/operations${path}`)
        .set('Authorization', `Bearer ${gestorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('executa writes reais, persiste tarefas/eventos e emite realtime mínimo', async () => {
    const since = new Date(Date.now() - 1000).toISOString();

    const createdRes = await request(app)
      .post('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Validar integração', domain: 'commercial', priority: 'high', dueDate: '2026-06-01' })
      .expect(201);

    const task = createdRes.body.data.task;
    expect(task).toMatchObject({ title: 'Validar integração', domain: 'commercial', priority: 'high', status: 'pending' });

    await request(app)
      .patch(`/api/v4/operations/tasks/${task.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priority: 'medium' })
      .expect(200);

    await request(app)
      .patch(`/api/v4/operations/tasks/${task.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeId: 'user-123' })
      .expect(200);

    await request(app)
      .patch(`/api/v4/operations/tasks/${task.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    await request(app)
      .post('/api/v4/operations/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'manual', domain: 'operations', payload: { taskId: task.id } })
      .expect(201);

    const pending = await request(app)
      .get('/api/v4/operations/tasks/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pending.body.data.count).toBe(0);

    const timeline = await request(app)
      .get('/api/v4/operations/timeline')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(timeline.body.data.events).toHaveLength(1);

    const events = eventBus.getRecentEvents(TEST_EMPRESA_ID, since).map((event) => event.type);
    expect(events).toEqual(expect.arrayContaining([
      'operations.task.created',
      'operations.task.updated',
      'operations.task.assigned',
      'operations.task.completed',
      'operations.event.created',
    ]));
  });

  it('bloqueia criação de tarefas para perfil somente leitura', async () => {
    const res = await request(app)
      .post('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .send({ title: 'Sem permissão', domain: 'operations', priority: 'low' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('isola tarefas por tenant', async () => {
    await request(app)
      .post('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Tenant A', domain: 'operations', priority: 'low' })
      .expect(201);

    const otherTenantToken = generateTestToken({
      role: 'admin_empresa',
      empresaId: new Types.ObjectId().toString(),
    });

    const res = await request(app)
      .get('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .expect(200);

    expect(res.body.data.total).toBe(0);
    expect(res.body.data.tasks).toEqual([]);
  });

  it('nova operacao com plateId valido salva payload canonico', async () => {
    const regionId = new Types.ObjectId();
    const plate = await createPlate({ regiaoId: regionId, regionId, regionalLot: 'Centro A' });

    const res = await request(app)
      .post('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Instalacao premium',
        type: 'installation',
        priority: 'high',
        status: 'scheduled',
        operationScope: 'REGIONAL',
        plateId: String(plate._id),
        dueAt: '2026-06-20T12:00:00.000Z',
      })
      .expect(201);

    const payload = res.body.data.task.payload;
    expect(payload).toMatchObject({
      plateId: String(plate._id),
      operationType: 'INSTALLATION',
      operationStatus: 'SCHEDULED',
      priority: 'HIGH',
      operationScope: 'REGIONAL',
      regionId: String(regionId),
      regionalLot: 'Centro A',
    });
  });

  it('nova operacao com placaId legacy normaliza para plateId', async () => {
    const plate = await createPlate();

    const res = await request(app)
      .post('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Raspagem', type: 'scraping', placaId: String(plate._id), priority: 'critical' })
      .expect(201);

    expect(res.body.data.task.payload.plateId).toBe(String(plate._id));
    expect(res.body.data.task.payload.placaId).toBe(String(plate._id));
    expect(res.body.data.task.payload.operationType).toBe('SCRAPING');
  });

  it('operacao regional sem plateId e bloqueada', async () => {
    const res = await request(app)
      .post('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Manutencao sem placa', type: 'maintenance', operationScope: 'REGIONAL' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('operacao GLOBAL sem plateId e permitida', async () => {
    const res = await request(app)
      .post('/api/v4/operations/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Auditoria administrativa', operationScope: 'GLOBAL', priority: 'low' })
      .expect(201);

    expect(res.body.data.task.payload.plateId).toBeNull();
    expect(res.body.data.task.payload.operationScope).toBe('GLOBAL');
  });

  it('backfill atualiza operacao legacy com placaId e e idempotente', async () => {
    const regionId = new Types.ObjectId();
    const plate = await createPlate({ regiaoId: regionId, regionId, regionalLot: 'Lote Backfill' });
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Legacy placaId',
      domain: 'operations',
      priority: 'high',
      status: 'pending',
      payload: { placaId: String(plate._id), type: 'maintenance' },
    });

    const first = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(first.body.data.updated).toBe(1);
    const updated = await OperationRecord.findOne({ empresaId: TEST_EMPRESA_ID }).lean<any>();
    expect(updated.payload.plateId).toBe(String(plate._id));
    expect(updated.payload.regionId).toBe(String(regionId));
    expect(updated.payload.regionalLot).toBe('Lote Backfill');

    const second = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(second.body.data.updated).toBe(0);
    expect(second.body.data.skippedAlreadyCanonical).toBe(1);
  });

  it('backfill atualiza operacao legacy com boardId', async () => {
    const plate = await createPlate({ numero_placa: 'BOARD-1' });
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Legacy boardId',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { boardId: String(plate._id), type: 'block' },
    });

    const res = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.data.updated).toBe(1);
    const updated = await OperationRecord.findOne({ empresaId: TEST_EMPRESA_ID }).lean<any>();
    expect(updated.payload.plateId).toBe(String(plate._id));
    expect(updated.payload.boardId).toBe(String(plate._id));
  });

  it('backfill atualiza operacao legacy com placa_id', async () => {
    const plate = await createPlate({ numero_placa: 'LEGACY-ID-1' });
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Legacy placa_id',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { placa_id: String(plate._id), type: 'maintenance' },
    });

    const res = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.matchedByLegacyId).toBe(1);
    const updated = await OperationRecord.findOne({ empresaId: TEST_EMPRESA_ID }).lean<any>();
    expect(updated.payload.plateId).toBe(String(plate._id));
    expect(updated.payload.placa_id).toBe(String(plate._id));
  });

  it('backfill atualiza por numeroPlaca quando match e unico no tenant', async () => {
    const plate = await createPlate({ numero_placa: 'UNICA-001' });
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Legacy numeroPlaca',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { numeroPlaca: 'UNICA-001', type: 'scraping' },
    });

    const res = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.matchedByPlateNumber).toBe(1);
    const updated = await OperationRecord.findOne({ empresaId: TEST_EMPRESA_ID }).lean<any>();
    expect(updated.payload.plateId).toBe(String(plate._id));
  });

  it('backfill marca ambiguous quando numeroPlaca encontra multiplas placas', async () => {
    await createPlate({ numero_placa: 'DUP-001' });
    await createPlate({ numero_placa: 'DUP-001' });
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Legacy duplicada',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { numeroPlaca: 'DUP-001', type: 'installation' },
    });

    const res = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.data.updated).toBe(0);
    expect(res.body.data.ambiguous).toBe(1);
    const unchanged = await OperationRecord.findOne({ empresaId: TEST_EMPRESA_ID }).lean<any>();
    expect(unchanged.payload.plateId).toBeUndefined();
  });

  it('backfill nao usa endereco para atualizar automaticamente', async () => {
    await createPlate({ numero_placa: 'ADDR-001', nomeDaRua: 'Rua Ambigua' });
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Legacy endereco',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { endereco: 'Rua Ambigua', type: 'inspection' },
    });

    const res = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.data.updated).toBe(0);
    expect(res.body.data.unresolved).toBe(1);
    const unchanged = await OperationRecord.findOne({ empresaId: TEST_EMPRESA_ID }).lean<any>();
    expect(unchanged.payload.plateId).toBeUndefined();
  });

  it('backfill reporta unresolved quando nao encontra placa', async () => {
    await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Sem placa resolvivel',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { placaId: new Types.ObjectId().toString(), type: 'inspection' },
    });

    const res = await request(app)
      .post('/api/v4/operations/backfill-plate-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.data.updated).toBe(0);
    expect(res.body.data.unresolved).toBe(1);
  });

  it('canonicalization report calcula taxas, breakdowns e samples seguros', async () => {
    await createPlate({ numero_placa: 'DUP-REP' });
    await createPlate({ numero_placa: 'DUP-REP' });
    await OperationRecord.create([
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Canonica',
        domain: 'operations',
        priority: 'high',
        status: 'pending',
        payload: { plateId: new Types.ObjectId().toString() },
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Legada',
        domain: 'operations',
        priority: 'medium',
        status: 'pending',
        payload: { placaId: new Types.ObjectId().toString() },
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Sem vinculo',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: {},
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Ambigua',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: { numeroPlaca: 'DUP-REP', type: 'installation' },
      },
    ]);

    const res = await request(app)
      .get('/api/v4/operations/canonicalization-report')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      totalOperations: 4,
      canonicalOperations: 1,
      legacyOnlyOperations: 2,
      unresolvedOperations: 2,
      ambiguousOperations: 1,
      canonicalizationRate: 25,
      legacyRate: 50,
      unresolvedRate: 50,
    });
    expect(res.body.data.byOperationType).toHaveProperty('INSTALLATION');
    expect(res.body.data.byOperationStatus).toHaveProperty('PENDING');
    expect(res.body.data.samples.unresolved[0]).not.toHaveProperty('payload');
    expect(res.body.data.samples.ambiguous[0]).toMatchObject({ hasPlateNumber: true });
  });

  it('lista fila de resolucao com unresolved e ambiguous sem expor payload bruto', async () => {
    await createPlate({ numero_placa: 'QUEUE-DUP' });
    await createPlate({ numero_placa: 'QUEUE-DUP' });
    await OperationRecord.create([
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Fila unresolved',
        domain: 'operations',
        priority: 'critical',
        status: 'pending',
        createdAt: new Date(Date.now() - 9 * 86400000),
        payload: { endereco: 'Rua Fila', operationType: 'maintenance', priority: 'critical' },
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Fila ambiguous',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: { numeroPlaca: 'QUEUE-DUP', operationType: 'installation' },
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Canonica fora da fila',
        domain: 'operations',
        priority: 'high',
        status: 'pending',
        payload: { plateId: new Types.ObjectId().toString(), secret: 'nao-vazar' },
      },
    ]);

    const res = await request(app)
      .get('/api/v4/operations/link-resolution-queue')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.summary).toMatchObject({
      total: 2,
      unresolved: 1,
      ambiguous: 1,
      olderThan7Days: 1,
      criticalPriority: 1,
    });
    expect(res.body.data.summary.byOperationType).toMatchObject({ MAINTENANCE: 1, INSTALLATION: 1 });
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0]).toMatchObject({
      reason: 'UNRESOLVED',
      priority: 'CRITICAL',
      legacyHints: { addressHint: 'Rua Fila' },
      possibleCandidatesCount: 0,
    });
    expect(res.body.data.items[1]).toMatchObject({
      reason: 'AMBIGUOUS',
      possibleCandidatesCount: 2,
    });
    expect(res.body.data.items[0]).not.toHaveProperty('payload');
    expect(res.body.data.items.map((item: any) => item.safeSummary.title)).not.toContain('Canonica fora da fila');
  });

  it('fila de resolucao respeita tenant', async () => {
    await OperationRecord.create({
      empresaId: new Types.ObjectId().toString(),
      kind: 'task',
      title: 'Outro tenant unresolved',
      domain: 'operations',
      priority: 'critical',
      status: 'pending',
      payload: {},
    });

    const res = await request(app)
      .get('/api/v4/operations/link-resolution-queue')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.summary.total).toBe(0);
  });

  it('fila de resolucao filtra por status, tipo, prioridade, idade e busca', async () => {
    await createPlate({ numero_placa: 'FILTER-DUP' });
    await createPlate({ numero_placa: 'FILTER-DUP' });
    await OperationRecord.create([
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Buscar manutencao antiga',
        domain: 'operations',
        priority: 'critical',
        status: 'pending',
        createdAt: new Date(Date.now() - 12 * 86400000),
        payload: { operationType: 'maintenance', priority: 'critical', endereco: 'Avenida Busca' },
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Instalacao ambigua',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: { numeroPlaca: 'FILTER-DUP', operationType: 'installation', priority: 'low' },
      },
    ]);

    const res = await request(app)
      .get('/api/v4/operations/link-resolution-queue')
      .query({ status: 'unresolved', operationType: 'maintenance', priority: 'critical', age: 7, search: 'busca' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      reason: 'UNRESOLVED',
      operationType: 'MAINTENANCE',
      priority: 'CRITICAL',
    });
    expect(res.body.data.summary.total).toBe(1);
  });

  it('fila de resolucao pagina resultados', async () => {
    await OperationRecord.create([
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Fila pagina 1',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: {},
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Fila pagina 2',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: {},
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Fila pagina 3',
        domain: 'operations',
        priority: 'low',
        status: 'pending',
        payload: {},
      },
    ]);

    const res = await request(app)
      .get('/api/v4/operations/link-resolution-queue')
      .query({ limit: 2, page: 2 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.pagination).toMatchObject({
      page: 2,
      limit: 2,
      total: 3,
      pages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('refresh salva diagnostico unresolved', async () => {
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Diagnostico unresolved',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { endereco: 'Rua Diagnostico' },
    });

    const service = new OperationsV4Service();
    const result = await service.refreshOperationCanonicalizationDiagnostic(String(operation._id), TEST_EMPRESA_ID);

    expect(result.diagnostic).toMatchObject({
      status: 'UNRESOLVED',
      reason: 'address-only-diagnostic',
      matchedBy: 'none',
      safeHints: { addressHint: 'Rua Diagnostico' },
    });
    const updated = await OperationRecord.findById(operation._id).lean<any>();
    expect(updated.payload.metadata.canonicalizationDiagnostic.status).toBe('UNRESOLVED');
  });

  it('refresh salva diagnostico ambiguous', async () => {
    await createPlate({ numero_placa: 'DIAG-DUP' });
    await createPlate({ numero_placa: 'DIAG-DUP' });
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Diagnostico ambiguous',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { numeroPlaca: 'DIAG-DUP' },
    });

    const service = new OperationsV4Service();
    const result = await service.refreshOperationCanonicalizationDiagnostic(String(operation._id), TEST_EMPRESA_ID);

    expect(result.diagnostic).toMatchObject({
      status: 'AMBIGUOUS',
      candidateCount: 2,
      matchedBy: 'plateNumber',
      safeHints: { legacyPlateNumber: 'DIAG-DUP' },
    });
  });

  it('refresh marca canonical quando plateId existe', async () => {
    const plate = await createPlate({ numero_placa: 'DIAG-CAN' });
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Diagnostico canonical',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: { plateId: String(plate._id) },
    });

    const service = new OperationsV4Service();
    const result = await service.refreshOperationCanonicalizationDiagnostic(String(operation._id), TEST_EMPRESA_ID);

    expect(result.diagnostic).toMatchObject({
      status: 'CANONICAL',
      matchedBy: 'plateId',
      candidateCount: 1,
    });
  });

  it('fila usa cache recente sem recalcular', async () => {
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Cache recente',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: {
        metadata: {
          canonicalizationDiagnostic: {
            status: 'UNRESOLVED',
            reason: 'cached-test',
            lastCheckedAt: new Date().toISOString(),
            candidateCount: 0,
            matchedBy: 'none',
            safeHints: { legacyPlateNumber: 'CACHE-OLD', legacyBoardId: null, addressHint: 'Rua Cache' },
          },
        },
      },
    });
    await createPlate({ numero_placa: 'CACHE-OLD' });

    const res = await request(app)
      .get('/api/v4/operations/link-resolution-queue')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.items[0]).toMatchObject({
      operationId: String(operation._id),
      reason: 'UNRESOLVED',
      legacyHints: { legacyPlateNumber: 'CACHE-OLD' },
    });
    const unchanged = await OperationRecord.findById(operation._id).lean<any>();
    expect(unchanged.payload.metadata.canonicalizationDiagnostic.reason).toBe('cached-test');
  });

  it('forceRefresh recalcula diagnostico stale ou cache recente', async () => {
    const plate = await createPlate({ numero_placa: 'CACHE-NEW' });
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Cache force',
      domain: 'operations',
      priority: 'medium',
      status: 'pending',
      payload: {
        numeroPlaca: 'CACHE-NEW',
        metadata: {
          canonicalizationDiagnostic: {
            status: 'UNRESOLVED',
            reason: 'cached-test',
            lastCheckedAt: new Date().toISOString(),
            candidateCount: 0,
            matchedBy: 'none',
            safeHints: { legacyPlateNumber: 'CACHE-NEW', legacyBoardId: null, addressHint: null },
          },
        },
      },
    });

    const res = await request(app)
      .get('/api/v4/operations/link-resolution-queue')
      .query({ forceRefresh: 'true' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.items).toEqual([]);
    const updated = await OperationRecord.findById(operation._id).lean<any>();
    expect(updated.payload.metadata.canonicalizationDiagnostic).toMatchObject({
      status: 'LEGACY_ONLY',
      matchedBy: 'plateNumber',
      candidateCount: 1,
    });
    expect(updated.payload.plateId).toBeUndefined();
    expect(String(plate._id)).toBeTruthy();
  });

  it('endpoint admin atualiza diagnosticos em lote', async () => {
    await createPlate({ numero_placa: 'BATCH-DUP' });
    await createPlate({ numero_placa: 'BATCH-DUP' });
    await OperationRecord.create([
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Batch unresolved',
        domain: 'operations',
        priority: 'medium',
        status: 'pending',
        payload: {},
      },
      {
        empresaId: TEST_EMPRESA_ID,
        kind: 'task',
        title: 'Batch ambiguous',
        domain: 'operations',
        priority: 'medium',
        status: 'pending',
        payload: { numeroPlaca: 'BATCH-DUP' },
      },
    ]);

    const res = await request(app)
      .post('/api/v4/operations/refresh-canonicalization-diagnostics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(res.body.data).toMatchObject({
      totalScanned: 2,
      updated: 2,
      unresolved: 1,
      ambiguous: 1,
    });
  });

  it('bloqueia resolucao manual sem admin', async () => {
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Resolver sem admin',
      domain: 'operations',
      priority: 'low',
      status: 'pending',
      payload: {},
    });
    const plate = await createPlate({ numero_placa: 'MAN-403' });

    const res = await request(app)
      .post(`/api/v4/operations/${operation._id}/resolve-plate-link`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ plateId: String(plate._id), reason: 'Teste' });

    expect(res.status).toBe(403);
  });

  it('bloqueia resolucao manual de operacao de outro tenant', async () => {
    const otherTenant = new Types.ObjectId().toString();
    const operation = await OperationRecord.create({
      empresaId: otherTenant,
      kind: 'task',
      title: 'Outro tenant',
      domain: 'operations',
      priority: 'low',
      status: 'pending',
      payload: {},
    });
    const plate = await createPlate({ numero_placa: 'MAN-404' });

    const res = await request(app)
      .post(`/api/v4/operations/${operation._id}/resolve-plate-link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plateId: String(plate._id), reason: 'Teste' });

    expect(res.status).toBe(404);
  });

  it('bloqueia resolucao manual com placa de outro tenant', async () => {
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Placa outro tenant',
      domain: 'operations',
      priority: 'low',
      status: 'pending',
      payload: {},
    });
    const otherPlate = await Placa.create({
      numero_placa: 'OTHER-PLATE',
      empresaId: new Types.ObjectId(),
      regiaoId: new Types.ObjectId(),
      disponivel: true,
    });

    const res = await request(app)
      .post(`/api/v4/operations/${operation._id}/resolve-plate-link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plateId: String(otherPlate._id), reason: 'Teste' });

    expect(res.status).toBe(404);
  });

  it('resolve operacao unresolved manualmente, preserva legado, deriva regiao/lote e audita', async () => {
    const regionId = new Types.ObjectId();
    const plate = await createPlate({ numero_placa: 'MAN-001', regiaoId: regionId, regionId, regionalLot: 'Manual Lote' });
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Manual unresolved',
      domain: 'operations',
      priority: 'low',
      status: 'pending',
      payload: { numeroPlaca: 'NAO-EXISTE', endereco: 'Rua Manual', notes: 'preservar' },
    });

    const beforeReport = await request(app)
      .get('/api/v4/operations/canonicalization-report')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(beforeReport.body.data.unresolvedOperations).toBe(1);

    const res = await request(app)
      .post(`/api/v4/operations/${operation._id}/resolve-plate-link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plateId: String(plate._id), reason: 'Correcao manual da operacao legacy' })
      .expect(200);

    expect(res.body.data.task.payload).toMatchObject({
      plateId: String(plate._id),
      regionId: String(regionId),
      regionalLot: 'Manual Lote',
      numeroPlaca: 'NAO-EXISTE',
      endereco: 'Rua Manual',
      notes: 'preservar',
      metadata: {
        manualResolution: true,
        manualResolutionReason: 'Correcao manual da operacao legacy',
        canonicalizationDiagnostic: {
          status: 'CANONICAL',
          reason: 'manual-resolution',
          matchedBy: 'plateId',
        },
      },
    });
    expect(res.body.data.task.payload.metadata.manualResolvedAt).toBeTruthy();
    expect(res.body.data.task.payload.metadata.manualResolvedBy).toBeTruthy();

    const audit = await AuditLog.findOne({
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
      action: 'operation.plate_link.resolved',
      entityId: String(operation._id),
    }).lean();
    expect(audit).toBeTruthy();

    const afterReport = await request(app)
      .get('/api/v4/operations/canonicalization-report')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(afterReport.body.data.unresolvedOperations).toBe(0);
    expect(afterReport.body.data.canonicalOperations).toBe(1);
  });

  it('retorna contexto seguro de resolucao com candidatos e hints', async () => {
    const plate = await createPlate({ numero_placa: 'CTX-001', nomeDaRua: 'Rua Contexto' });
    const operation = await OperationRecord.create({
      empresaId: TEST_EMPRESA_ID,
      kind: 'task',
      title: 'Contexto',
      domain: 'operations',
      priority: 'low',
      status: 'pending',
      payload: { numeroPlaca: 'CTX-001', endereco: 'Rua Contexto', secret: 'nao-vazar' },
    });

    const res = await request(app)
      .get(`/api/v4/operations/${operation._id}/link-resolution-context`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.operation).toMatchObject({
      operationId: String(operation._id),
      legacyPlateNumber: 'CTX-001',
      addressHint: 'Rua Contexto',
    });
    expect(res.body.data.operation).not.toHaveProperty('payload');
    expect(res.body.data.candidates[0]).toMatchObject({ plateId: String(plate._id), plateNumber: 'CTX-001' });
    expect(res.body.data.legacyFields).toMatchObject({ plateNumbers: ['CTX-001'], addressHint: 'Rua Contexto' });
  });
});
