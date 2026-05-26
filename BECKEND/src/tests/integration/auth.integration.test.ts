import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

import {
  app,
  clearDatabase,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';
import Empresa from '@modules/empresas/Empresa';
import User from '@modules/users/User';

const PASSWORD = 'SenhaForte123';

async function createEmpresa(overrides: Record<string, unknown> = {}) {
  return Empresa.create({
    nome: 'Empresa Auth Teste',
    cnpj: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 14).padEnd(14, '0'),
    ...overrides,
  });
}

async function createUser(overrides: Record<string, unknown> = {}) {
  const empresa = await createEmpresa();
  const user = await User.create({
    username: `authuser${Date.now()}${Math.floor(Math.random() * 1000)}`,
    email: `auth${Date.now()}${Math.floor(Math.random() * 1000)}@inmidia.com`,
    nome: 'Usuario Auth',
    role: 'admin',
    empresa: empresa._id,
    password: PASSWORD,
    ...overrides,
  });

  return { empresa, user };
}

describe('Auth integration', () => {
  const originalMasterEmail = process.env.MASTER_LOGIN_EMAIL;
  const originalMasterUsername = process.env.MASTER_LOGIN_USERNAME;
  const originalMasterPassword = process.env.MASTER_LOGIN_PASSWORD;

  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterEach(async () => {
    process.env.MASTER_LOGIN_EMAIL = originalMasterEmail;
    process.env.MASTER_LOGIN_USERNAME = originalMasterUsername;
    process.env.MASTER_LOGIN_PASSWORD = originalMasterPassword;
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  it('faz login normal com usuario valido', async () => {
    const { user } = await createUser({ email: 'normal@inmidia.com' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe('normal@inmidia.com');
  });

  it('retorna 401 para login invalido', async () => {
    const { user } = await createUser({ email: 'invalid@inmidia.com' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'senha-errada' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('faz login master valido', async () => {
    process.env.MASTER_LOGIN_EMAIL = 'master-test@inmidia.com';
    process.env.MASTER_LOGIN_USERNAME = 'mastertest';
    process.env.MASTER_LOGIN_PASSWORD = 'MasterSeguro123';

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'master-test@inmidia.com', password: 'MasterSeguro123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.email).toBe('master-test@inmidia.com');
  });

  it('nao habilita login master quando MASTER_LOGIN_PASSWORD esta ausente', async () => {
    process.env.MASTER_LOGIN_EMAIL = 'master-disabled@inmidia.com';
    process.env.MASTER_LOGIN_USERNAME = 'masterdisabled';
    delete process.env.MASTER_LOGIN_PASSWORD;

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'master-disabled@inmidia.com', password: 'Master@123' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('MASTER_LOGIN_CONFIG_INVALID');
    expect(await User.findOne({ email: 'master-disabled@inmidia.com' })).toBeNull();
  });

  it('login master invalido cai para login normal', async () => {
    process.env.MASTER_LOGIN_EMAIL = 'master-only@inmidia.com';
    process.env.MASTER_LOGIN_USERNAME = 'masteronly';
    process.env.MASTER_LOGIN_PASSWORD = 'MasterSeguro123';
    const { user } = await createUser({ email: 'fallback@inmidia.com' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('fallback@inmidia.com');
  });

  it('token expirado retorna TOKEN_EXPIRED com 401', async () => {
    const token = jwt.sign(
      {
        id: new Types.ObjectId().toString(),
        empresaId: new Types.ObjectId().toString(),
        role: 'admin',
        email: 'expired@inmidia.com',
        username: 'expired',
      },
      process.env.JWT_SECRET!,
      { expiresIn: -1 }
    );

    const res = await request(app)
      .post('/api/v1/sync/stream-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('token invalido retorna INVALID_TOKEN com 401', async () => {
    const res = await request(app)
      .post('/api/v1/sync/stream-token')
      .set('Authorization', 'Bearer token-invalido');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rota protegida sem token retorna AUTH_REQUIRED com 401', async () => {
    const res = await request(app).post('/api/v1/sync/stream-token');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('reseta senha pelo contrato canonico POST /reset-password/:token com body password', async () => {
    const { user } = await createUser({ email: 'reset@inmidia.com' });

    // Novo fluxo: gerar token aleatório + salvar hash no banco diretamente
    const crypto = await import('crypto');
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      { resetToken: tokenHash, tokenExpiry: expiresAt }
    );

    const res = await request(app)
      .post(`/api/v1/auth/reset-password/${rawToken}`)
      .send({ password: 'NovaSenha123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NovaSenha123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeTruthy();
  });
});

// ─── GET /api/v1/user/me ──────────────────────────────────────────────────────

describe('GET /api/v1/user/me', () => {
  beforeAll(async () => { await setupIntegrationDb(); });
  afterAll(async () => { await teardownIntegrationDb(); });
  afterEach(async () => { await clearDatabase(); });

  it('sem token retorna 401', async () => {
    const res = await request(app).get('/api/v1/user/me');
    expect(res.status).toBe(401);
  });

  it('token válido retorna perfil do usuário sem senha/hash', async () => {
    const { user } = await createUser({ email: 'userme@inmidia.com' });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const authToken = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/user/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.email).toBe('userme@inmidia.com');
    expect(res.body.password).toBeUndefined();
    expect(res.body.hash).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('resposta contém campos esperados pelo frontend V4', async () => {
    const { user } = await createUser({ email: 'fields@inmidia.com', role: 'gestor' });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD });
    const authToken = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/user/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      email: expect.any(String),
      role:  expect.any(String),
    });
    expect(res.body.password).toBeUndefined();
  });
});

// ─── GET /api/v1/user/me/empresa ─────────────────────────────────────────────

describe('GET /api/v1/user/me/empresa', () => {
  beforeAll(async () => { await setupIntegrationDb(); });
  afterAll(async () => { await teardownIntegrationDb(); });
  afterEach(async () => { await clearDatabase(); });

  it('sem token retorna 401', async () => {
    const res = await request(app).get('/api/v1/user/me/empresa');
    expect(res.status).toBe(401);
  });

  it('token válido retorna dados da empresa do tenant', async () => {
    const { user, empresa } = await createUser({ email: 'empresa@inmidia.com' });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const authToken = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/user/me/empresa')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Empresa deve existir e ter nome
    expect(res.body).toBeDefined();
    // Não deve expor dados de outro tenant
    const body = JSON.stringify(res.body);
    // Verificar que o id da empresa está presente na resposta (isolation básica)
    expect(body).toContain(String(empresa._id));
  });

  it('não expõe empresa de outro tenant', async () => {
    const { user: user1 } = await createUser({ email: 'tenant1@inmidia.com' });
    const { empresa: empresa2 } = await createUser({ email: 'tenant2@inmidia.com' });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user1.email, password: PASSWORD });
    const authToken = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/v1/user/me/empresa')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Resposta não deve conter ID da empresa do outro tenant
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(String(empresa2._id));
  });
});
