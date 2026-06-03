// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizePlateCardData, resolveSafePlateImageUrl } from './normalizePlateCardData.js';

describe('resolveSafePlateImageUrl', () => {
  // ── null / vazio ────────────────────────────────────────────────────────────

  it('retorna null para entrada nula', () => {
    expect(resolveSafePlateImageUrl(null)).toBeNull();
  });

  it('retorna null para entrada undefined', () => {
    expect(resolveSafePlateImageUrl(undefined)).toBeNull();
  });

  it('retorna null para objeto vazio', () => {
    expect(resolveSafePlateImageUrl({})).toBeNull();
  });

  // ── prioridade de campos normalizados ────────────────────────────────────────

  it('prioriza imageUrl sobre mainImageUrl', () => {
    const board = { imageUrl: 'https://cdn/a.jpg', mainImageUrl: 'https://cdn/b.jpg' };
    expect(resolveSafePlateImageUrl(board)).toBe('https://cdn/a.jpg');
  });

  it('usa mainImageUrl quando imageUrl ausente', () => {
    expect(resolveSafePlateImageUrl({ mainImageUrl: 'https://cdn/b.jpg' })).toBe('https://cdn/b.jpg');
  });

  it('usa media.mainUrl como terceiro fallback', () => {
    expect(resolveSafePlateImageUrl({ media: { mainUrl: 'https://cdn/c.jpg' } })).toBe('https://cdn/c.jpg');
  });

  it('imageUrl vazio cede para mainImageUrl', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: '', mainImageUrl: 'https://cdn/b.jpg' })).toBe('https://cdn/b.jpg');
  });

  // ── aceita URLs HTTP/HTTPS/relativas ─────────────────────────────────────────

  it('aceita URL HTTPS', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: 'https://proxy.inmidia.com/img/abc.jpg' })).toBe('https://proxy.inmidia.com/img/abc.jpg');
  });

  it('aceita URL HTTP', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: 'http://localhost:3000/media/img.jpg' })).toBe('http://localhost:3000/media/img.jpg');
  });

  it('aceita URL relativa com barra inicial', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: '/assets/img/placeholder.png' })).toBe('/assets/img/placeholder.png');
  });

  it('aceita blob URL', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: 'blob:http://localhost/abc-123' })).toBe('blob:http://localhost/abc-123');
  });

  // ── rejeita keys R2 cruas ────────────────────────────────────────────────────

  it('rejeita key R2 estilo empresas/...', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: 'empresas/xyz/plates/photo.jpg' })).toBeNull();
  });

  it('rejeita key R2 estilo inmidia-uploads-sistema/...', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: 'inmidia-uploads-sistema/img.jpg' })).toBeNull();
  });

  it('rejeita nome de arquivo sem prefixo de protocolo', () => {
    expect(resolveSafePlateImageUrl({ imageUrl: 'arquivo.jpg' })).toBeNull();
  });

  // ── ignora campos legados ────────────────────────────────────────────────────

  it('ignora imagemPrincipal — campo legado nao aceito em componente visual', () => {
    expect(resolveSafePlateImageUrl({ imagemPrincipal: 'https://cdn/img.jpg' })).toBeNull();
  });

  it('ignora imagem — campo legado nao aceito em componente visual', () => {
    expect(resolveSafePlateImageUrl({ imagem: 'https://cdn/img.jpg' })).toBeNull();
  });

  it('ignora foto — campo legado nao aceito em componente visual', () => {
    expect(resolveSafePlateImageUrl({ foto: 'https://cdn/img.jpg' })).toBeNull();
  });

  it('ignora storageKey', () => {
    expect(resolveSafePlateImageUrl({ storageKey: 'empresas/abc/plates/img.jpg' })).toBeNull();
  });

  it('ignora jetImageUrl', () => {
    expect(resolveSafePlateImageUrl({ jetImageUrl: 'https://cdn/img.jpg' })).toBeNull();
  });
});

describe('normalizePlateCardData — campo imagemUrl (legado da API de listagem)', () => {
  const BASE = { id: '1', codigo: 'CAU-18', hasImage: true };

  it('raw.imagemUrl vira imageUrl e mainImageUrl fica igual', () => {
    const url = 'https://api.inmidia.com/media/plates/1/main';
    const card = normalizePlateCardData({ ...BASE, imagemUrl: url });
    expect(card.imageUrl).toBe(url);
    expect(card.hasImage).toBe(true);
  });

  it('raw.imageUrl tem prioridade sobre raw.imagemUrl', () => {
    const card = normalizePlateCardData({
      ...BASE,
      imageUrl:  'https://cdn/a.jpg',
      imagemUrl: 'https://cdn/b.jpg',
    });
    expect(card.imageUrl).toBe('https://cdn/a.jpg');
  });

  it('raw.imagemUrl tem prioridade sobre raw.mainImageUrl', () => {
    const card = normalizePlateCardData({
      ...BASE,
      imagemUrl:    'https://cdn/b.jpg',
      mainImageUrl: 'https://cdn/c.jpg',
    });
    expect(card.imageUrl).toBe('https://cdn/b.jpg');
  });

  it('raw.imageUrl continua funcionando normalmente', () => {
    const card = normalizePlateCardData({ ...BASE, imageUrl: 'https://cdn/a.jpg' });
    expect(card.imageUrl).toBe('https://cdn/a.jpg');
    expect(card.hasImage).toBe(true);
  });

  it('raw.mainImageUrl continua funcionando quando imageUrl e imagemUrl ausentes', () => {
    const card = normalizePlateCardData({ ...BASE, mainImageUrl: 'https://cdn/c.jpg' });
    expect(card.imageUrl).toBe('https://cdn/c.jpg');
    expect(card.hasImage).toBe(true);
  });

  it('raw.media.mainUrl e usado como ultimo fallback', () => {
    const card = normalizePlateCardData({ ...BASE, media: { mainUrl: 'https://cdn/d.jpg' } });
    expect(card.imageUrl).toBe('https://cdn/d.jpg');
    expect(card.hasImage).toBe(true);
  });

  it('raw.imagemPrincipal NAO e usado pelo normalizePlateCardData — campo legado resolvido antes no adapter', () => {
    const card = normalizePlateCardData({ ...BASE, imagemPrincipal: 'https://cdn/legacy.jpg' });
    expect(card.imageUrl).toBeNull();
    expect(card.hasImage).toBe(false);
  });

  it('quando hasImage false, imageUrl e null', () => {
    const card = normalizePlateCardData({ id: '2', codigo: 'CAU-19', hasImage: false });
    expect(card.imageUrl).toBeNull();
    expect(card.hasImage).toBe(false);
  });

  it('nao crasha com imagemUrl vazio — retorna null', () => {
    const card = normalizePlateCardData({ ...BASE, imagemUrl: '' });
    expect(card.imageUrl).toBeNull();
  });
});
