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

describe('normalizePlateCardData — coordenadas', () => {
  it('expõe latitude e longitude do campo canônico', () => {
    const card = normalizePlateCardData({ id: '1', latitude: -3.742352, longitude: -38.608361 });
    expect(card.latitude).toBe(-3.742352);
    expect(card.longitude).toBe(-38.608361);
    expect(card.lat).toBe(-3.742352);
    expect(card.lng).toBe(-38.608361);
    expect(card.hasCoordinates).toBe(true);
  });

  it('expõe lat/lng como alias de latitude/longitude', () => {
    const card = normalizePlateCardData({ id: '1', lat: -3.742, lng: -38.608 });
    expect(card.latitude).toBe(-3.742);
    expect(card.longitude).toBe(-38.608);
    expect(card.hasCoordinates).toBe(true);
  });

  it('prioriza latitude/longitude sobre lat/lng quando ambos presentes', () => {
    const card = normalizePlateCardData({
      id: '1',
      latitude: -3.742352, longitude: -38.608361,
      lat: -3.742, lng: -38.608,
    });
    expect(card.latitude).toBe(-3.742352);
    expect(card.longitude).toBe(-38.608361);
  });

  it('hasCoordinates false quando campos ausentes', () => {
    const card = normalizePlateCardData({ id: '1' });
    expect(card.hasCoordinates).toBe(false);
    expect(card.latitude).toBeNull();
    expect(card.longitude).toBeNull();
  });

  it('hasCoordinates false quando lat/lng são NaN', () => {
    const card = normalizePlateCardData({ id: '1', latitude: NaN, longitude: NaN });
    expect(card.hasCoordinates).toBe(false);
    expect(card.latitude).toBeNull();
  });

  it('coordenadas canônica derivada quando hasCoordinates true', () => {
    const card = normalizePlateCardData({ id: '1', latitude: -23.5505, longitude: -46.6333 });
    expect(card.coordenadas).toBe('-23.5505,-46.6333');
    expect(card.coordinates).toEqual({ latitude: -23.5505, longitude: -46.6333 });
  });
});

describe('normalizePlateCardData — commercialSnapshot e dados comerciais', () => {
  it('passa commercialSnapshot quando presente no board', () => {
    const snap = {
      clientName: 'Fortaleza Shopping',
      revenue: 3500,
      commercialStatus: 'CONTRACTED_ACTIVE',
      hasActiveContract: true,
    };
    const card = normalizePlateCardData({ id: '1', commercialSnapshot: snap });
    expect(card.commercialSnapshot).toEqual(snap);
  });

  it('commercialSnapshot null quando ausente', () => {
    const card = normalizePlateCardData({ id: '1' });
    expect(card.commercialSnapshot).toBeNull();
  });

  it('commercialSnapshot null para valor nao-objeto', () => {
    const card = normalizePlateCardData({ id: '1', commercialSnapshot: 'invalido' });
    expect(card.commercialSnapshot).toBeNull();
  });

  it('cliente passado diretamente e exibido no card', () => {
    const card = normalizePlateCardData({ id: '1', cliente: 'RioMar Shopping' });
    expect(card.cliente).toBe('RioMar Shopping');
  });

  it('cliente null quando ausente — sem mock', () => {
    const card = normalizePlateCardData({ id: '1' });
    expect(card.cliente).toBeNull();
  });

  it('receitaFormatada real quando fornecida pelo adapter', () => {
    const card = normalizePlateCardData({ id: '1', receitaFormatada: 'R$ 3.500/mês' });
    expect(card.receitaFormatada).toBe('R$ 3.500/mês');
  });

  it('receitaFormatada usa fallback A negociar apenas quando campo ausente', () => {
    const card = normalizePlateCardData({ id: '1' });
    expect(card.receitaFormatada).toBe('A negociar');
  });

  it('receitaEstimada zero quando ausente', () => {
    const card = normalizePlateCardData({ id: '1' });
    expect(card.receitaEstimada).toBe(0);
  });

  it('receitaEstimada preserva valor real quando fornecido', () => {
    const card = normalizePlateCardData({ id: '1', receitaEstimada: 4200 });
    expect(card.receitaEstimada).toBe(4200);
  });
});

describe('normalizePlateCardData — operationalBlock e isAllocationBlocked', () => {
  it('operationalBlock null e isAllocationBlocked false quando ausente', () => {
    const card = normalizePlateCardData({ id: '1' });
    expect(card.operationalBlock).toBeNull();
    expect(card.isAllocationBlocked).toBe(false);
  });

  it('operationalBlock null para valor nao-objeto', () => {
    const card = normalizePlateCardData({ id: '1', operationalBlock: 'invalido' });
    expect(card.operationalBlock).toBeNull();
    expect(card.isAllocationBlocked).toBe(false);
  });

  it('normaliza operationalBlock completo (instalação) e marca isAllocationBlocked', () => {
    const card = normalizePlateCardData({
      id: '1',
      operationalBlock: {
        operationId: 'op-1',
        operationType: 'INSTALLATION',
        operationStatus: 'PENDING',
        label: 'Pendente de instalação',
        assignedTo: 'Equipe Norte',
        notes: 'Aguardando liberação de acesso.',
      },
    });

    expect(card.operationalBlock).toEqual({
      blocked: true,
      reason: 'Esta placa já possui uma operação em aberto.',
      operationId: 'op-1',
      operationType: 'INSTALLATION',
      operationStatus: 'PENDING',
      status: 'PENDING',
      label: 'Pendente de instalação',
      assignedTo: 'Equipe Norte',
      notes: 'Aguardando liberação de acesso.',
      teamSnapshot: null,
    });
    expect(card.isAllocationBlocked).toBe(true);
  });

  it('normaliza teamSnapshot do operationalBlock quando presente', () => {
    const card = normalizePlateCardData({
      id: '1',
      operationalBlock: {
        operationId: 'op-5',
        operationType: 'SCRAPING',
        operationStatus: 'IN_PROGRESS',
        label: 'Raspagem em andamento',
        teamSnapshot: { id: 'team-1', name: 'Equipe Fortaleza 01', memberCount: 3, members: [] },
      },
    });

    expect(card.operationalBlock.teamSnapshot).toEqual({
      id: 'team-1',
      name: 'Equipe Fortaleza 01',
      memberCount: 3,
      members: [],
    });
  });

  it('aplica fallbacks para operationType/operationStatus/label ausentes', () => {
    const card = normalizePlateCardData({
      id: '1',
      operationalBlock: { operationId: 'op-2' },
    });

    expect(card.operationalBlock).toMatchObject({
      operationId: 'op-2',
      operationType: 'OTHER',
      operationStatus: 'PENDING',
      label: 'Operação em andamento',
      assignedTo: null,
      notes: null,
    });
    expect(card.isAllocationBlocked).toBe(true);
  });

  it('assignedTo e notes ficam null quando ausentes', () => {
    const card = normalizePlateCardData({
      id: '1',
      operationalBlock: {
        operationId: 'op-3',
        operationType: 'SCRAPING',
        operationStatus: 'IN_PROGRESS',
        label: 'Raspagem em andamento',
      },
    });

    expect(card.operationalBlock.assignedTo).toBeNull();
    expect(card.operationalBlock.notes).toBeNull();
    expect(card.isAllocationBlocked).toBe(true);
  });
});
