/**
 * Testes de Integração HTTP — Placas
 *
 * Testam o ciclo completo: HTTP → Controller → Service → MongoDB → Response.
 *
 * Contratos verificados:
 *   1. GET /api/v1/placas retorna shape canônico com disponivel
 *   2. GET /api/v1/placas?limit=1000 aceito (não retorna 400)
 *   3. GET /api/v1/placas/:id retorna disponivel como boolean
 *   4. PATCH /:id/disponibilidade grava `disponivel` no MongoDB
 *   5. Aliases ativa e disponivel são equivalentes no response
 *   6. paginação shape correto
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import AuditLog from '../../modules/audit/audit.model';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  createTestRegiao,
  createTestPlaca,
  generateTestToken,
} from './setup';

let token: string;
let tokenEmpresaB: string;
let regiaoId: string;
const EMPRESA_B_ID = new Types.ObjectId().toString();

beforeAll(async () => {
  await setupIntegrationDb();
  token = generateTestToken();
  tokenEmpresaB = generateTestToken({ empresaId: EMPRESA_B_ID, email: 'tenant-b@inmidia.com' });
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedRegiao() {
  const regiao = await createTestRegiao();
  regiaoId = regiao._id.toString();
  return regiao;
}

async function seedPlaca(overrides?: Record<string, unknown>) {
  await seedRegiao();
  return createTestPlaca(regiaoId, overrides);
}

// ─── GET /api/v1/placas ───────────────────────────────────────────────────────

describe('GET /api/v1/placas', () => {
  it('requer autenticação — 401 sem token', async () => {
    const res = await request(app).get('/api/v1/placas');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com lista vazia quando não há placas', async () => {
    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna shape canônico com disponivel boolean', async () => {
    await seedPlaca({ disponivel: true });

    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const placa = res.body.data[0];
    expect(typeof placa.disponivel).toBe('boolean');
    expect(placa.disponivel).toBe(true);
  });

  it('retorna disponivel=false para placa em manutenção', async () => {
    await seedPlaca({ disponivel: false });

    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const placa = res.body.data[0];
    expect(placa.disponivel).toBe(false);
  });

  it('retorna `id` e `_id` como strings', async () => {
    await seedPlaca();

    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    const placa = res.body.data[0];
    expect(typeof placa.id).toBe('string');
    expect(typeof placa._id).toBe('string');
  });

  it('retorna `numero_placa`', async () => {
    await seedPlaca({ numero_placa: 'INT-001' });

    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data[0].numero_placa).toBe('INT-001');
  });

  it('retorna objeto `regiao` com nome', async () => {
    await seedPlaca();

    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    const placa = res.body.data[0];
    expect(placa.regiao).toBeDefined();
    // regiao pode ser objeto populado ou ObjectId string
    expect(placa.regiao_nome ?? placa.regiao?.nome ?? placa.regiao).toBeTruthy();
  });

  it('retorna paginação canônica', async () => {
    await seedPlaca();

    const res = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.totalDocs).toBe('number');
    expect(typeof res.body.pagination.totalPages).toBe('number');
    expect(typeof res.body.pagination.currentPage).toBe('number');
    expect(typeof res.body.pagination.limit).toBe('number');
  });

  // ─── Contrato de limite: limit=1000 não pode retornar 400 ────────────────
  it('aceita limit=1000 sem retornar 400 (regressão do incidente)', async () => {
    await seedPlaca();

    const res = await request(app)
      .get('/api/v1/placas?limit=1000')
      .set('Authorization', `Bearer ${token}`);

    // NUNCA deve ser 400 para limit=1000
    expect(res.status).not.toBe(400);
    expect(res.status).toBe(200);
  });

  it('retorna 400 para limit > 1000', async () => {
    const res = await request(app)
      .get('/api/v1/placas?limit=1001')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('filtra por regiaoId corretamente', async () => {
    const outraRegiao = await createTestRegiao({ nome: 'Outra', codigo: 'OT' });
    await createTestPlaca(regiaoId, { numero_placa: 'CORRETA-001' });
    await createTestPlaca(outraRegiao._id.toString(), { numero_placa: 'OUTRA-001' });

    const res = await request(app)
      .get(`/api/v1/placas?regiaoId=${regiaoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Só deve retornar a placa da região filtrada
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].numero_placa).toBe('CORRETA-001');
  });

  it('ativa=true funciona como alias de disponivel=true', async () => {
    await seedPlaca({ disponivel: true });
    await createTestPlaca(regiaoId, { disponivel: false });

    const res = await request(app)
      .get('/api/v1/placas?ativa=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((p: any) => {
      expect(p.disponivel).toBe(true);
    });
  });

  it('isola dados entre empresas: empresa A não visualiza placas da empresa B', async () => {
    const regiaoA = await createTestRegiao({ nome: 'Regiao A', codigo: 'RA' });
    const regiaoB = await createTestRegiao({
      nome: 'Regiao B',
      codigo: 'RB',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    await createTestPlaca(regiaoA._id.toString(), { numero_placa: 'A-ONLY-001' });
    await createTestPlaca(regiaoB._id.toString(), {
      numero_placa: 'B-ONLY-001',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    const resEmpresaA = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`);
    const placasA = resEmpresaA.body.data.map((p: any) => p.numero_placa);

    const resEmpresaB = await request(app)
      .get('/api/v1/placas')
      .set('Authorization', `Bearer ${tokenEmpresaB}`);
    const placasB = resEmpresaB.body.data.map((p: any) => p.numero_placa);

    expect(placasA).toContain('A-ONLY-001');
    expect(placasA).not.toContain('B-ONLY-001');
    expect(placasB).toContain('B-ONLY-001');
    expect(placasB).not.toContain('A-ONLY-001');
  });
});

// ─── GET /api/v1/placas/:id ───────────────────────────────────────────────────

describe('GET /api/v1/placas/:id', () => {
  it('requer autenticação', async () => {
    const placa = await seedPlaca();
    const res = await request(app).get(`/api/v1/placas/${placa._id}`);
    expect(res.status).toBe(401);
  });

  it('retorna 200 com shape canônico', async () => {
    const placa = await seedPlaca({ disponivel: true });

    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.disponivel).toBe('boolean');
    expect(res.body.data.disponivel).toBe(true);
  });

  it('disponivel=false mantido corretamente', async () => {
    const placa = await seedPlaca({ disponivel: false });

    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.disponivel).toBe(false);
  });

  it('ativa === disponivel no response (sem divergência)', async () => {
    const placa = await seedPlaca({ disponivel: false });

    const res = await request(app)
      .get(`/api/v1/placas/${placa._id}`)
      .set('Authorization', `Bearer ${token}`);

    // Alias ativa deve ter o mesmo valor que disponivel
    if (res.body.data.ativa !== undefined) {
      expect(res.body.data.ativa).toBe(res.body.data.disponivel);
    }
  });

  it('retorna 400 para ID inválido', async () => {
    const res = await request(app)
      .get('/api/v1/placas/id-invalido')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('retorna 404 para ID não encontrado', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/v1/placas/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/placas/:id/disponibilidade ─────────────────────────────────

describe('PATCH /api/v1/placas/:id/disponibilidade', () => {
  it('requer autenticação', async () => {
    const placa = await seedPlaca();
    const res = await request(app).patch(`/api/v1/placas/${placa._id}/disponibilidade`);
    expect(res.status).toBe(401);
  });

  it('toggle: disponivel=true → false', async () => {
    const placa = await seedPlaca({ disponivel: true });

    const res = await request(app)
      .patch(`/api/v1/placas/${placa._id}/disponibilidade`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.disponivel).toBe(false);
  });

  it('toggle: disponivel=false → true', async () => {
    const placa = await seedPlaca({ disponivel: false });

    const res = await request(app)
      .patch(`/api/v1/placas/${placa._id}/disponibilidade`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.disponivel).toBe(true);
  });

  it('grava disponivel corretamente no MongoDB (regressão: antes gravava ativa)', async () => {
    const placa = await seedPlaca({ disponivel: true });

    await request(app)
      .patch(`/api/v1/placas/${placa._id}/disponibilidade`)
      .set('Authorization', `Bearer ${token}`);

    // Verifica diretamente no banco que `disponivel` foi alterado
    const Placa = mongoose.model('Placa');
    const doc = await Placa.findById(placa._id).lean() as any;
    expect(doc).not.toBeNull();
    expect(doc!.disponivel).toBe(false);
  });

  it('dois toggles retornam ao estado original', async () => {
    const placa = await seedPlaca({ disponivel: true });
    const id = placa._id.toString();
    const headers = { Authorization: `Bearer ${token}` };

    await request(app).patch(`/api/v1/placas/${id}/disponibilidade`).set(headers);
    const res2 = await request(app).patch(`/api/v1/placas/${id}/disponibilidade`).set(headers);

    expect(res2.body.data.disponivel).toBe(true);
  });

  it('ativa === disponivel após toggle', async () => {
    const placa = await seedPlaca({ disponivel: true });

    const res = await request(app)
      .patch(`/api/v1/placas/${placa._id}/disponibilidade`)
      .set('Authorization', `Bearer ${token}`);

    if (res.body.data.ativa !== undefined) {
      expect(res.body.data.ativa).toBe(res.body.data.disponivel);
    }
  });
});

describe('POST /api/v1/placas - numero operacional', () => {
  it('atribui automaticamente o próximo número operacional', async () => {
    const regiao = await seedRegiao();
    await createTestPlaca(regiao._id.toString(), {
      numero_placa: 'OP-010',
      numeroOperacional: 10,
    });

    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${token}`)
      .field('numero_placa', 'OP-011')
      .field('regiaoId', regiao._id.toString())
      .field('regiao', regiao._id.toString())
      .field('nomeDaRua', 'Rua Nova Sequencia');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.numeroOperacional).toBe(11);
  });
});

describe('PATCH /api/v1/placas/reorder', () => {
  it('reorganiza sem alterar IDs internos', async () => {
    const regiao = await seedRegiao();
    const p1 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'R-001', numeroOperacional: 1 });
    const p2 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'R-003', numeroOperacional: 3 });
    const p3 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'R-004', numeroOperacional: 4 });

    const res = await request(app)
      .patch('/api/v1/placas/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { placaId: p1._id.toString(), numeroOperacional: 1 },
          { placaId: p2._id.toString(), numeroOperacional: 2 },
          { placaId: p3._id.toString(), numeroOperacional: 3 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const ids = res.body.data.map((p: any) => p.id || p._id);
    expect(ids).toEqual([p1._id.toString(), p2._id.toString(), p3._id.toString()]);

    const numeros = res.body.data.map((p: any) => p.numeroOperacional);
    expect(numeros).toEqual([1, 2, 3]);
  });

  it('impede duplicidade de numeroOperacional', async () => {
    const regiao = await seedRegiao();
    const p1 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'DUP-1', numeroOperacional: 1 });
    const p2 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'DUP-2', numeroOperacional: 2 });

    const res = await request(app)
      .patch('/api/v1/placas/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { placaId: p1._id.toString(), numeroOperacional: 1 },
          { placaId: p2._id.toString(), numeroOperacional: 1 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('respeita tenant e rejeita placa de outra empresa', async () => {
    const regiaoA = await seedRegiao();
    const regiaoB = await createTestRegiao({
      nome: 'Região B',
      codigo: 'RB',
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    const pA = await createTestPlaca(regiaoA._id.toString(), { numero_placa: 'TEN-A', numeroOperacional: 1 });
    const pB = await createTestPlaca(regiaoB._id.toString(), {
      numero_placa: 'TEN-B',
      numeroOperacional: 2,
      empresaId: new Types.ObjectId(EMPRESA_B_ID),
    });

    const res = await request(app)
      .patch('/api/v1/placas/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { placaId: pA._id.toString(), numeroOperacional: 1 },
          { placaId: pB._id.toString(), numeroOperacional: 2 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna lista ordenada após reorganização', async () => {
    const regiao = await seedRegiao();
    const p1 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'ORD-10', numeroOperacional: 10 });
    const p2 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'ORD-20', numeroOperacional: 20 });

    const res = await request(app)
      .patch('/api/v1/placas/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { placaId: p1._id.toString(), numeroOperacional: 2 },
          { placaId: p2._id.toString(), numeroOperacional: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data[0].numeroOperacional).toBe(1);
    expect(res.body.data[1].numeroOperacional).toBe(2);
  });

  it('registra auditoria da reorganização', async () => {
    const regiao = await seedRegiao();
    const p1 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'AUD-1', numeroOperacional: 1 });
    const p2 = await createTestPlaca(regiao._id.toString(), { numero_placa: 'AUD-2', numeroOperacional: 2 });

    await request(app)
      .patch('/api/v1/placas/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { placaId: p1._id.toString(), numeroOperacional: 2 },
          { placaId: p2._id.toString(), numeroOperacional: 1 },
        ],
      });

    const audit = await AuditLog.findOne({
      module: 'placas',
      action: 'placas.reordered',
      entityId: 'bulk',
    }).sort({ createdAt: -1 }).lean();

    expect(audit).toBeTruthy();
  });
});
