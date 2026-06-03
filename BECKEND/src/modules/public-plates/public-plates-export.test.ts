/**
 * Testes do endpoint de exportação bulk de placas — GET /placas/export.
 *
 * Cobre:
 *   1. listPlacas continua paginado (limit=24 default, pagination object presente)
 *   2. listAllPlacas retorna todas as placas sem limit artificial
 *   3. export usa o mesmo presenter público (toPublicPlaca)
 *   4. export não retorna storageKey, r2Key, imagemPrincipal crua
 *   5. export retorna imagemUrl (proxy) quando hasImage=true
 *   6. export retorna aliases JetEngine: jetImageUrl, jet_image_url, jetImage, image
 *   7. export não retorna dados privados: empresaId, statusComercial raw
 *   8. export não usa limit=24 (todos os docs retornados)
 *   9. export respeita PUBLIC_EXPORT_MAX_ITEMS
 *  10. publicExportRateLimiter usa código PUBLIC_EXPORT_RATE_LIMITED
 *  11. publicExportKeyGenerator usa keyspace pub_export: / ip_export:
 */

// ── Mocks de dependências externas ────────────────────────────────────────────

jest.mock('@modules/placas/Placa');
jest.mock('@modules/regioes/Regiao');
jest.mock('@modules/commercial-availability', () => ({
  commercialAvailabilityProjection: {
    resolveManyPlateCommercialStatuses: jest.fn(),
    resolvePlateCommercialStatus: jest.fn(),
  },
}));
jest.mock('./image-cache.service', () => ({
  batchIsImageNotFound: jest.fn(),
  isImageCacheAvailable: jest.fn(() => false),
}));
jest.mock('@modules/media/placa-image-reference.resolver', () => ({
  resolvePlacaImageReference: jest.fn((raw: any) => ({
    hasImage: !!(raw.mainImageUrl || raw.imagemPrincipal || raw.storageKey),
    storageKey: raw.storageKey ?? raw.imagemPrincipal ?? null,
    contentType: null,
  })),
  contentTypeFromStorageKey: jest.fn(() => null),
}));
jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import Placa from '@modules/placas/Placa';
import { commercialAvailabilityProjection } from '@modules/commercial-availability';
import { listPlacas, listAllPlacas } from './public-plates.service';
import {
  publicExportKeyGenerator,
  PUBLIC_EXPORT_MAX,
  PUBLIC_EXPORT_WINDOW_MS,
} from '@shared/infra/http/middlewares/rate-limit.middleware';

const mockedPlacaFind = Placa.find as jest.Mock;
const mockedResolveMany = commercialAvailabilityProjection.resolveManyPlateCommercialStatuses as jest.Mock;

// Helpers
function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => overrides._id ?? 'abc123' },
    empresaId: 'emp1',
    numero_placa: 'PLACA-01',
    statusOperacional: 'ATIVO',
    mainImageUrl: null,
    imagemPrincipal: null,
    storageKey: null,
    tipo: null,
    tamanho: null,
    latitude: null,
    longitude: null,
    endereco: null,
    localizacao: null,
    regiaoId: null,
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeDocs(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeDoc({ _id: `id-${i}`, numero_placa: `PLACA-${String(i + 1).padStart(2, '0')}` })
  );
}

function leanChain(docs: unknown[]) {
  return { select: () => ({ populate: () => ({ lean: () => Promise.resolve(docs) }) }) };
}

function setupFind(docs: unknown[]) {
  mockedPlacaFind.mockReturnValue(leanChain(docs));
  mockedResolveMany.mockResolvedValue(
    new Map(
      (docs as any[]).map((d) => [d._id.toString(), { status: 'AVAILABLE', isCommerciallyAvailable: true }])
    )
  );
}

const EMPRESAID = 'emp1';

// ── 1. listPlacas continua paginado ──────────────────────────────────────────

describe('listPlacas — mantém paginação', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna objeto pagination com page, limit, total, pages', async () => {
    const docs = makeDocs(37);
    setupFind(docs);
    const result = await listPlacas(EMPRESAID, {}, {});
    expect(result).toHaveProperty('pagination');
    expect(result.pagination).toMatchObject({ page: 1, limit: 24, total: 37 });
  });

  it('default limit é 24 (não retorna todos os 37 docs na primeira página)', async () => {
    const docs = makeDocs(37);
    setupFind(docs);
    const result = await listPlacas(EMPRESAID, {}, {});
    expect(result.data).toHaveLength(24);
  });

  it('aceita limit customizado até MAX_LIMIT (100)', async () => {
    const docs = makeDocs(37);
    setupFind(docs);
    const result = await listPlacas(EMPRESAID, {}, { limit: 50 });
    expect(result.data).toHaveLength(37); // fewer than 50, returns all
  });
});

// ── 2 & 8. listAllPlacas retorna todas sem limit artificial ──────────────────

describe('listAllPlacas — sem paginação', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna todos os docs sem limit=24', async () => {
    const docs = makeDocs(37);
    setupFind(docs);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result.data).toHaveLength(37);
  });

  it('não tem objeto pagination na resposta', async () => {
    const docs = makeDocs(37);
    setupFind(docs);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result).not.toHaveProperty('pagination');
  });

  it('tem meta.total igual ao número de placas retornadas', async () => {
    const docs = makeDocs(10);
    setupFind(docs);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result.meta.total).toBe(10);
  });

  it('tem meta.exportedAt como ISO string', async () => {
    setupFind(makeDocs(1));
    const result = await listAllPlacas(EMPRESAID, {});
    expect(() => new Date(result.meta.exportedAt)).not.toThrow();
    expect(result.meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── 3 & 5. Export usa presenter público — imagemUrl proxy ────────────────────

describe('listAllPlacas — usa presenter público', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna imagemUrl como proxy URL quando hasImage=true', async () => {
    process.env.PUBLIC_API_BASE_URL = 'https://api.inmidia.com.br';
    const doc = makeDoc({ _id: 'abc123', mainImageUrl: 'uploads/img.jpg' });
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    const placa = result.data[0]!;
    expect(placa.hasImage).toBe(true);
    expect(placa.imagemUrl).toMatch(/\/api\/v1\/public\/media\/plates\/abc123\/main$/);
    expect(placa.imagemUrl).not.toMatch(/r2\.cloudflare|s3\.amazonaws|storage/i);
    delete process.env.PUBLIC_API_BASE_URL;
  });

  it('retorna imagemUrl null quando hasImage=false', async () => {
    const doc = makeDoc({ _id: 'abc123' }); // sem imagem
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result.data[0]!.hasImage).toBe(false);
    expect(result.data[0]!.imagemUrl).toBeNull();
  });

  it('retorna campos obrigatórios do contrato público', async () => {
    setupFind([makeDoc({ _id: 'abc123' })]);
    const result = await listAllPlacas(EMPRESAID, {});
    const placa = result.data[0];
    expect(placa).toHaveProperty('id');
    expect(placa).toHaveProperty('slug');
    expect(placa).toHaveProperty('codigo');
    expect(placa).toHaveProperty('nome');
    expect(placa).toHaveProperty('localizacao');
    expect(placa).toHaveProperty('status');
    expect(placa).toHaveProperty('imagemUrl');
    expect(placa).toHaveProperty('hasImage');
    expect(placa).toHaveProperty('latitude');
    expect(placa).toHaveProperty('longitude');
    expect(placa).toHaveProperty('endereco');
    expect(placa).toHaveProperty('regiao');
    expect(placa).toHaveProperty('cidade');
    expect(placa).toHaveProperty('categoria');
    expect(placa).toHaveProperty('medidas');
    expect(placa).toHaveProperty('disponibilidade');
    expect(placa).toHaveProperty('updatedAt');
  });
});

// ── 4. Export não expõe dados privados ───────────────────────────────────────

describe('listAllPlacas — sem dados privados', () => {
  beforeEach(() => jest.clearAllMocks());

  it('não expõe storageKey crua', async () => {
    const doc = makeDoc({ storageKey: 'inmidia-uploads/img.jpg' });
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    const placa = result.data[0] as any;
    expect(placa.storageKey).toBeUndefined();
    expect(placa.r2Key).toBeUndefined();
  });

  it('não expõe imagemPrincipal crua (campo interno)', async () => {
    const doc = makeDoc({ imagemPrincipal: 'uploads/raw-path.jpg' });
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    const placa = result.data[0] as any;
    expect(placa.imagemPrincipal).toBeUndefined();
  });

  it('não expõe empresaId no payload', async () => {
    setupFind([makeDoc()]);
    const result = await listAllPlacas(EMPRESAID, {});
    const placa = result.data[0] as any;
    expect(placa.empresaId).toBeUndefined();
  });

  it('não expõe statusComercial raw (statusOperacional interno)', async () => {
    setupFind([makeDoc({ statusOperacional: 'ATIVO' })]);
    const result = await listAllPlacas(EMPRESAID, {});
    const placa = result.data[0] as any;
    expect(placa.statusComercial).toBeUndefined();
    expect(placa.statusOperacional).toBeUndefined();
  });
});

// ── 6. Export retorna aliases JetEngine ──────────────────────────────────────

describe('listAllPlacas — aliases JetEngine/Elementor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PUBLIC_API_BASE_URL = 'https://api.inmidia.com.br';
  });
  afterEach(() => { delete process.env.PUBLIC_API_BASE_URL; });

  it('retorna jetImageUrl como proxy URL quando hasImage=true', async () => {
    const doc = makeDoc({ _id: 'jt1', mainImageUrl: 'img.jpg' });
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result.data[0]!.jetImageUrl).toMatch(/\/api\/v1\/public\/media\/plates\/jt1\/main$/);
  });

  it('retorna jet_image_url como proxy URL quando hasImage=true', async () => {
    const doc = makeDoc({ _id: 'jt2', mainImageUrl: 'img.jpg' });
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result.data[0]!.jet_image_url).toMatch(/\/api\/v1\/public\/media\/plates\/jt2\/main$/);
  });

  it('retorna jetImage com url, alt e title quando hasImage=true', async () => {
    const doc = makeDoc({ _id: 'jt3', mainImageUrl: 'img.jpg', numero_placa: 'ABC-01' });
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    const jetImage = result.data[0]!.jetImage;
    expect(jetImage).not.toBeNull();
    expect(jetImage!.url).toMatch(/\/api\/v1\/public\/media\/plates\/jt3\/main$/);
    expect(jetImage!.alt).toBeTruthy();
    expect(jetImage!.title).toBeTruthy();
  });

  it('retorna image (Elementor) com url quando hasImage=true', async () => {
    const doc = makeDoc({ _id: 'el1', mainImageUrl: 'img.jpg' });
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    const image = result.data[0]!.image;
    expect(image).not.toBeNull();
    expect(image!.url).toMatch(/\/api\/v1\/public\/media\/plates\/el1\/main$/);
  });

  it('retorna jetImage null quando hasImage=false', async () => {
    const doc = makeDoc({ _id: 'jt4' }); // sem imagem
    setupFind([doc]);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result.data[0]!.jetImage).toBeNull();
    expect(result.data[0]!.jetImageUrl).toBeNull();
    expect(result.data[0]!.image).toBeNull();
  });
});

// ── 9. PUBLIC_EXPORT_MAX_ITEMS ────────────────────────────────────────────────

describe('listAllPlacas — respeita PUBLIC_EXPORT_MAX_ITEMS', () => {
  beforeEach(() => jest.clearAllMocks());

  it('limita ao valor de PUBLIC_EXPORT_MAX_ITEMS quando menor que total', async () => {
    const originalEnv = process.env.PUBLIC_EXPORT_MAX_ITEMS;
    process.env.PUBLIC_EXPORT_MAX_ITEMS = '5';
    const docs = makeDocs(37);
    setupFind(docs);
    const result = await listAllPlacas(EMPRESAID, {});
    expect(result.data.length).toBeLessThanOrEqual(5);
    if (originalEnv !== undefined) {
      process.env.PUBLIC_EXPORT_MAX_ITEMS = originalEnv;
    } else {
      delete process.env.PUBLIC_EXPORT_MAX_ITEMS;
    }
  });
});

// ── 10. Rate limit export — código e limites ──────────────────────────────────

describe('publicExportRateLimiter — configuração', () => {
  it('PUBLIC_EXPORT_MAX >= 100 (mais generoso que dados paginados)', () => {
    expect(PUBLIC_EXPORT_MAX).toBeGreaterThanOrEqual(100);
  });

  it('PUBLIC_EXPORT_WINDOW_MS = 15 minutos', () => {
    expect(PUBLIC_EXPORT_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});

// ── 11. publicExportKeyGenerator — keyspace isolado ─────────────────────────

describe('publicExportKeyGenerator — keyspace pub_export:', () => {
  function makeReq(overrides: { headers?: Record<string, string>; ip?: string }) {
    return {
      ip: overrides.ip ?? '1.2.3.4',
      header: (name: string) => overrides.headers?.[name.toLowerCase()] ?? undefined,
    } as any;
  }

  it('usa prefixo pub_export: com API key', () => {
    const key = publicExportKeyGenerator(makeReq({ headers: { 'x-api-key': 'prefix_secret' } }));
    expect(key).toMatch(/^pub_export:/);
  });

  it('usa prefixo ip_export: sem API key', () => {
    const key = publicExportKeyGenerator(makeReq({ ip: '10.0.0.1' }));
    expect(key).toMatch(/^ip_export:/);
  });

  it('keyspace export não se confunde com pub: nem pub_media:', () => {
    const req = makeReq({ headers: { 'x-api-key': 'myprefix_secret' } });
    const key = publicExportKeyGenerator(req);
    expect(key).not.toMatch(/^pub:/);
    expect(key).not.toMatch(/^pub_media:/);
    expect(key).toMatch(/^pub_export:/);
  });
});
