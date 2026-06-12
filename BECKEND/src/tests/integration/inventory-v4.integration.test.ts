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
import Placa from '../../modules/placas/Placa';
import { OperationRecord } from '../../modules/operations/services/operations-v4.service';

const EMPRESA_B_ID = new Types.ObjectId().toString();

let token: string;
let tokenB: string;
let financeiroToken: string;
let visualizadorToken: string;

beforeAll(async () => {
  await setupIntegrationDb();
  token = generateTestToken({ role: 'admin_empresa' });
  tokenB = generateTestToken({ role: 'admin_empresa', empresaId: EMPRESA_B_ID, email: 'tenant-b@inmidia.com' });
  financeiroToken = generateTestToken({ role: 'financeiro', email: 'financeiro@inmidia.com' });
  visualizadorToken = generateTestToken({ role: 'visualizador', email: 'viewer@inmidia.com' });
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

async function seedInventory() {
  const regiaoA = await createTestRegiao({ nome: 'Norte', codigo: 'NOR' });
  const regiaoB = await createTestRegiao({
    nome: 'Tenant B',
    codigo: 'TB',
    empresaId: new Types.ObjectId(EMPRESA_B_ID),
  });

  const boardA = await createTestPlaca(regiaoA._id.toString(), {
    numero_placa: 'INV-A-001',
    nomeDaRua: 'Rua A',
    disponivel: true,
  });
  const boardA2 = await createTestPlaca(regiaoA._id.toString(), {
    numero_placa: 'INV-A-002',
    nomeDaRua: 'Rua B',
    disponivel: false,
  });
  const boardB = await createTestPlaca(regiaoB._id.toString(), {
    numero_placa: 'INV-B-001',
    empresaId: new Types.ObjectId(EMPRESA_B_ID),
  });

  return { regiaoA, boardA, boardA2, boardB };
}

describe('Inventory V4 integration', () => {
  it('GET /api/v4/inventory/boards retorna contrato V4 paginado e isolado por tenant', async () => {
    await seedInventory();

    const res = await request(app)
      .get('/api/v4/inventory/boards?page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({
      boards: expect.any(Array),
      total: 2,
      page: 1,
      limit: 1,
      totalPages: 2,
    }));
    expect(res.body.data.boards).toHaveLength(1);
    expect(res.body.data.boards[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      codigo: expect.any(String),
      status: expect.any(String),
      disponivel: expect.any(Boolean),
    }));
  });

  it('aplica filtros reais por status e busca', async () => {
    await seedInventory();

    const available = await request(app)
      .get('/api/v4/inventory/boards?status=available')
      .set('Authorization', `Bearer ${token}`);
    const search = await request(app)
      .get('/api/v4/inventory/boards?search=INV-A-002')
      .set('Authorization', `Bearer ${token}`);

    expect(available.status).toBe(200);
    expect(available.body.data.boards.every((board: any) => board.status === 'available')).toBe(true);
    expect(search.status).toBe(200);
    expect(search.body.data.total).toBe(1);
    expect(search.body.data.boards[0].codigo).toBe('INV-A-002');
  });

  it('GET /api/v4/inventory/boards/:id retorna detalhe real', async () => {
    const { boardA } = await seedInventory();

    const res = await request(app)
      .get(`/api/v4/inventory/boards/${boardA._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.codigo).toBe('INV-A-001');
  });

  it('GET /api/v4/inventory/regions agrupa placas reais por regiao e tenant', async () => {
    await seedInventory();

    const res = await request(app)
      .get('/api/v4/inventory/regions')
      .set('Authorization', `Bearer ${token}`);
    const tenantB = await request(app)
      .get('/api/v4/inventory/regions')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({
      regions: expect.any(Array),
      total: 1,
    }));
    expect(res.body.data.regions[0]).toEqual(expect.objectContaining({
      name: 'Norte',
      totalBoards: 2,
      availableBoards: 1,
      maintenanceBoards: 1,
      boards: expect.any(Array),
    }));
    expect(res.body.data.regions[0].boards).toHaveLength(2);
    expect(tenantB.status).toBe(200);
    expect(tenantB.body.data.total).toBe(1);
    expect(tenantB.body.data.regions[0].totalBoards).toBe(1);
  });

  it('PATCH /api/v4/inventory/boards/:id atualiza placa com inventory.update', async () => {
    const { boardA } = await seedInventory();

    const res = await request(app)
      .patch(`/api/v4/inventory/boards/${boardA._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'INV-A-EDIT', nomeDaRua: 'Rua Editada' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.codigo).toBe('INV-A-EDIT');

    const db = await Placa.findById(boardA._id).lean();
    expect(db?.numero_placa).toBe('INV-A-EDIT');
    expect(db?.nomeDaRua).toBe('Rua Editada');
  });

  it('PATCH /api/v4/inventory/boards/:id rejeita conflito normalizado e permite manter o proprio numero', async () => {
    const { boardA, boardA2 } = await seedInventory();

    const conflict = await request(app)
      .patch(`/api/v4/inventory/boards/${boardA._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: `  ${String(boardA2.numero_placa).toLowerCase()}  ` });

    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('PLATE_NAME_CONFLICT');

    const same = await request(app)
      .patch(`/api/v4/inventory/boards/${boardA._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: `  ${String(boardA.numero_placa).toLowerCase()}  ` });

    expect(same.status).toBe(200);
  });

  it('PATCH /api/v4/inventory/boards/:id normaliza coordenadas e bloqueia par parcial', async () => {
    const { boardA } = await seedInventory();

    const updated = await request(app)
      .patch(`/api/v4/inventory/boards/${boardA._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: '-3,742352', longitude: '-38,608361' });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toEqual(expect.objectContaining({
      latitude: -3.742352,
      longitude: -38.608361,
      coordenadas: '-3.742352,-38.608361',
    }));
    expect(await Placa.findById(boardA._id).lean()).toEqual(expect.objectContaining({
      latitude: -3.742352,
      longitude: -38.608361,
      coordenadas: '-3.742352,-38.608361',
    }));

    const partial = await request(app)
      .patch(`/api/v4/inventory/boards/${boardA._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: '-4.0' });
    expect(partial.status).toBe(400);
    expect(partial.body.message).toContain('Latitude e longitude devem ser informados juntos');
  });

  it('PATCH /api/v4/inventory/boards/:id/availability alterna disponibilidade', async () => {
    const { boardA } = await seedInventory();

    const res = await request(app)
      .patch(`/api/v4/inventory/boards/${boardA._id}/availability`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.disponivel).toBe(false);
  });

  it('bloqueia sem token e sem permissao V4', async () => {
    const { boardA } = await seedInventory();

    const noToken = await request(app).get('/api/v4/inventory/boards');
    const noRead = await request(app)
      .get('/api/v4/inventory/summary')
      .set('Authorization', `Bearer ${financeiroToken}`);
    const regionsNoRead = await request(app)
      .get('/api/v4/inventory/regions')
      .set('Authorization', `Bearer ${financeiroToken}`);
    const noUpdate = await request(app)
      .patch(`/api/v4/inventory/boards/${boardA._id}`)
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .send({ nomeDaRua: 'Nao pode' });

    expect(noToken.status).toBe(401);
    expect(noRead.status).toBe(403);
    expect(regionsNoRead.status).toBe(403);
    expect(noUpdate.status).toBe(403);
  });

  it('nao permite update de placa de outro tenant', async () => {
    const { boardB } = await seedInventory();

    const resA = await request(app)
      .patch(`/api/v4/inventory/boards/${boardB._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ numero_placa: 'TENANT-LEAK' });

    const resB = await request(app)
      .get('/api/v4/inventory/boards')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resA.status).toBe(404);
    expect(resB.status).toBe(200);
    expect(resB.body.data.total).toBe(1);
    expect(resB.body.data.boards[0].codigo).toBe('INV-B-001');
  });

  it('summary V4 usa inventory.read e retorna contrato success/data', async () => {
    await seedInventory();

    const res = await request(app)
      .get('/api/v4/inventory/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totals.totalBoards).toBe(2);
    expect(res.body.data.totals.availableBoards).toBe(1);
    expect(String(TEST_EMPRESA_ID)).toHaveLength(24);
  });

  // ── Raspagem (SCRAPING) → operationalBlock no board (suporte ao mapa) ──────

  describe('Raspagem aberta reflete operationalBlock no board', () => {
    it('placa com raspagem aberta retorna operationalBlock bloqueado com label de Raspagem', async () => {
      const { boardA } = await seedInventory();

      const createRes = await request(app)
        .post('/api/v4/operations')
        .set('Authorization', `Bearer ${token}`)
        .send({ operationType: 'SCRAPING', plateId: String(boardA._id), priority: 'MEDIUM' });

      expect(createRes.status).toBe(201);
      const operationId = createRes.body.data.task.id;
      expect(createRes.body.data.task.payload.plateId).toBe(String(boardA._id));

      const operationDoc = await OperationRecord.findById(operationId).lean<any>();
      expect(operationDoc?.openPlateKey).toBe(`${TEST_EMPRESA_ID}:${String(boardA._id)}`);

      const res = await request(app)
        .get('/api/v4/inventory/boards')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const board = res.body.data.boards.find((b: any) => b.id === String(boardA._id));
      expect(board).toBeDefined();
      expect(board.operationalBlock).toMatchObject({
        blocked: true,
        operationType: 'SCRAPING',
        operationStatus: 'PENDING',
        label: 'Raspagem pendente',
      });
      expect(board.commercialProjection.operationalBlock).toMatchObject({ blocked: true, operationType: 'SCRAPING' });
    });

    it('apos concluir a raspagem, o openPlateKey e o operationalBlock somem do board', async () => {
      const { boardA } = await seedInventory();

      const createRes = await request(app)
        .post('/api/v4/operations')
        .set('Authorization', `Bearer ${token}`)
        .send({ operationType: 'SCRAPING', plateId: String(boardA._id), priority: 'MEDIUM' });
      const operationId = createRes.body.data.task.id;

      await request(app)
        .post(`/api/v4/operations/${operationId}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      let res = await request(app)
        .get('/api/v4/inventory/boards')
        .set('Authorization', `Bearer ${token}`);
      let board = res.body.data.boards.find((b: any) => b.id === String(boardA._id));
      expect(board.operationalBlock).toMatchObject({
        blocked: true,
        operationType: 'SCRAPING',
        operationStatus: 'IN_PROGRESS',
        label: 'Raspagem em andamento',
      });

      const completeRes = await request(app)
        .post(`/api/v4/operations/${operationId}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.task.payload.operationStatus).toBe('DONE');

      const operationDoc = await OperationRecord.findById(operationId).lean<any>();
      expect(operationDoc?.openPlateKey).toBeUndefined();

      res = await request(app)
        .get('/api/v4/inventory/boards')
        .set('Authorization', `Bearer ${token}`);
      board = res.body.data.boards.find((b: any) => b.id === String(boardA._id));
      expect(board.operationalBlock).toBeUndefined();
      expect(board.commercialProjection.operationalBlock).toBeUndefined();
    });
  });
});
