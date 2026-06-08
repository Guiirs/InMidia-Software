import request from 'supertest';
import { Types } from 'mongoose';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  generateTestToken,
  ensureTestEmpresa,
} from '../../../tests/integration/setup';
import Checking from '../Checking';
import Aluguel from '@modules/alugueis/Aluguel';
import { CheckingRepository } from '../repositories/checking.repository';
import { CheckingService } from '../services/checking.service';

const empresaA = new Types.ObjectId().toString();
const empresaB = new Types.ObjectId().toString();
const userA = new Types.ObjectId().toString();

function auth(empresaId: string, userId = new Types.ObjectId().toString()) {
  return `Bearer ${generateTestToken({ empresaId, id: userId, role: 'admin_empresa' })}`;
}

async function createAluguel(empresaId: string, placaId = new Types.ObjectId()) {
  return Aluguel.create({
    empresaId: new Types.ObjectId(empresaId),
    placaId,
    clienteId: new Types.ObjectId(),
    periodType: 'custom',
    valor_mensal: 1000,
    status: 'ativo',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
  });
}

async function createChecking(empresaId: string, overrides: Record<string, unknown> = {}) {
  const placaId = new Types.ObjectId();
  const aluguel = await createAluguel(empresaId, placaId);
  const checking = await Checking.create({
    empresaId: new Types.ObjectId(empresaId),
    aluguelId: aluguel._id,
    placaId,
    installerId: new Types.ObjectId(),
    photoUrl: 'https://example.com/photo.jpg',
    gpsCoordinates: { latitude: -23.5, longitude: -46.6 },
    ...overrides,
  });
  return { aluguel, checking };
}

beforeAll(async () => {
  await setupIntegrationDb();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

beforeEach(async () => {
  await clearDatabase();
  await ensureTestEmpresa(empresaA);
  await ensureTestEmpresa(empresaB);
  await Checking.deleteMany({});
  await Aluguel.deleteMany({});
});

describe('checking multi-tenant API', () => {
  it('tenant A nao lista checkings do tenant B', async () => {
    await createChecking(empresaA);
    await createChecking(empresaB);

    const res = await request(app)
      .get('/api/v1/checking')
      .set('Authorization', auth(empresaA, userA));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(String(res.body.data[0].empresaId)).toBe(empresaA);
  });

  it('tenant A nao acessa checking por id do tenant B', async () => {
    const { checking } = await createChecking(empresaB);

    const res = await request(app)
      .get(`/api/v1/checking/${checking._id}`)
      .set('Authorization', auth(empresaA, userA));

    expect(res.status).toBe(404);
  });

  it('tenant A nao atualiza checking do tenant B', async () => {
    const { checking } = await createChecking(empresaB);

    const res = await request(app)
      .patch(`/api/v1/checking/${checking._id}`)
      .set('Authorization', auth(empresaA, userA))
      .send({ photoUrl: 'https://example.com/changed.jpg' });

    expect(res.status).toBe(404);
    const reread = await Checking.findById(checking._id).lean<any>();
    expect(reread?.photoUrl).toBe('https://example.com/photo.jpg');
  });

  it('tenant A nao deleta checking do tenant B', async () => {
    const { checking } = await createChecking(empresaB);

    const res = await request(app)
      .delete(`/api/v1/checking/${checking._id}`)
      .set('Authorization', auth(empresaA, userA));

    expect(res.status).toBe(404);
    await expect(Checking.exists({ _id: checking._id })).resolves.toBeTruthy();
  });

  it('create ignora empresaId enviado no body e grava tenant autenticado', async () => {
    const placaId = new Types.ObjectId();
    const aluguelA = await createAluguel(empresaA, placaId);

    const res = await request(app)
      .post('/api/v1/checking')
      .set('Authorization', auth(empresaA, userA))
      .send({
        empresaId: empresaB,
        aluguelId: String(aluguelA._id),
        placaId: String(placaId),
        installerId: userA,
        photoUrl: 'https://example.com/new.jpg',
        gpsCoordinates: { latitude: -23.5, longitude: -46.6 },
      });

    expect(res.status).toBe(201);
    expect(String(res.body.data.empresaId)).toBe(empresaA);
  });

  it('create usando aluguelId de outro tenant falha', async () => {
    const placaId = new Types.ObjectId();
    const aluguelB = await createAluguel(empresaB, placaId);

    const res = await request(app)
      .post('/api/v1/checking')
      .set('Authorization', auth(empresaA, userA))
      .send({
        aluguelId: String(aluguelB._id),
        placaId: String(placaId),
        installerId: userA,
        photoUrl: 'https://example.com/new.jpg',
        gpsCoordinates: { latitude: -23.5, longitude: -46.6 },
      });

    expect(res.status).toBe(404);
  });

  it('rota /aluguel/:aluguelId nao e sombreada por /:id', async () => {
    const { aluguel } = await createChecking(empresaA);

    const res = await request(app)
      .get(`/api/v1/checking/aluguel/${aluguel._id}`)
      .set('Authorization', auth(empresaA, userA));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('checking multi-tenant service', () => {
  it('findByAluguelId filtra por empresaId', async () => {
    const { aluguel } = await createChecking(empresaB);
    await createChecking(empresaA);

    const service = new CheckingService(new CheckingRepository(Checking));
    const result = await service.getCheckingsByAluguel(String(aluguel._id), empresaA);

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(0);
  });
});
