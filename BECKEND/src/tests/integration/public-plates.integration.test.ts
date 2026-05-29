import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import Empresa from '@modules/empresas/Empresa';
import TemporalReservation from '@modules/temporal/TemporalReservation';
import { publicApiKeyManager } from '@modules/public-api/managers/public-api-key.manager';
import {
  app,
  clearDatabase,
  createTestPlaca,
  createTestRegiao,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';

const API_KEY_PREFIX = 'pubtest';
const API_KEY_SECRET = 'segredo-publico';
const API_KEY_VALUE = `${API_KEY_PREFIX}_${API_KEY_SECRET}`;
const ORIGINAL_R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
const ORIGINAL_R2_FOLDER_NAME = process.env.R2_FOLDER_NAME;
const ORIGINAL_PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL;
const PUBLIC_API_BASE_URL = 'https://inmidia.futureoutdoors.com.br';

async function createPublicEmpresa() {
  return Empresa.create({
    _id: new Types.ObjectId(),
    nome: 'Empresa Publica Teste',
    cnpj: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 14).padEnd(14, '0'),
    api_key_prefix: API_KEY_PREFIX,
    api_key_hash: await bcrypt.hash(API_KEY_SECRET, 10),
    ativo: true,
  });
}

describe('Public plates integration', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterEach(async () => {
    publicApiKeyManager.clearCache();
    if (ORIGINAL_R2_PUBLIC_URL === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = ORIGINAL_R2_PUBLIC_URL;
    if (ORIGINAL_R2_FOLDER_NAME === undefined) delete process.env.R2_FOLDER_NAME;
    else process.env.R2_FOLDER_NAME = ORIGINAL_R2_FOLDER_NAME;
    if (ORIGINAL_PUBLIC_API_BASE_URL === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = ORIGINAL_PUBLIC_API_BASE_URL;
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  it('GET /api/v1/public/placas retorna PUBLIC_API_KEY_MISSING sem chave', async () => {
    const res = await request(app).get('/api/v1/public/placas');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PUBLIC_API_KEY_MISSING');
  });

  it('GET /api/v1/public/placas retorna 200 com array de placas e sem campos sensiveis', async () => {
    process.env.PUBLIC_API_BASE_URL = PUBLIC_API_BASE_URL;
    const empresa = await createPublicEmpresa();
    const regiao = await createTestRegiao({
      empresaId: empresa._id,
      nome: 'Centro',
      codigo: 'CENTRO',
      city: 'Sao Paulo',
    });

    await createTestPlaca(regiao._id.toString(), {
      empresaId: empresa._id,
      numero_placa: 'PUB-001',
      endereco: 'Av. Paulista, 1000',
      latitude: -23.561684,
      longitude: -46.656139,
      imagemPrincipal: 'https://cdn.example.com/placas/pub-001.jpg',
      statusComercial: 'AVAILABLE',
      notes: 'nao pode aparecer',
      valor_mensal: 9999,
    });

    const res = await request(app)
      .get('/api/v1/public/placas')
      .set('x-api-key', API_KEY_VALUE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    const expectedImageUrl = `${PUBLIC_API_BASE_URL}/api/v1/public/placas/${res.body.data[0].id}/imagem`;
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      codigo: 'PUB-001',
      nome: 'PUB-001',
      localizacao: 'Av. Paulista, 1000',
      regiao: 'Centro',
      status: 'disponivel',
      imagemUrl: expectedImageUrl,
      imagem: expectedImageUrl,
      imagemMeta: expect.objectContaining({ url: expectedImageUrl }),
      latitude: -23.561684,
      longitude: -46.656139,
    });
    expect(res.body.data[0].empresaId).toBeUndefined();
    expect(res.body.data[0].valor_mensal).toBeUndefined();
    expect(res.body.data[0].notes).toBeUndefined();
    expect(res.body.data[0].contratos).toBeUndefined();
    expect(res.body.data[0].cliente).toBeUndefined();
  });

  it('GET /api/v1/public/placas normaliza imagemUrl e imagem como URL absoluta', async () => {
    process.env.PUBLIC_API_BASE_URL = PUBLIC_API_BASE_URL;

    const empresa = await createPublicEmpresa();
    const regiao = await createTestRegiao({
      empresaId: empresa._id,
      nome: 'Centro',
      codigo: 'CENTRO',
    });

    await createTestPlaca(regiao._id.toString(), {
      empresaId: empresa._id,
      numero_placa: 'PUB-IMG-001',
      imagemPrincipal: 'placa-relativa.jpg',
      statusComercial: 'AVAILABLE',
    });

    await createTestPlaca(regiao._id.toString(), {
      empresaId: empresa._id,
      numero_placa: 'PUB-IMG-002',
      imagemPrincipal: 'inmidia-uploads-sistema/placa-com-prefixo.jpg',
      statusComercial: 'AVAILABLE',
    });

    await createTestPlaca(regiao._id.toString(), {
      empresaId: empresa._id,
      numero_placa: 'PUB-IMG-003',
      imagemPrincipal: 'https://cdn.example.com/placas/pronta.jpg',
      statusComercial: 'AVAILABLE',
    });

    await createTestPlaca(regiao._id.toString(), {
      empresaId: empresa._id,
      numero_placa: 'PUB-IMG-004',
      imagemPrincipal: null,
      imagem: null,
      statusComercial: 'AVAILABLE',
    });

    const res = await request(app)
      .get('/api/v1/public/placas?limit=10')
      .set('x-api-key', API_KEY_VALUE);

    expect(res.status).toBe(200);
    const byCodigo = Object.fromEntries(
      res.body.data.map((placa: any) => [placa.codigo, placa])
    );

    for (const codigo of ['PUB-IMG-001', 'PUB-IMG-002', 'PUB-IMG-003']) {
      const expectedUrl = `${PUBLIC_API_BASE_URL}/api/v1/public/placas/${byCodigo[codigo].id}/imagem`;
      expect(byCodigo[codigo].imagemUrl).toBe(expectedUrl);
      expect(byCodigo[codigo].imagem).toBe(expectedUrl);
      expect(byCodigo[codigo].imagemMeta.url).toBe(expectedUrl);
      expect(expectedUrl).not.toContain('//api/');
      expect(expectedUrl).not.toContain('localhost');
    }
    expect(byCodigo['PUB-IMG-004'].imagemUrl).toBeNull();
    expect(byCodigo['PUB-IMG-004'].imagem).toBeNull();
    expect(byCodigo['PUB-IMG-004'].imagemMeta).toBeNull();
  });

  it('GET /api/v1/public/placas/:id retorna a placa por id com chave valida', async () => {
    const empresa = await createPublicEmpresa();
    const regiao = await createTestRegiao({
      empresaId: empresa._id,
      nome: 'Zona Norte',
      codigo: 'ZN',
    });

    const placa = await createTestPlaca(regiao._id.toString(), {
      empresaId: empresa._id,
      numero_placa: 'PUB-002',
      statusComercial: 'RESERVED',
    });
    await TemporalReservation.create({
      empresaId: empresa._id,
      plateId: placa._id,
      sourceType: 'PI',
      sourceId: new Types.ObjectId().toString(),
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      status: 'RESERVED',
      reason: 'Reserva publica de teste',
    });

    const res = await request(app)
      .get(`/api/v1/public/placas/${placa._id.toString()}`)
      .set('x-api-key', API_KEY_VALUE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(placa._id.toString());
    expect(res.body.data.codigo).toBe('PUB-002');
    expect(res.body.data.status).toBe('reservado');
  });

  it('GET /api/v1/public/placas/:id retorna 404 apenas para placa inexistente', async () => {
    await createPublicEmpresa();

    const res = await request(app)
      .get(`/api/v1/public/placas/${new Types.ObjectId().toString()}`)
      .set('x-api-key', API_KEY_VALUE);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PUBLIC_API_NOT_FOUND');
  });
});
