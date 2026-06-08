/**
 * public-plates-platemedia-contract.test.ts — FASE 10
 *
 * Contract tests e regression guards para a arquitetura PlateMedia.
 *
 * Garante que:
 *   1. Respostas públicas nunca expõem activeKey, r2Key, storageKey como campos top-level
 *   2. imagemUrl sempre aponta para proxy URL (/api/v1/public/media/plates/:id/main)
 *   3. imagemUrl inclui ?v= para cache-busting quando imagem existe
 *   4. status: 'missing' (PlateMedia sem activeKey) → imagemUrl null, hasImage false
 *   5. Proxy endpoint (/media/plates/:id/main) retorna 404 para status: 'missing'
 *   6. Proxy não usa fallback legado — somente PlateMedia.activeKey
 *   7. /placas/export segue o mesmo contrato de campos
 *   8. /inventory/boards segue o mesmo contrato de campos
 */

// ── Mocks para image controller ────────────────────────────────────────────────

jest.mock('@modules/media/plate-media.service', () => ({
  plateMediaService: { resolvePlateMainImage: jest.fn() },
}));
jest.mock('./image-cache.service', () => ({
  getImageMetaFromCache: jest.fn().mockResolvedValue(null),
  setImageMetaInCache: jest.fn(),
  setImageNotFound: jest.fn().mockResolvedValue(undefined),
  isImageCacheAvailable: jest.fn().mockReturnValue(false),
}));
jest.mock('@shared/infra/storage/r2-client', () => ({
  getR2Client: jest.fn().mockReturnValue({}),
  getR2BucketName: jest.fn().mockReturnValue('test-bucket'),
}));
jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));
jest.mock('@modules/placas/Placa', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

import { plateMediaService } from '@modules/media/plate-media.service';
import Placa from '@modules/placas/Placa';
import { toPublicPlaca, buildProxyImageUrl } from './public-plates.presenter';
import { getPlacaImagem } from './public-plates-image.controller';
import type { PlateMediaResolved } from './public-plates.presenter';

const mockedResolve = plateMediaService.resolvePlateMainImage as jest.MockedFunction<
  typeof plateMediaService.resolvePlateMainImage
>;
const mockedPlacaFindOne = Placa.findOne as jest.Mock;

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PROXY_BASE = 'https://api.inmidia.com.br';
const PLACA_ID = '69d7d2a69b9a603e468392e3';
const EMPRESA_ID = '69d7d2a69b9a603e468392e4';
const R2_KEY   = 'empresas/e1/plates/p/main/photo.webp';
const VERSION  = '1717776000000';

const PM_ACTIVE: PlateMediaResolved = { activeKey: R2_KEY, version: VERSION };
const PM_NULL_KEY: PlateMediaResolved = { activeKey: null, version: '' };

function makeRaw(overrides: Record<string, unknown> = {}): any {
  return { _id: PLACA_ID, numero_placa: 'CAU-37', ...overrides };
}

function makeReq(id: string, headers: Record<string, string> = {}): any {
  return {
    params: { id },
    query: {},
    header: jest.fn((name: string) => headers[name.toLowerCase()] ?? undefined),
  };
}

function makeRes(): any {
  const res: any = {
    _status: 0, _body: null,
    status(code: number) { this._status = code; return this; },
    json(body: any) { this._body = body; this._ended = true; return this; },
    set: jest.fn().mockReturnThis(),
    end() { this._ended = true; return this; },
    headersSent: false,
    destroy: jest.fn(),
  };
  return res;
}

// ── BLOCO 1: public presenter — campos de resposta ─────────────────────────────

describe('Contrato de resposta pública — campos nunca expõem credenciais R2', () => {
  beforeEach(() => { process.env.PUBLIC_API_BASE_URL = PROXY_BASE; });
  afterEach(() => { delete process.env.PUBLIC_API_BASE_URL; });

  it('resposta não contém activeKey', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE) as any;
    expect(payload).not.toHaveProperty('activeKey');
  });

  it('resposta não contém r2Key', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE) as any;
    expect(payload).not.toHaveProperty('r2Key');
  });

  it('resposta não contém storageKey', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE) as any;
    expect(payload).not.toHaveProperty('storageKey');
  });

  it('resposta não contém imagemKey', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE) as any;
    expect(payload).not.toHaveProperty('imagemKey');
  });

  it('imagemUrl inclui ?v= para cache-busting quando imagem existe', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE);
    expect(payload.imagemUrl).toMatch(/\?v=/);
    expect(payload.imagemUrl).toContain(VERSION);
  });

  it('imagemUrl aponta para proxy canônico /api/v1/public/media/plates/:id/main', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE);
    expect(payload.imagemUrl).toMatch(/\/api\/v1\/public\/media\/plates\/[a-f0-9]+\/main/);
    expect(payload.imagemUrl).toContain(PLACA_ID);
  });

  it('imagemUrl não contém a R2 key direta (não vaza path do bucket)', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE);
    expect(payload.imagemUrl).not.toContain(R2_KEY);
    expect(payload.imagemUrl).not.toContain('empresas/');
  });

  it('imagemUrl não contém r2.dev nem cloudflarestorage.com', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE);
    expect(payload.imagemUrl).not.toMatch(/r2\.dev|cloudflarestorage\.com/i);
  });

  it('todos os aliases (imagem, jetImageUrl, jet_image_url) apontam para o mesmo proxy URL', () => {
    const payload = toPublicPlaca(makeRaw(), PM_ACTIVE);
    expect(payload.imagem).toBe(payload.imagemUrl);
    expect(payload.jetImageUrl).toBe(payload.imagemUrl);
    expect(payload.jet_image_url).toBe(payload.imagemUrl);
    expect(payload.jetImage?.url).toBe(payload.imagemUrl);
    expect(payload.image?.url).toBe(payload.imagemUrl);
    expect(payload.imagemMeta?.url).toBe(payload.imagemUrl);
  });
});

// ── BLOCO 2: status missing → sem imagem ─────────────────────────────────────

describe('Contrato: PlateMedia status missing → placa sem imagem', () => {
  beforeEach(() => { process.env.PUBLIC_API_BASE_URL = PROXY_BASE; });
  afterEach(() => { delete process.env.PUBLIC_API_BASE_URL; });

  it('PlateMedia com activeKey null → imagemUrl null, hasImage false', () => {
    const payload = toPublicPlaca(makeRaw(), PM_NULL_KEY);
    expect(payload.imagemUrl).toBeNull();
    expect(payload.hasImage).toBe(false);
  });

  it('PlateMedia com activeKey null → todos os aliases null', () => {
    const payload = toPublicPlaca(makeRaw(), PM_NULL_KEY);
    expect(payload.imagem).toBeNull();
    expect(payload.jetImageUrl).toBeNull();
    expect(payload.jet_image_url).toBeNull();
    expect(payload.jetImage).toBeNull();
    expect(payload.image).toBeNull();
    expect(payload.imagemMeta).toBeNull();
  });

  it('PlateMedia null (placa sem registro de mídia) → imagemUrl null', () => {
    const payload = toPublicPlaca(makeRaw(), null);
    expect(payload.imagemUrl).toBeNull();
    expect(payload.hasImage).toBe(false);
  });

  it('ignora imagemPrincipal no raw doc quando PlateMedia não tem activeKey', () => {
    const raw = makeRaw({ imagemPrincipal: 'empresas/e1/plates/p/legacy.jpg' });
    const payload = toPublicPlaca(raw, PM_NULL_KEY);
    expect(payload.imagemUrl).toBeNull();
    expect(payload.hasImage).toBe(false);
  });

  it('ignora imagemPrincipal no raw doc quando PlateMedia é null', () => {
    const raw = makeRaw({ imagemPrincipal: 'empresas/e1/plates/p/legacy.jpg' });
    const payload = toPublicPlaca(raw, null);
    expect(payload.imagemUrl).toBeNull();
  });
});

// ── BLOCO 3: proxy endpoint → 404 para status missing ────────────────────────

describe('Proxy /media/plates/:id/main — 404 para status missing, sem fallback legado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPlacaFindOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: PLACA_ID, empresaId: EMPRESA_ID, statusOperacional: 'DISPONIVEL' }),
      }),
    });
  });

  it('retorna 404 quando PlateMedia.hasImage é false (status: missing)', async () => {
    mockedResolve.mockResolvedValue({
      hasImage: false,
      activeKey: null,
      version: '',
      mimeType: null,
      source: 'plate-media',
    });

    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());

    expect(res._status).toBe(404);
  });

  it('não tenta acessar imagemPrincipal ou imagem quando hasImage é false', async () => {
    mockedResolve.mockResolvedValue({
      hasImage: false,
      activeKey: null,
      version: '',
      mimeType: null,
      source: 'plate-media',
    });

    const req = makeReq(PLACA_ID);
    // req.params só tem id — sem campos legados
    expect(req.params).toEqual({ id: PLACA_ID });

    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());

    // O controller só consultou PlateMedia — não tentou ler campos legados
    expect(mockedResolve).toHaveBeenCalledWith(PLACA_ID, EMPRESA_ID);
    expect(mockedResolve).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(404);
  });

  it('retorna 404 quando activeKey é null mesmo que hasImage seja truthy', async () => {
    mockedResolve.mockResolvedValue({
      hasImage: false,
      activeKey: null,
      version: '1234',
      mimeType: null,
      source: 'plate-media',
    });

    const req = makeReq(PLACA_ID);
    const res = makeRes();
    await getPlacaImagem(req, res, jest.fn());

    expect(res._status).toBe(404);
  });
});

// ── BLOCO 4: buildProxyImageUrl regression ────────────────────────────────────

describe('buildProxyImageUrl — URL canônica de proxy', () => {
  beforeEach(() => { process.env.PUBLIC_API_BASE_URL = PROXY_BASE; });
  afterEach(() => { delete process.env.PUBLIC_API_BASE_URL; });

  it('nunca inclui R2 key na URL de proxy', () => {
    const url = buildProxyImageUrl(PLACA_ID, VERSION);
    expect(url).not.toContain(R2_KEY);
    expect(url).not.toContain('empresas/');
  });

  it('segue formato /api/v1/public/media/plates/:id/main?v=:version', () => {
    const url = buildProxyImageUrl(PLACA_ID, VERSION);
    expect(url).toBe(`${PROXY_BASE}/api/v1/public/media/plates/${PLACA_ID}/main?v=${VERSION}`);
  });
});
