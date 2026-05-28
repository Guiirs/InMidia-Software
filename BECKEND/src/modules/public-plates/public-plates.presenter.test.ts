import { toPublicPlaca, buildProxyImageUrl, mimeTypeFromStoredPath } from './public-plates.presenter';

const PROXY_BASE = 'https://inmidia.futureoutdoors.com.br';
const PLACA_ID = '69d7d2a69b9a603e468392e3';
const EXPECTED_PROXY = `${PROXY_BASE}/api/v1/public/placas/${PLACA_ID}/imagem`;

describe('public plates presenter — proxy de imagem', () => {
  const origBase = process.env.PUBLIC_API_BASE_URL;
  const origR2 = process.env.R2_PUBLIC_URL;

  beforeEach(() => {
    process.env.PUBLIC_API_BASE_URL = PROXY_BASE;
    process.env.R2_PUBLIC_URL = 'https://pub-storage.r2.dev';
  });

  afterEach(() => {
    if (origBase === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = origBase;
    if (origR2 === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = origR2;
  });

  // ── imagemUrl aponta para o proxy ──────────────────────────────────────────

  it('imagemUrl usa URL do proxy quando placa tem imagemPrincipal', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagemPrincipal: 'inmidia-uploads-sistema/cau-37.jpg',
    });
    expect(placa.imagemUrl).toBe(EXPECTED_PROXY);
    expect(placa.imagem).toBe(EXPECTED_PROXY);
  });

  it('imagemUrl usa URL do proxy quando placa tem campo imagem legado', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagem: 'https://pub-storage.r2.dev/inmidia-uploads-sistema/cau-37.jpg',
    });
    expect(placa.imagemUrl).toBe(EXPECTED_PROXY);
  });

  it('imagemUrl usa URL do proxy quando placa tem imagens array', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagens: [{ key: 'inmidia-uploads-sistema/cau-37.jpg', isMain: true }],
    });
    expect(placa.imagemUrl).toBe(EXPECTED_PROXY);
  });

  it('imagemUrl é null quando placa não tem imagem', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagemPrincipal: null,
      imagem: null,
      imagens: [],
    });
    expect(placa.imagemUrl).toBeNull();
    expect(placa.imagem).toBeNull();
  });

  // ── imagemUrl NÃO expõe URLs do storage ───────────────────────────────────

  it('imagemUrl não contém r2.dev', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagemPrincipal: 'https://pub-storage.r2.dev/inmidia-uploads-sistema/cau-37.jpg',
    });
    expect(placa.imagemUrl).not.toContain('r2.dev');
  });

  it('imagemUrl não contém cloudflarestorage.com', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagemPrincipal: 'https://abc.r2.cloudflarestorage.com/bucket/cau-37.jpg',
    });
    expect(placa.imagemUrl).not.toContain('cloudflarestorage.com');
  });

  it('imagemUrl tem o formato correto do proxy', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagemPrincipal: 'cau-37.jpg',
    });
    expect(placa.imagemUrl).toMatch(/\/api\/v1\/public\/placas\/[a-f0-9]+\/imagem$/);
  });

  // ── buildProxyImageUrl ─────────────────────────────────────────────────────

  it('buildProxyImageUrl constrói URL correta', () => {
    expect(buildProxyImageUrl(PLACA_ID)).toBe(EXPECTED_PROXY);
  });

  it('buildProxyImageUrl funciona sem PUBLIC_API_BASE_URL (relativa)', () => {
    delete process.env.PUBLIC_API_BASE_URL;
    expect(buildProxyImageUrl(PLACA_ID)).toBe(`/api/v1/public/placas/${PLACA_ID}/imagem`);
  });

  // ── Payload não expõe dados internos ──────────────────────────────────────

  it('payload não contém empresaId', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      empresaId: 'empresa-secreta-123',
    }) as any;
    expect(placa.empresaId).toBeUndefined();
  });

  it('payload não contém statusComercial interno', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      statusComercial: 'AVAILABLE',
    }) as any;
    expect(placa.statusComercial).toBeUndefined();
  });

  it('payload não contém regiaoId raw', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      regiaoId: { _id: 'regiao-interna', nome: 'Aldeota', city: 'Fortaleza' },
    }) as any;
    expect(placa.regiaoId).toBeUndefined();
    expect(placa.regiao).toBe('Aldeota');
  });

  // ── status e disponibilidade ───────────────────────────────────────────────

  it('placa disponível tem status e disponibilidade corretos', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'AVAILABLE' });
    expect(placa.status).toBe('disponivel');
    expect(placa.disponibilidade).toBe('disponivel');
  });

  it('placa reservada tem status reservado', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'RESERVED' });
    expect(placa.status).toBe('reservado');
    expect(placa.disponibilidade).toBe('reservado');
  });

  it('placa ocupada tem status ocupado', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'OCCUPIED' });
    expect(placa.status).toBe('ocupado');
  });

  it('placa indisponível tem status indisponivel', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'UNAVAILABLE' });
    expect(placa.status).toBe('indisponivel');
  });
});

// ── Testes de imagemMeta (Parte 3) ────────────────────────────────────────────

describe('public plates presenter — imagemMeta', () => {
  const origBase = process.env.PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.PUBLIC_API_BASE_URL = 'https://inmidia.futureoutdoors.com.br';
  });

  afterEach(() => {
    if (origBase === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = origBase;
  });

  it('imagemMeta.url aponta para o proxy', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.jpg' });
    expect(placa.imagemMeta?.url).toBe(`https://inmidia.futureoutdoors.com.br/api/v1/public/placas/${PLACA_ID}/imagem`);
  });

  it('imagemMeta.mimeType derivado de .jpg → image/jpeg', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.jpg' });
    expect(placa.imagemMeta?.mimeType).toBe('image/jpeg');
  });

  it('imagemMeta.mimeType derivado de .webp → image/webp', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.webp' });
    expect(placa.imagemMeta?.mimeType).toBe('image/webp');
  });

  it('imagemMeta.mimeType derivado de .png → image/png', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.png' });
    expect(placa.imagemMeta?.mimeType).toBe('image/png');
  });

  it('imagemMeta.cacheable é true quando há imagem', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.jpg' });
    expect(placa.imagemMeta?.cacheable).toBe(true);
  });

  it('imagemMeta.updatedAt reflete updatedAt da placa', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.jpg', updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(placa.imagemMeta?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('imagemMeta é null quando placa não tem imagem', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: null, imagem: null, imagens: [] });
    expect(placa.imagemMeta).toBeNull();
  });

  it('imagemUrl legado continua presente com valor correto', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.jpg' });
    expect(placa.imagemUrl).toBe(placa.imagemMeta?.url);
    expect(placa.imagem).toBe(placa.imagemMeta?.url);
  });

  it('imagem string e imagemUrl têm o mesmo valor (retrocompatibilidade)', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', imagemPrincipal: 'pasta/foto.avif' });
    expect(placa.imagem).toBe(placa.imagemUrl);
  });
});

// ── Testes de mimeTypeFromStoredPath ──────────────────────────────────────────

describe('mimeTypeFromStoredPath', () => {
  test.each([
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.webp', 'image/webp'],
    ['.avif', 'image/avif'],
    ['.svg', 'image/svg+xml'],
  ])('extensão %s → %s', (ext, expected) => {
    expect(mimeTypeFromStoredPath(`pasta/foto${ext}`)).toBe(expected);
  });

  it('extensão desconhecida → null', () => {
    expect(mimeTypeFromStoredPath('pasta/foto.tiff')).toBeNull();
  });

  it('sem extensão → null', () => {
    expect(mimeTypeFromStoredPath('pasta/foto')).toBeNull();
  });

  it('null → null', () => {
    expect(mimeTypeFromStoredPath(null)).toBeNull();
  });

  it('remove querystring antes de verificar extensão', () => {
    expect(mimeTypeFromStoredPath('pasta/foto.jpg?v=1')).toBe('image/jpeg');
  });
});
