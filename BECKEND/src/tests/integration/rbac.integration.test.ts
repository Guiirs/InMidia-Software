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
import User from '../../modules/users/User';

const EMPRESA_B_ID = new Types.ObjectId().toString();

let vendedorToken: string;
let gestorToken: string;
let financeiroToken: string;
let visualizadorToken: string;
let adminEmpresaToken: string;
let adminEmpresaTokenB: string;
let superadminToken: string;

beforeAll(async () => {
  await setupIntegrationDb();

  vendedorToken = generateTestToken({ role: 'vendedor', email: 'vendedor@inmidia.com' });
  gestorToken = generateTestToken({ role: 'gestor', email: 'gestor@inmidia.com' });
  financeiroToken = generateTestToken({ role: 'financeiro', email: 'financeiro@inmidia.com' });
  visualizadorToken = generateTestToken({ role: 'visualizador', email: 'viewer@inmidia.com' });
  adminEmpresaToken = generateTestToken({ role: 'admin_empresa', email: 'admin-a@inmidia.com' });
  adminEmpresaTokenB = generateTestToken({
    role: 'admin_empresa',
    empresaId: EMPRESA_B_ID,
    email: 'admin-b@inmidia.com',
  });
  superadminToken = generateTestToken({ role: 'superadmin', email: 'superadmin@inmidia.com' });
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

describe('RBAC integration', () => {
  it('vendedor pode ler placas, mas nao pode deletar', async () => {
    const regiao = await createTestRegiao();
    const placa = await createTestPlaca(regiao._id.toString());

    const listRes = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${vendedorToken}`);

    expect(listRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/v1/placas/${placa._id}`)
      .set('Authorization', `Bearer ${vendedorToken}`);

    expect(deleteRes.status).toBe(403);
  });

  it('gestor acessa dashboard e relatorios', async () => {
    const dashboardRes = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${gestorToken}`);

    const relatoriosRes = await request(app)
      .get('/api/v1/relatorios/dashboard-summary')
      .set('Authorization', `Bearer ${gestorToken}`);

    expect(dashboardRes.status).toBe(200);
    expect(relatoriosRes.status).toBe(200);
  });

  it('financeiro acessa contratos, mas nao acessa gestao de usuarios', async () => {
    const contratosRes = await request(app)
      .get('/api/v1/contratos')
      .set('Authorization', `Bearer ${financeiroToken}`);

    const adminUsersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${financeiroToken}`);

    expect(contratosRes.status).toBe(200);
    expect(adminUsersRes.status).toBe(403);
  });

  it('visualizador nao pode criar nem atualizar', async () => {
    const regiao = await createTestRegiao();
    const placa = await createTestPlaca(regiao._id.toString());

    const createRes = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${visualizadorToken}`)
      .send({ numero_placa: 'VIS-001' });

    const updateRes = await request(app)
      .patch(`/api/v1/placas/${placa._id}/disponibilidade`)
      .set('Authorization', `Bearer ${visualizadorToken}`);

    expect(createRes.status).toBe(403);
    expect(updateRes.status).toBe(403);
  });

  it('admin_empresa gerencia usuarios apenas da propria empresa', async () => {
    await User.create({
      username: 'user-a',
      email: 'user-a@inmidia.com',
      senha: '123456',
      nome: 'User A',
      role: 'vendedor',
      empresa: new Types.ObjectId(TEST_EMPRESA_ID),
    });

    await User.create({
      username: 'user-b',
      email: 'user-b@inmidia.com',
      senha: '123456',
      nome: 'User B',
      role: 'vendedor',
      empresa: new Types.ObjectId(EMPRESA_B_ID),
    });

    const resA = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminEmpresaToken}`);

    expect(resA.status).toBe(200);
    expect(Array.isArray(resA.body)).toBe(true);
    expect(resA.body.some((user: any) => user.username === 'user-a')).toBe(true);
    expect(resA.body.some((user: any) => user.username === 'user-b')).toBe(false);
  });

  it('superadmin acessa rotas criticas administrativas e diagnostico', async () => {
    const adminUsersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${superadminToken}`);

    const diagnosticsRes = await request(app)
      .get('/api/v1/sync/diagnostics')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(adminUsersRes.status).toBe(200);
    expect(diagnosticsRes.status).toBe(200);
  });

  it('empresa A nunca acessa dados da empresa B mesmo com role alta', async () => {
    const regiaoA = await createTestRegiao({
      nome: 'Regiao A',
      codigo: 'RA',
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
    });
    const regiaoB = await createTestRegiao({
      nome: 'Regiao B',
      codigo: 'RB',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    await createTestPlaca(regiaoA._id.toString(), {
      numero_placa: 'A-ONLY-PLACA',
      empresaId: new Types.ObjectId(TEST_EMPRESA_ID),
    });
    await createTestPlaca(regiaoB._id.toString(), {
      numero_placa: 'B-ONLY-PLACA',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    const resA = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${adminEmpresaToken}`);

    const resB = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${adminEmpresaTokenB}`);

    const placasA = resA.body.data.map((placa: any) => placa.numero_placa);
    const placasB = resB.body.data.map((placa: any) => placa.numero_placa);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(placasA).toContain('A-ONLY-PLACA');
    expect(placasA).not.toContain('B-ONLY-PLACA');
    expect(placasB).toContain('B-ONLY-PLACA');
    expect(placasB).not.toContain('A-ONLY-PLACA');
  });
});
