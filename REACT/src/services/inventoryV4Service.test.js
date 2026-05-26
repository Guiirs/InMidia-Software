import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import apiClient from './apiClient.js';
import {
  createBoard,
  getBoardById,
  getInventoryRegions,
  getInventorySummary,
  listBoards,
  removeBoardImage,
  setBoardMainImage,
  toggleBoardAvailability,
  updateBoard,
  uploadBoardImage,
} from './inventoryV4Service.js';

vi.mock('./apiClient.js', () => ({
  default: {
    request: vi.fn(),
  },
}));

function mockData(data) {
  apiClient.request.mockResolvedValueOnce({ data: { success: true, data } });
}

function lastRequest() {
  return apiClient.request.mock.calls.at(-1)?.[0];
}

describe('inventoryV4Service', () => {
  beforeEach(() => {
    apiClient.request.mockReset();
  });

  it('usa somente /api/v4/inventory para summary, boards, regions e detalhe', async () => {
    mockData({ totals: { totalBoards: 0 }, occupancy: {}, revenue: {}, statusDistribution: [] });
    await getInventorySummary();

    mockData({ boards: [{ id: 'b1', codigo: 'B-1', disponivel: true, status: 'available' }], total: 1, page: 1, limit: 200 });
    await listBoards({ search: 'B-1', status: 'available' });

    mockData({ id: 'b1', codigo: 'B-1', disponivel: true, status: 'available' });
    await getBoardById('b1');

    mockData({ regions: [{ id: 'r1', name: 'Norte', totalBoards: 1, boards: [] }], total: 1 });
    await getInventoryRegions();

    const urls = apiClient.request.mock.calls.map(([request]) => request.url);
    expect(urls).toEqual(expect.arrayContaining([
      expect.stringContaining('/api/v4/inventory/summary'),
      expect.stringContaining('/api/v4/inventory/boards'),
      expect.stringContaining('/api/v4/inventory/boards/b1'),
      expect.stringContaining('/api/v4/inventory/regions'),
    ]));
    expect(urls.every((url) => url.includes('/api/v4/inventory'))).toBe(true);
  });

  it('liga update e toggleAvailability aos endpoints V4 esperados', async () => {
    mockData({ id: 'b1', codigo: 'B-EDIT', disponivel: true, status: 'available' });
    await updateBoard('b1', { id: 'b1', codigo: 'B-EDIT', localizacao: 'Rua Editada' });

    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'patch',
      url: expect.stringContaining('/api/v4/inventory/boards/b1'),
      data: expect.objectContaining({ numero_placa: 'B-EDIT', nomeDaRua: 'Rua Editada' }),
    }));

    mockData({ id: 'b1', codigo: 'B-EDIT', disponivel: false, status: 'maintenance' });
    await toggleBoardAvailability('b1');

    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'patch',
      url: expect.stringContaining('/api/v4/inventory/boards/b1/availability'),
    }));
  });

  it('nao envia campos comerciais no create/update canonico de placa', async () => {
    mockData({ id: 'b1', codigo: 'B-CREATE', disponivel: true, status: 'available' });
    await createBoard({
      codigo: 'B-CREATE',
      endereco: 'Rua Fisica',
      regiaoId: 'r1',
      statusOperacional: 'ACTIVE',
      statusComercial: 'OCCUPIED',
      receitaEstimada: 2500,
      cliente: 'Cliente X',
      contratoId: 'ctr-1',
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
    });

    expect(lastRequest().data).toEqual(expect.objectContaining({
      numero_placa: 'B-CREATE',
      endereco: 'Rua Fisica',
      regiaoId: 'r1',
      statusOperacional: 'ACTIVE',
    }));
    expect(lastRequest().data).not.toHaveProperty('statusComercial');
    expect(lastRequest().data).not.toHaveProperty('valorMensal');
    expect(lastRequest().data).not.toHaveProperty('cliente');
    expect(lastRequest().data).not.toHaveProperty('contratoId');
    expect(lastRequest().data).not.toHaveProperty('dataInicio');
    expect(lastRequest().data).not.toHaveProperty('dataFim');

    mockData({ id: 'b1', codigo: 'B-EDIT', disponivel: true, status: 'available' });
    await updateBoard('b1', {
      id: 'b1',
      codigo: 'B-EDIT',
      endereco: 'Rua Editada',
      statusComercial: 'OCCUPIED',
      receitaEstimada: 3000,
      cliente: 'Cliente Y',
      contratoId: 'ctr-2',
    });

    expect(lastRequest().data).toEqual(expect.objectContaining({
      numero_placa: 'B-EDIT',
      endereco: 'Rua Editada',
    }));
    expect(lastRequest().data).not.toHaveProperty('statusComercial');
    expect(lastRequest().data).not.toHaveProperty('receitaEstimada');
    expect(lastRequest().data).not.toHaveProperty('cliente');
    expect(lastRequest().data).not.toHaveProperty('contratoId');
  });

  it('normaliza coordenadas legadas vindas do endpoint de boards', async () => {
    mockData({
      boards: [{
        id: 'b1',
        codigo: 'B-GEO',
        disponivel: true,
        status: 'available',
        location: { coordinates: [-46.6333, -23.5505] },
      }],
      total: 1,
      page: 1,
      limit: 200,
    });

    const boards = await listBoards();

    expect(boards[0]).toEqual(expect.objectContaining({
      latitude: -23.5505,
      longitude: -46.6333,
      lat: -23.5505,
      lng: -46.6333,
      hasCoordinates: true,
    }));
  });

  it('envia latitude/longitude canonicos e compatibilidade no create/update', async () => {
    mockData({ id: 'b1', codigo: 'B-CREATE', disponivel: true, status: 'available' });
    await createBoard({
      codigo: 'B-CREATE',
      endereco: 'Rua Geo',
      regiaoId: 'r1',
      latitude: '-23.5505',
      longitude: '-46.6333',
    });

    expect(lastRequest().data).toEqual(expect.objectContaining({
      latitude: -23.5505,
      longitude: -46.6333,
      coordinates: { latitude: -23.5505, longitude: -46.6333 },
      coordenadas: '-23.5505,-46.6333',
    }));

    mockData({ id: 'b1', codigo: 'B-EDIT', disponivel: true, status: 'available' });
    await updateBoard('b1', {
      codigo: 'B-EDIT',
      coordenadas: '-25.57,-49.22',
    });

    expect(lastRequest().data).toEqual(expect.objectContaining({
      latitude: -25.57,
      longitude: -49.22,
      coordenadas: '-25.57,-49.22',
    }));
  });

  it('normaliza imagemPrincipal e galeria de campos legados', async () => {
    mockData({
      boards: [{
        id: 'b1',
        codigo: 'B-IMG',
        disponivel: true,
        status: 'available',
        mainImageUrl: 'https://cdn/main.jpg',
        images: [{ id: 'img-1', url: 'https://cdn/main.jpg', filename: 'main.jpg', source: 'IMPORTED' }],
      }],
      total: 1,
      page: 1,
      limit: 200,
    });

    const boards = await listBoards();

    expect(boards[0].imagemPrincipal).toBe('https://cdn/main.jpg');
    expect(boards[0].imageUrl).toContain('https://cdn/main.jpg');
    expect(boards[0].imagens[0]).toEqual(expect.objectContaining({
      id: 'img-1',
      isMain: true,
      source: 'IMPORTED',
    }));
  });

  it('normaliza mainImageUrl a partir de images[].isMain sem campo legado', async () => {
    mockData({
      boards: [{
        id: 'b-main',
        codigo: 'B-MAIN',
        disponivel: true,
        status: 'available',
        images: [
          { id: 'img-old', url: 'https://cdn/old.jpg', filename: 'old.jpg' },
          { id: 'img-main', publicUrl: 'https://cdn/main.webp', filename: 'main.webp', isMain: true },
        ],
      }],
      total: 1,
      page: 1,
      limit: 200,
    });

    const boards = await listBoards();

    expect(boards[0].mainImageUrl).toBe('https://cdn/main.webp');
    expect(boards[0].imagemPrincipal).toBe('https://cdn/main.webp');
    expect(boards[0].imageStatus).toBe('AVAILABLE');
    expect(boards[0].imageUrl).toBe('https://cdn/main.webp');
  });

  it('marca imagem ausente como MISSING', async () => {
    mockData({
      boards: [{ id: 'b-empty', codigo: 'B-EMPTY', disponivel: true, status: 'available' }],
      total: 1,
      page: 1,
      limit: 200,
    });

    const boards = await listBoards();

    expect(boards[0].mainImageUrl).toBeNull();
    expect(boards[0].imageStatus).toBe('MISSING');
  });

  it('nao duplica o prefixo R2 quando imagemPrincipal ja vem com pasta do bucket', async () => {
    mockData({
      boards: [{
        id: 'b1',
        codigo: 'B-R2',
        disponivel: true,
        status: 'available',
        imagemPrincipal: 'inmidia-uploads-sistema/placa.webp',
        imagens: [{ id: 'img-r2', url: 'inmidia-uploads-sistema/placa.webp', filename: 'placa.webp', isMain: true }],
      }],
      total: 1,
      page: 1,
      limit: 200,
    });

    const boards = await listBoards();

    expect(boards[0].imageUrl).toBe('https://pub-a7928cc212cd43008627cd87e0ecdf91.r2.dev/inmidia-uploads-sistema/placa.webp');
    expect(boards[0].imageUrl).not.toContain('inmidia-uploads-sistema/inmidia-uploads-sistema/inmidia-uploads-sistema');
    expect(boards[0].imagens[0].url).toBe(boards[0].imageUrl);
  });

  it('mantem base R2 configurado para imagens antigas salvas apenas com filename', async () => {
    mockData({
      boards: [{
        id: 'b1',
        codigo: 'B-OLD',
        disponivel: true,
        status: 'available',
        imagemPrincipal: 'placa-antiga.webp',
      }],
      total: 1,
      page: 1,
      limit: 200,
    });

    const boards = await listBoards();

    expect(boards[0].imageUrl).toBe('https://pub-a7928cc212cd43008627cd87e0ecdf91.r2.dev/inmidia-uploads-sistema/inmidia-uploads-sistema/placa-antiga.webp');
  });

  it('faz upload multipart e acoes de galeria pelos endpoints v1 de placas', async () => {
    mockData({ id: 'b1', codigo: 'B-IMG', disponivel: true, status: 'available', imagemPrincipal: 'https://cdn/new.jpg' });
    await uploadBoardImage('b1', new File(['x'], 'placa.webp', { type: 'image/webp' }), { category: 'MAIN', setAsMain: true });

    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'post',
      url: expect.stringContaining('/api/v1/placas/b1/images'),
    }));
    expect(lastRequest().data).toBeInstanceOf(FormData);
    expect(lastRequest().data.get('category')).toBe('MAIN');
    expect(lastRequest().data.get('setAsMain')).toBe('true');
    expect(lastRequest().data.get('source')).toBe('UPLOAD');

    mockData({ id: 'b1', codigo: 'B-IMG', disponivel: true, status: 'available' });
    await setBoardMainImage('b1', 'img-1');
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'patch',
      url: expect.stringContaining('/api/v1/placas/b1/images/img-1/main'),
    }));

    mockData({ id: 'b1', codigo: 'B-IMG', disponivel: true, status: 'available' });
    await removeBoardImage('b1', 'img-1');
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'delete',
      url: expect.stringContaining('/api/v1/placas/b1/images/img-1'),
    }));
  });

  it('InventoryProvider consome Sync Core sem chamar v1 direto', () => {
    const provider = readFileSync(new URL('../v4-painel/providers/InventoryProvider.jsx', import.meta.url), 'utf8');

    expect(provider).toContain("useSyncResource('inventory.boards')");
    expect(provider).toContain("useSyncResource('inventory.summary')");
    expect(provider).toContain("useSyncMutation('inventory.board.update')");
    expect(provider).toContain("useSyncMutation('inventory.board.toggleAvailability')");
    expect(provider).not.toMatch(/api\/v1|placaService|fetchPlacas|\/placas/);
  });
});
