/**
 * Testes do presenter público de placas.
 *
 * API canônica: toPublicPlaca(raw, plateMedia?)
 *   - plateMedia: { activeKey, version } — fonte única de verdade da imagem.
 *   - Sem plateMedia (null/undefined): imagemUrl=null, hasImage=false.
 *   - Nunca lê imagemPrincipal, imagem ou imagens[] do raw doc para resolução de imagem.
 */
import { toPublicPlaca, buildProxyImageUrl } from './public-plates.presenter';
import type { PlateMediaResolved } from './public-plates.presenter';

const PROXY_BASE = 'https://inmidia.futureoutdoors.com.br';
const PLACA_ID = '69d7d2a69b9a603e468392e3';
const EXPECTED_PROXY = `${PROXY_BASE}/api/v1/public/media/plates/${PLACA_ID}/main`;
const R2_KEY = 'empresas/e1/plates/p/main/photo.jpg';

const PM: PlateMediaResolved = { activeKey: R2_KEY, version: '1704067200000' };

describe('public plates presenter — proxy de imagem (nova API PlateMedia)', () => {
  const origBase = process.env.PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.PUBLIC_API_BASE_URL = PROXY_BASE;
  });

  afterEach(() => {
    if (origBase === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = origBase;
  });

  // ── imagemUrl aponta para o proxy canônico ──────────────────────────────────

  it('imagemUrl usa URL canônica quando PlateMedia tem activeKey', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    expect(placa.imagemUrl).toBe(`${EXPECTED_PROXY}?v=1704067200000`);
    expect(placa.imagem).toBe(placa.imagemUrl);
    expect(placa.hasImage).toBe(true);
  });

  it('imagemUrl é null quando plateMedia é null', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, null);
    expect(placa.imagemUrl).toBeNull();
    expect(placa.imagem).toBeNull();
    expect(placa.hasImage).toBe(false);
  });

  it('imagemUrl é null quando plateMedia é undefined (sem segundo arg)', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' });
    expect(placa.imagemUrl).toBeNull();
    expect(placa.hasImage).toBe(false);
  });

  it('ignora imagemPrincipal do raw doc quando plateMedia é null', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagemPrincipal: 'inmidia-uploads-sistema/cau-37.jpg',
    }, null);
    expect(placa.imagemUrl).toBeNull();
    expect(placa.hasImage).toBe(false);
  });

  it('ignora imagens[] do raw doc quando plateMedia é null', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      imagens: [{ key: 'inmidia-uploads-sistema/cau-37.jpg', isMain: true }],
    }, null);
    expect(placa.imagemUrl).toBeNull();
    expect(placa.hasImage).toBe(false);
  });

  // ── imagemUrl NÃO expõe URLs do storage ────────────────────────────────────

  it('imagemUrl não contém r2.dev', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    expect(placa.imagemUrl).not.toContain('r2.dev');
  });

  it('imagemUrl não contém cloudflarestorage.com', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    expect(placa.imagemUrl).not.toContain('cloudflarestorage.com');
  });

  it('imagemUrl não contém a activeKey do R2', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    expect(placa.imagemUrl).not.toContain(R2_KEY);
    expect(placa.imagemUrl).not.toContain('empresas/');
  });

  it('imagemUrl tem o formato canônico /api/v1/public/media/plates/:id/main', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    expect(placa.imagemUrl).toMatch(/\/api\/v1\/public\/media\/plates\/[a-f0-9]+\/main/);
  });

  // ── buildProxyImageUrl ──────────────────────────────────────────────────────

  it('buildProxyImageUrl constrói URL canônica correta com version', () => {
    expect(buildProxyImageUrl(PLACA_ID, '1234')).toBe(`${EXPECTED_PROXY}?v=1234`);
  });

  it('buildProxyImageUrl funciona sem PUBLIC_API_BASE_URL (relativa)', () => {
    delete process.env.PUBLIC_API_BASE_URL;
    expect(buildProxyImageUrl(PLACA_ID, '1')).toBe(`/api/v1/public/media/plates/${PLACA_ID}/main?v=1`);
  });

  it('buildProxyImageUrl sem version não inclui ?v=', () => {
    expect(buildProxyImageUrl(PLACA_ID)).toBe(EXPECTED_PROXY);
  });

  it('PUBLIC_API_BASE_URL com trailing slash retorna URL sem barra dupla', () => {
    process.env.PUBLIC_API_BASE_URL = `${PROXY_BASE}/`;
    const url = buildProxyImageUrl(PLACA_ID);
    expect(url).toBe(EXPECTED_PROXY);
    expect(url).not.toContain('//api/');
  });

  it('PUBLIC_API_BASE_URL localhost em producao nao vaza localhost no payload', () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_API_BASE_URL = 'http://localhost:4000';
    const url = buildProxyImageUrl(PLACA_ID);
    expect(url).toBe(`/api/v1/public/media/plates/${PLACA_ID}/main`);
    expect(url).not.toContain('localhost');
    process.env.NODE_ENV = 'test';
  });

  // ── hasImage ────────────────────────────────────────────────────────────────

  it('hasImage true quando PlateMedia tem activeKey', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    expect(placa.hasImage).toBe(true);
  });

  it('hasImage false quando PlateMedia é null', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, null);
    expect(placa.hasImage).toBe(false);
  });

  it('hasImage false quando PlateMedia.activeKey é null', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, { activeKey: null, version: '' });
    expect(placa.hasImage).toBe(false);
    expect(placa.imagemUrl).toBeNull();
  });

  // ── aliases retrocompatibilidade ────────────────────────────────────────────

  it('imagemUrl, imagem, imagemMeta.url, jetImageUrl apontam para o mesmo proxy', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    expect(placa.imagem).toBe(placa.imagemUrl);
    expect(placa.imagemMeta?.url).toBe(placa.imagemUrl);
    expect(placa.jetImageUrl).toBe(placa.imagemUrl);
    expect(placa.jet_image_url).toBe(placa.imagemUrl);
    expect(placa.jetImage?.url).toBe(placa.imagemUrl);
    expect(placa.image?.url).toBe(placa.imagemUrl);
  });

  it('campos JetEngine/Elementor são null quando não há PlateMedia', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: '01' }, null);
    expect(placa.jetImageUrl).toBeNull();
    expect(placa.jet_image_url).toBeNull();
    expect(placa.jetImage).toBeNull();
    expect(placa.image).toBeNull();
    expect(placa.imagemMeta).toBeNull();
  });

  it('campos JetEngine/Elementor não expõem R2 ou paths internos', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    const imagePayload = JSON.stringify({
      jetImageUrl: placa.jetImageUrl,
      jet_image_url: placa.jet_image_url,
      jetImage: placa.jetImage,
      image: placa.image,
    });
    expect(imagePayload).not.toContain('r2.dev');
    expect(imagePayload).not.toContain('cloudflarestorage.com');
    expect(imagePayload).not.toContain(R2_KEY);
    expect(imagePayload).toContain('/api/v1/public/media/plates/');
  });

  // ── ?v= cache-busting ───────────────────────────────────────────────────────

  it('imagemUrl inclui ?v= de PlateMedia.version', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, { activeKey: R2_KEY, version: '9999' });
    expect(placa.imagemUrl).toContain('?v=9999');
  });

  it('version diferente produz imagemUrl diferente (cache-busting)', () => {
    const url1 = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, { activeKey: R2_KEY, version: '1000' }).imagemUrl;
    const url2 = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, { activeKey: R2_KEY, version: '2000' }).imagemUrl;
    expect(url1).not.toBe(url2);
  });

  // ── JSON público não vaza dados internos ────────────────────────────────────

  it('JSON público não vaza key, bucket, R2 ou campos internos', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'CAU-37' }, PM);
    const serialized = JSON.stringify(placa);
    expect(serialized).not.toContain('r2.dev');
    expect(serialized).not.toContain('cloudflarestorage.com');
    expect(serialized).not.toContain(R2_KEY);
    expect(serialized).not.toContain('activeKey');
    expect(serialized).not.toContain('r2Key');
  });

  it('payload não contém empresaId', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      empresaId: 'empresa-secreta-123',
    }, null) as any;
    expect(placa.empresaId).toBeUndefined();
  });

  it('payload não contém statusComercial interno', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      statusComercial: 'AVAILABLE',
    }, null) as any;
    expect(placa.statusComercial).toBeUndefined();
  });

  it('payload não contém regiaoId raw', () => {
    const placa = toPublicPlaca({
      _id: PLACA_ID,
      numero_placa: 'CAU-37',
      regiaoId: { _id: 'regiao-interna', nome: 'Aldeota', city: 'Fortaleza' },
    }, null) as any;
    expect(placa.regiaoId).toBeUndefined();
    expect(placa.regiao).toBe('Aldeota');
  });

  // ── status e disponibilidade ────────────────────────────────────────────────

  it('placa disponível tem status e disponibilidade corretos', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'AVAILABLE' }, null);
    expect(placa.status).toBe('disponivel');
    expect(placa.disponibilidade).toBe('disponivel');
  });

  it('placa reservada tem status reservado', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'RESERVED' }, null);
    expect(placa.status).toBe('reservado');
  });

  it('placa ocupada tem status ocupado', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'OCCUPIED' }, null);
    expect(placa.status).toBe('ocupado');
  });

  it('placa indisponível tem status indisponivel', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', statusComercial: 'UNAVAILABLE' }, null);
    expect(placa.status).toBe('indisponivel');
  });
});

// ── imagemMeta ────────────────────────────────────────────────────────────────

describe('public plates presenter — imagemMeta', () => {
  const origBase = process.env.PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.PUBLIC_API_BASE_URL = PROXY_BASE;
  });

  afterEach(() => {
    if (origBase === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = origBase;
  });

  it('imagemMeta.url aponta para o proxy canônico com ?v=', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, PM);
    expect(placa.imagemMeta?.url).toBe(`${EXPECTED_PROXY}?v=${PM.version}`);
  });

  it('imagemMeta.mimeType é null (mimeType derivado apenas do PlateMedia — não exposto no presenter)', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, PM);
    expect(placa.imagemMeta?.mimeType).toBeNull();
  });

  it('imagemMeta.cacheable é true quando há PlateMedia', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, PM);
    expect(placa.imagemMeta?.cacheable).toBe(true);
  });

  it('imagemMeta.updatedAt reflete updatedAt da placa', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X', updatedAt: '2026-01-01T00:00:00.000Z' }, PM);
    expect(placa.imagemMeta?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('imagemMeta é null quando não há PlateMedia', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, null);
    expect(placa.imagemMeta).toBeNull();
  });

  it('imagemUrl e imagemMeta.url são consistentes', () => {
    const placa = toPublicPlaca({ _id: PLACA_ID, numero_placa: 'X' }, PM);
    expect(placa.imagemUrl).toBe(placa.imagemMeta?.url);
    expect(placa.imagem).toBe(placa.imagemMeta?.url);
  });
});
