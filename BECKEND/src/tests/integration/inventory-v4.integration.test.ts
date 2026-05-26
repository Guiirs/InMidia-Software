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
});
