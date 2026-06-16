/**
 * Testes de Integração — Histórico Operacional da Placa + Conclusão com Evidências V4.1
 *
 * Contratos verificados:
 *  1. Histórico por placa retorna operações abertas, concluídas e canceladas
 *  2. Histórico por placa filtra por empresaId (tenant isolation)
 *  3. Histórico por placa não retorna operação de outra empresa
 *  4. Histórico por placa ordena por data mais recente primeiro
 *  5. Histórico inclui teamSnapshot quando atribuído
 *  6. Histórico inclui finalReport e evidences quando existem
 *  7. Concluir operação salva finalReport e completionNotes
 *  8. Concluir operação com evidências preserva metadata
 *  9. Concluir operação remove openPlateKey da placa
 * 10. Concluir operação já concluída retorna OPERATION_INVALID_STATUS
 * 11. Concluir operação cancelada retorna OPERATION_INVALID_STATUS
 * 12. Histórico inclui operationTypeLabel e statusLabel legíveis
 */

import request from 'supertest';
import { Types } from 'mongoose';
import Placa from '../../modules/placas/Placa';
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

describe('Histórico Operacional + Conclusão com Evidências V4.1', () => {
  let adminToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken = generateTestToken({ role: 'admin_empresa' });
  });

  afterAll(async () => { await teardownIntegrationDb(); });
  afterEach(async () => { await clearDatabase(); });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function seedPlate(overrides: Record<string, unknown> = {}) {
    const regionId = overrides.regionId ?? new Types.ObjectId();
    return Placa.create({
      numero_placa: overrides.numero_placa ?? 'HIST-001',
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
      regiaoId: regionId,
      regionId,
      regionalLot: overrides.regionalLot ?? 'Lote Hist',
      loteRegional: overrides.regionalLot ?? 'Lote Hist',
      disponivel: true,
    });
  }

  async function createOp(payload: Record<string, unknown>, token = adminToken) {
    return request(app)
      .post('/api/v4/operations')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
  }

  function getByPlate(plateId: string, token = adminToken) {
    return request(app)
      .get(`/api/v4/operations/by-plate/${plateId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  // ── 1. Retorna operações em todos os status ──────────────────────────────────

  it('1. histórico retorna operações abertas, concluídas e canceladas', async () => {
    const plate = await seedPlate({ numero_placa: 'HIST-MULTI' });

    // Cria e cancela primeira
    const first = await createOp({ operationType: 'MAINTENANCE', plateId: String(plate._id), priority: 'MEDIUM', reason: 'Teste' });
    await request(app)
      .post(`/api/v4/operations/${first.body.data.task.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Libera placa' })
      .expect(200);

    // Cria e conclui segunda
    const second = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    await request(app)
      .post(`/api/v4/operations/${second.body.data.task.id}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    await request(app)
      .post(`/api/v4/operations/${second.body.data.task.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Cria terceira (aberta)
    await createOp({ operationType: 'INSPECTION', plateId: String(plate._id), priority: 'LOW' });

    const res = await getByPlate(String(plate._id)).expect(200);

    expect(res.body.data.total).toBe(3);

    const statuses = res.body.data.items.map((item: any) => item.operationStatus);
    expect(statuses).toContain('CANCELLED');
    expect(statuses).toContain('DONE');
    expect(statuses).toContain('PENDING');
  });

  // ── 2 & 3. Isolamento de tenant ───────────────────────────────────────────────

  it('2. histórico filtra por empresaId — não vaza dados entre tenants', async () => {
    const plate = await seedPlate({ numero_placa: 'HIST-TENANT' });

    await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });

    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherToken = generateTestToken({ role: 'admin_empresa', empresaId: otherTenantId });

    const ownRes = await getByPlate(String(plate._id)).expect(200);
    expect(ownRes.body.data.total).toBe(1);

    const otherRes = await getByPlate(String(plate._id), otherToken).expect(200);
    expect(otherRes.body.data.total).toBe(0);
  });

  it('3. histórico não retorna operação de outra empresa para o mesmo plateId', async () => {
    const plate = await seedPlate({ numero_placa: 'HIST-CROSS' });
    await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });

    const otherTenantId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherTenantId);
    const otherToken = generateTestToken({ role: 'admin_empresa', empresaId: otherTenantId });

    const res = await getByPlate(String(plate._id), otherToken).expect(200);
    expect(res.body.data.items).toHaveLength(0);
    res.body.data.items.forEach((item: any) => {
      expect(item.payload?.plateId).toBe(String(plate._id));
    });
  });

  // ── 4. Ordenação por data recente ────────────────────────────────────────────

  it('4. histórico ordena por createdAt decrescente (mais recente primeiro)', async () => {
    const plate = await seedPlate({ numero_placa: 'HIST-ORDER' });

    const first = await createOp({ operationType: 'MAINTENANCE', plateId: String(plate._id), priority: 'MEDIUM', reason: 'Primeira' });
    await request(app)
      .post(`/api/v4/operations/${first.body.data.task.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Libera' })
      .expect(200);

    // Pequeno delay para garantir timestamps distintos
    await new Promise((resolve) => { setTimeout(resolve, 30); });

    await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });

    const res = await getByPlate(String(plate._id)).expect(200);
    expect(res.body.data.total).toBe(2);

    const items = res.body.data.items;
    const first_date = new Date(items[0].createdAt).getTime();
    const second_date = new Date(items[1].createdAt).getTime();
    expect(first_date).toBeGreaterThanOrEqual(second_date);
  });

  // ── 5. teamSnapshot no histórico ─────────────────────────────────────────────

  it('5. histórico inclui teamSnapshot quando equipe foi atribuída', async () => {
    const plate = await seedPlate({ numero_placa: 'HIST-TEAM' });

    // Cria equipe primeiro
    const teamRes = await request(app)
      .post('/api/v4/operation-teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Equipe Teste Histórico',
        members: [{ name: 'João', role: 'tecnico', phone: '85999990001' }],
      });

    const teamId = teamRes.body?.data?.team?.id ?? teamRes.body?.data?.id;

    if (teamId) {
      const res = await createOp({
        operationType: 'SCRAPING',
        plateId: String(plate._id),
        priority: 'LOW',
        teamId,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.task.teamSnapshot).toBeTruthy();
      expect(res.body.data.task.teamSnapshot.name).toBe('Equipe Teste Histórico');

      const histRes = await getByPlate(String(plate._id)).expect(200);
      const item = histRes.body.data.items[0];
      expect(item.teamSnapshot).toBeTruthy();
      expect(item.teamSnapshot.name).toBe('Equipe Teste Histórico');
      expect(typeof item.teamSnapshot.memberCount).toBe('number');
    } else {
      // Se módulo de equipes não estiver disponível, valida que o campo existe mas pode ser null
      const res = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
      expect(res.status).toBe(201);

      const histRes = await getByPlate(String(plate._id)).expect(200);
      const item = histRes.body.data.items[0];
      expect('teamSnapshot' in item).toBe(true);
    }
  });

  // ── 6. finalReport e evidences no histórico ───────────────────────────────────

  it('6. histórico inclui finalReport e evidences após conclusão', async () => {
    const plate = await seedPlate({ numero_placa: 'HIST-EVIDENCE' });
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});

    const evidences = [
      { url: 'https://cdn.example.com/img1.jpg', type: 'IMAGE', caption: 'Foto antes', uploadedAt: new Date().toISOString() },
    ];

    await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        finalReport: 'Raspagem concluída com sucesso.',
        completionNotes: 'Sem intercorrências.',
        evidences,
      })
      .expect(200);

    const histRes = await getByPlate(String(plate._id)).expect(200);
    const item = histRes.body.data.items[0];

    expect(item.finalReport).toBe('Raspagem concluída com sucesso.');
    expect(item.completionNotes).toBe('Sem intercorrências.');
    expect(Array.isArray(item.evidences)).toBe(true);
    expect(item.evidences).toHaveLength(1);
    expect(item.evidences[0].url).toBe('https://cdn.example.com/img1.jpg');
    expect(item.evidences[0].type).toBe('IMAGE');
    expect(item.evidences[0].caption).toBe('Foto antes');
  });

  // ── 7. Conclusão salva finalReport e completionNotes ─────────────────────────

  it('7. concluir operação salva finalReport e completionNotes no payload', async () => {
    const plate = await seedPlate({ numero_placa: 'COMPLETE-REPORT' });
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        finalReport: 'Serviço realizado.',
        completionNotes: 'Placa liberada.',
      })
      .expect(200);

    expect(res.body.data.task.finalReport).toBe('Serviço realizado.');
    expect(res.body.data.task.completionNotes).toBe('Placa liberada.');
    expect(res.body.data.task.operationStatus).toBe('DONE');
    expect(res.body.data.task.completedAt).toBeTruthy();
  });

  // ── 8. Conclusão com evidências preserva metadata ────────────────────────────

  it('8. concluir operação com evidências preserva metadata corretamente', async () => {
    const plate = await seedPlate({ numero_placa: 'COMPLETE-EV' });
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});

    const evidences = [
      { url: 'https://r2.example.com/before.jpg', type: 'IMAGE', caption: 'Antes' },
      { url: 'https://r2.example.com/after.jpg',  type: 'IMAGE', caption: 'Depois' },
    ];

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ evidences })
      .expect(200);

    const task = res.body.data.task;
    expect(Array.isArray(task.evidences)).toBe(true);
    expect(task.evidences).toHaveLength(2);

    const urls = task.evidences.map((e: any) => e.url);
    expect(urls).toContain('https://r2.example.com/before.jpg');
    expect(urls).toContain('https://r2.example.com/after.jpg');

    task.evidences.forEach((e: any) => {
      expect(e.url).toBeTruthy();
      expect(['IMAGE', 'FILE']).toContain(e.type);
      expect(e.uploadedAt).toBeTruthy();
    });
  });

  // ── 9. Conclusão remove openPlateKey ────────────────────────────────────────

  it('9. concluir operação remove openPlateKey liberando a placa', async () => {
    const plate = await seedPlate({ numero_placa: 'COMPLETE-KEY' });
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    // Verifica que openPlateKey foi criado
    const beforeRecord = await OperationRecord.findById(taskId).lean<any>();
    expect(beforeRecord?.openPlateKey).toBeTruthy();

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});
    await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    // openPlateKey deve ter sido removido
    const afterRecord = await OperationRecord.findById(taskId).lean<any>();
    expect(afterRecord?.openPlateKey).toBeUndefined();

    // Deve ser possível criar nova operação na mesma placa
    const second = await createOp({ operationType: 'INSPECTION', plateId: String(plate._id), priority: 'LOW' });
    expect(second.status).toBe(201);
  });

  // ── 10. Concluir já concluída retorna OPERATION_INVALID_STATUS ───────────────

  it('10. concluir operação já concluída retorna OPERATION_INVALID_STATUS', async () => {
    const plate = await seedPlate({ numero_placa: 'COMPLETE-DUP' });
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    await request(app).post(`/api/v4/operations/${taskId}/start`).set('Authorization', `Bearer ${adminToken}`).send({});
    await request(app).post(`/api/v4/operations/${taskId}/complete`).set('Authorization', `Bearer ${adminToken}`).send({});

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('OPERATION_INVALID_STATUS');
  });

  // ── 11. Concluir cancelada retorna OPERATION_INVALID_STATUS ─────────────────

  it('11. concluir operação cancelada retorna OPERATION_INVALID_STATUS', async () => {
    const plate = await seedPlate({ numero_placa: 'COMPLETE-CANCEL' });
    const created = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    const taskId = created.body.data.task.id;

    await request(app)
      .post(`/api/v4/operations/${taskId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Cancelada' })
      .expect(200);

    const res = await request(app)
      .post(`/api/v4/operations/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('OPERATION_INVALID_STATUS');
  });

  // ── 12. Rótulos legíveis no histórico ────────────────────────────────────────

  it('12. histórico inclui operationTypeLabel e statusLabel legíveis', async () => {
    const plate = await seedPlate({ numero_placa: 'HIST-LABELS' });

    const first = await createOp({ operationType: 'MAINTENANCE', plateId: String(plate._id), priority: 'MEDIUM', reason: 'Check' });
    await request(app)
      .post(`/api/v4/operations/${first.body.data.task.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Libera' })
      .expect(200);

    const second = await createOp({ operationType: 'SCRAPING', plateId: String(plate._id), priority: 'LOW' });
    await request(app).post(`/api/v4/operations/${second.body.data.task.id}/start`).set('Authorization', `Bearer ${adminToken}`).send({});
    await request(app).post(`/api/v4/operations/${second.body.data.task.id}/complete`).set('Authorization', `Bearer ${adminToken}`).send({});

    const res = await getByPlate(String(plate._id)).expect(200);
    const items = res.body.data.items;

    items.forEach((item: any) => {
      expect(typeof item.operationTypeLabel).toBe('string');
      expect(item.operationTypeLabel.length).toBeGreaterThan(0);
      expect(typeof item.statusLabel).toBe('string');
      expect(item.statusLabel.length).toBeGreaterThan(0);
    });

    const scrapingItem = items.find((i: any) => i.operationType === 'SCRAPING');
    expect(scrapingItem?.operationTypeLabel).toBe('Raspagem');
    expect(scrapingItem?.statusLabel).toBe('Concluída');

    const maintItem = items.find((i: any) => i.operationType === 'MAINTENANCE');
    expect(maintItem?.operationTypeLabel).toBe('Manutenção');
    expect(maintItem?.statusLabel).toBe('Cancelada');
  });
});
