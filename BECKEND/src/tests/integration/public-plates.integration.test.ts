import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import Empresa from '@modules/empresas/Empresa';
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
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      codigo: 'PUB-001',
      nome: 'PUB-001',
      localizacao: 'Av. Paulista, 1000',
      regiao: 'Centro',
      status: 'disponivel',
      imagemUrl: 'https://cdn.example.com/placas/pub-001.jpg',
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
    process.env.R2_PUBLIC_URL = 'https://pub-storage.example.com';
    process.env.R2_FOLDER_NAME = 'inmidia-uploads-sistema';

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

    expect(byCodigo['PUB-IMG-001'].imagemUrl).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-relativa.jpg');
    expect(byCodigo['PUB-IMG-001'].imagem).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-relativa.jpg');
    expect(byCodigo['PUB-IMG-002'].imagemUrl).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-com-prefixo.jpg');
    expect(byCodigo['PUB-IMG-002'].imagem).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-com-prefixo.jpg');
    expect(byCodigo['PUB-IMG-003'].imagemUrl).toBe('https://cdn.example.com/placas/pronta.jpg');
    expect(byCodigo['PUB-IMG-003'].imagem).toBe('https://cdn.example.com/placas/pronta.jpg');
    expect(byCodigo['PUB-IMG-004'].imagemUrl).toBeNull();
    expect(byCodigo['PUB-IMG-004'].imagem).toBeNull();
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
