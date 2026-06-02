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

/** Canonical URL for plate images. */
function canonicalImageUrl(placaId: string): string {
  return `${PUBLIC_API_BASE_URL}/api/v1/public/media/plates/${placaId}/main`;
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

  // ── Endpoint canônico de imagem ───────────────────────────────────────────

  it('OPTIONS /api/v1/public/media/plates/:id/main retorna CORS wildcard (endpoint canônico)', async () => {
    const res = await request(app)
      .options('/api/v1/public/media/plates/69b42002f5c3a35343097a2c/main')
      .set('Origin', 'https://sitequalquer.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  it('GET /api/v1/public/media/plates/:id/main expoe headers CORS/CORP corretos (endpoint canônico)', async () => {
    const res = await request(app)
      .get('/api/v1/public/media/plates/id-invalido/main')
      .set('Origin', 'https://sitequalquer.com');

    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['cache-control']).toContain('public');
  });

  // ── Rotas antigas delegam ao mesmo handler ────────────────────────────────

  it('GET /api/v1/public/placas/:id/imagem delega ao handler canônico (mesmos headers)', async () => {
    const res = await request(app)
      .get('/api/v1/public/placas/id-invalido/imagem')
      .set('Origin', 'https://sitequalquer.com');

    // Mesmos headers do endpoint canônico — sem lógica própria
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['cache-control']).toContain('public');
  });

  it('OPTIONS /api/v1/public/placas/:id/imagem retorna CORS wildcard para Elementor', async () => {
    const res = await request(app)
      .options('/api/v1/public/placas/69b42002f5c3a35343097a2c/imagem')
      .set('Origin', 'https://sitequalquer.com')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  // ── Listagem de placas ────────────────────────────────────────────────────

  it('GET /api/v1/public/placas retorna 200 com array de placas e sem campos sensíveis', async () => {
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
      // R2-resolvable path so the resolver produces hasImage=true
      imagemPrincipal: 'inmidia-uploads-sistema/pub-001.jpg',
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
    const placa = res.body.data[0];
    const expectedImageUrl = canonicalImageUrl(placa.id);
    expect(placa).toMatchObject({
      id: expect.any(String),
      codigo: 'PUB-001',
      nome: 'PUB-001',
      localizacao: 'Av. Paulista, 1000',
      regiao: 'Centro',
      status: 'disponivel',
      imagemUrl: expectedImageUrl,
      imagem: expectedImageUrl,
      imagemMeta: expect.objectContaining({ url: expectedImageUrl }),
      jetImageUrl: expectedImageUrl,
      jet_image_url: expectedImageUrl,
      hasImage: true,
      latitude: -23.561684,
      longitude: -46.656139,
    });
    // imagemUrl aponta para o endpoint canônico
    expect(placa.imagemUrl).toMatch(/\/api\/v1\/public\/media\/plates\/[a-f0-9]+\/main$/);
    // Campos internos ausentes
    expect(placa.empresaId).toBeUndefined();
    expect(placa.valor_mensal).toBeUndefined();
    expect(placa.notes).toBeUndefined();
    expect(placa.contratos).toBeUndefined();
    expect(placa.cliente).toBeUndefined();
  });

  it('GET /api/v1/public/placas — imagemUrl não é null quando placa tem imagem', async () => {
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
      // Plain filename: resolver now accepts it, adding default folder prefix.
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
      imagemPrincipal: 'inmidia-uploads-sistema/placa-pronta.jpg',
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
      const expectedUrl = canonicalImageUrl(byCodigo[codigo].id);
      expect(byCodigo[codigo].imagemUrl).toBe(expectedUrl);
      expect(byCodigo[codigo].imagem).toBe(expectedUrl);
      expect(byCodigo[codigo].imagemMeta.url).toBe(expectedUrl);
      expect(byCodigo[codigo].hasImage).toBe(true);
      expect(expectedUrl).not.toContain('//api/');
      expect(expectedUrl).not.toContain('localhost');
    }
    expect(byCodigo['PUB-IMG-004'].imagemUrl).toBeNull();
    expect(byCodigo['PUB-IMG-004'].hasImage).toBe(false);
  });

  it('GET /api/v1/public/placas — JSON público não vaza key, bucket, R2 ou campos internos', async () => {
    process.env.PUBLIC_API_BASE_URL = PUBLIC_API_BASE_URL;

    const empresa = await createPublicEmpresa();
    const regiao = await createTestRegiao({
      empresaId: empresa._id,
      nome: 'Centro',
      codigo: 'CENTRO',
    });

    await createTestPlaca(regiao._id.toString(), {
      empresaId: empresa._id,
      numero_placa: 'PUB-LEAK-001',
      imagemPrincipal: 'inmidia-uploads-sistema/placa-leak.jpg',
      statusComercial: 'AVAILABLE',
    });

    const res = await request(app)
      .get('/api/v1/public/placas')
      .set('x-api-key', API_KEY_VALUE);

    expect(res.status).toBe(200);
    const serialized = JSON.stringify(res.body.data);
    expect(serialized).not.toContain('r2.dev');
    expect(serialized).not.toContain('cloudflarestorage');
    expect(serialized).not.toContain('inmidia-uploads-sistema');
    expect(serialized).not.toContain('empresaId');
    expect(serialized).not.toContain('statusComercial');
    // Alias fields exist but must point to the proxy URL, never expose raw storage paths
    expect(serialized).toContain('/api/v1/public/media/plates/');
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
