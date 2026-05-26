/**
 * Client Core Registry V4.1 — Integration Tests
 */

import request from 'supertest';
import { Types } from 'mongoose';
import {
  app,
  clearDatabase,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
  TEST_EMPRESA_ID,
} from './setup';
import Cliente from '../../modules/clientes/Cliente';

const BASE = '/api/v4/clients';

function makeDoc(suffix: string | number = 1) {
  return String(suffix).padStart(11, '0');
}

describe('Client Core Registry V4.1', () => {
  let adminToken:  string;
  let viewerToken: string;
  let otherTenantToken: string;
  const otherTenantId = new Types.ObjectId().toString();

  beforeAll(async () => {
    await setupIntegrationDb();
    adminToken       = generateTestToken({ role: 'admin_empresa' });
    viewerToken      = generateTestToken({ role: 'visualizador' });
    otherTenantToken = generateTestToken({ role: 'admin_empresa', empresaId: otherTenantId });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // ── 1. Create client ─────────────────────────────────────────────────────────

  describe('POST /api/v4/clients', () => {
    it('creates a client successfully', async () => {
      const res = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tipoPessoa:  'PJ',
          nome:        'Empresa Teste SA',
          documento:   '12345678000195',
          nomeFantasia:'Teste',
          responsavel: 'João Silva',
          email:       'contato@teste.com',
          telefone:    '11999999999',
          cidade:      'São Paulo',
          estado:      'SP',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.nome).toBe('Empresa Teste SA');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.tipoPessoa).toBe('PJ');
      expect(res.body.data.empresaId).toBe(TEST_EMPRESA_ID);
    });

    it('requires authentication', async () => {
      await request(app).post(BASE).send({ nome: 'Test' }).expect(401);
    });

    it('returns 400 for missing required fields', async () => {
      await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Missing documento and tipoPessoa' })
        .expect(400);
    });

    it('rejects duplicate documento within same empresa', async () => {
      const payload = { tipoPessoa: 'PJ', nome: 'Dup A', documento: '11111111000100' };
      await request(app).post(BASE).set('Authorization', `Bearer ${adminToken}`).send(payload).expect(201);

      const res = await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Dup B', documento: '11111111000100' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('allows same documento in different empresa', async () => {
      await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Tenant A', documento: '22222222000100' })
        .expect(201);

      await request(app)
        .post(BASE)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Tenant B', documento: '22222222000100' })
        .expect(201);
    });
  });

  // ── 2. List clients ──────────────────────────────────────────────────────────

  describe('GET /api/v4/clients', () => {
    beforeEach(async () => {
      // Create via API so schema defaults and indexes are respected
      await request(app).post(BASE).set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Alpha Ltda', documento: makeDoc(1) });
      // Create INACTIVE via create then update status
      const betaRes = await request(app).post(BASE).set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Beta SA', documento: makeDoc(2) });
      await request(app).patch(`${BASE}/${betaRes.body.data._id}`)
        .set('Authorization', `Bearer ${adminToken}`).send({ status: 'INACTIVE' });
      // Create then archive
      const gammaRes = await request(app).post(BASE).set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Gamma ME', documento: makeDoc(3) });
      await request(app).post(`${BASE}/${gammaRes.body.data._id}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);
      // Create for other tenant
      await request(app).post(BASE).set('Authorization', `Bearer ${otherTenantToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Delta Ltd', documento: makeDoc(4) });
    });

    it('lists clients for own empresa only (tenant isolation)', async () => {
      const res = await request(app)
        .get(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const names: string[] = res.body.data.map((c: any) => c.nome);
      expect(names).toContain('Alpha Ltda');
      expect(names).toContain('Beta SA');
      expect(names).not.toContain('Gamma ME');  // archived
      expect(names).not.toContain('Delta Ltd'); // other tenant
    });

    it('includes archived when includeArchived=true', async () => {
      const res = await request(app)
        .get(`${BASE}?includeArchived=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const names: string[] = res.body.data.map((c: any) => c.nome);
      expect(names).toContain('Gamma ME');
    });

    it('filters by status', async () => {
      const res = await request(app)
        .get(`${BASE}?status=INACTIVE`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].nome).toBe('Beta SA');
    });

    it('viewer role can read', async () => {
      await request(app).get(BASE).set('Authorization', `Bearer ${viewerToken}`).expect(200);
    });
  });

  // ── 3. Get by ID ─────────────────────────────────────────────────────────────

  describe('GET /api/v4/clients/:id', () => {
    it('returns client by id', async () => {
      const client = await Cliente.create({
        nome: 'Detail Test', documento: makeDoc(10), cpfCnpj: makeDoc(10),
        tipoPessoa: 'PF', status: 'ACTIVE', empresaId: TEST_EMPRESA_ID,
      });

      const res = await request(app)
        .get(`${BASE}/${client._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.nome).toBe('Detail Test');
    });

    it('returns 404 for non-existent id', async () => {
      const fakeId = new Types.ObjectId().toString();
      await request(app)
        .get(`${BASE}/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('cannot access other tenant client', async () => {
      const client = await Cliente.create({
        nome: 'Other Tenant', documento: makeDoc(11), cpfCnpj: makeDoc(11),
        status: 'ACTIVE', empresaId: otherTenantId,
      });

      await request(app)
        .get(`${BASE}/${client._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ── 4. Update ────────────────────────────────────────────────────────────────

  describe('PATCH /api/v4/clients/:id', () => {
    it('updates client fields', async () => {
      const client = await Cliente.create({
        nome: 'Update Me', documento: makeDoc(20), cpfCnpj: makeDoc(20),
        status: 'ACTIVE', empresaId: TEST_EMPRESA_ID,
      });

      const res = await request(app)
        .patch(`${BASE}/${client._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ responsavel: 'Novo Responsável', cidade: 'Rio de Janeiro' })
        .expect(200);

      expect(res.body.data.responsavel).toBe('Novo Responsável');
      expect(res.body.data.cidade).toBe('Rio de Janeiro');
    });

    it('cannot update archived client', async () => {
      const client = await Cliente.create({
        nome: 'Archived', documento: makeDoc(21), cpfCnpj: makeDoc(21),
        status: 'ARCHIVED', empresaId: TEST_EMPRESA_ID,
      });

      await request(app)
        .patch(`${BASE}/${client._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ responsavel: 'Test' })
        .expect(404);
    });
  });

  // ── 5. Archive / Restore ─────────────────────────────────────────────────────

  describe('POST /api/v4/clients/:id/archive', () => {
    it('archives an active client', async () => {
      const client = await Cliente.create({
        nome: 'To Archive', documento: makeDoc(30), cpfCnpj: makeDoc(30),
        status: 'ACTIVE', empresaId: TEST_EMPRESA_ID,
      });

      const res = await request(app)
        .post(`${BASE}/${client._id}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('ARCHIVED');
      expect(res.body.data.archivedAt).toBeTruthy();
    });

    it('cannot archive already archived client', async () => {
      const client = await Cliente.create({
        nome: 'Already Archived', documento: makeDoc(31), cpfCnpj: makeDoc(31),
        status: 'ARCHIVED', empresaId: TEST_EMPRESA_ID,
      });

      await request(app)
        .post(`${BASE}/${client._id}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v4/clients/:id/restore', () => {
    it('restores an archived client', async () => {
      const client = await Cliente.create({
        nome: 'To Restore', documento: makeDoc(40), cpfCnpj: makeDoc(40),
        status: 'ARCHIVED', archivedAt: new Date(), empresaId: TEST_EMPRESA_ID,
      });

      const res = await request(app)
        .post(`${BASE}/${client._id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.archivedAt).toBeFalsy();
    });
  });

  // ── 6. Search ────────────────────────────────────────────────────────────────

  describe('GET /api/v4/clients/search', () => {
    beforeEach(async () => {
      await request(app).post(BASE).set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Supermercado Silva', documento: makeDoc(50), responsavel: 'Mario Silva' });
      await request(app).post(BASE).set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Padaria Flores',    documento: makeDoc(51), responsavel: 'Ana Lima' });
    });

    it('searches by name', async () => {
      const res = await request(app)
        .get(`${BASE}/search?q=Supermercado`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].nome).toBe('Supermercado Silva');
    });

    it('searches by responsavel', async () => {
      const res = await request(app)
        .get(`${BASE}/search?q=Mario`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].nome).toBe('Supermercado Silva');
    });

    it('requires q param with at least 2 chars', async () => {
      await request(app)
        .get(`${BASE}/search?q=A`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('does not return archived clients in search', async () => {
      const archivedRes = await request(app).post(BASE).set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'ZZZ Archived Client', documento: makeDoc(52) });
      await request(app).post(`${BASE}/${archivedRes.body.data._id}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get(`${BASE}/search?q=ZZZ`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  // ── 7. Timeline ──────────────────────────────────────────────────────────────

  describe('GET /api/v4/clients/:id/timeline', () => {
    it('returns timeline events', async () => {
      const client = await Cliente.create({
        nome: 'Timeline Client', documento: makeDoc(60), cpfCnpj: makeDoc(60),
        status: 'ACTIVE', empresaId: TEST_EMPRESA_ID,
      });

      const res = await request(app)
        .get(`${BASE}/${client._id}/timeline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((e: any) => e.type === 'created')).toBe(true);
    });
  });
});
