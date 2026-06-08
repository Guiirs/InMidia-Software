import { describe, expect, it, beforeEach, vi } from 'vitest';

import apiClient from './apiClient';
import { addPlaca, fetchPlacaLocations, reorderPlacas, updatePlaca } from './placaService';

vi.mock('./apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('placaService: fetchPlacaLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normaliza resposta envelopada com latitude e longitude para array do mapa', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            _id: 'placa-1',
            numero_placa: 'ABC-1234',
            latitude: -23.55,
            longitude: -46.63,
          },
        ],
        count: 1,
      },
    });

    const locations = await fetchPlacaLocations();

    expect(apiClient.get).toHaveBeenCalledWith('/placas/locations');
    expect(locations).toEqual([
      expect.objectContaining({
        id: 'placa-1',
        _id: 'placa-1',
        numero_placa: 'ABC-1234',
        coordenadas: '-23.55,-46.63',
      }),
    ]);
  });

  it('normaliza localizacoes com formatos legados/canonicos para markers do mapa', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { _id: 'lat-string', numero_placa: 'LAT-STR', latitude: '-23.55052', longitude: '-46.633308' },
          { _id: 'lat-lng', numero_placa: 'LAT-LNG', lat: -23.55052, lng: -46.633308 },
          { _id: 'coord-string', numero_placa: 'COORD-STR', coordenadas: '-23.55052,-46.633308' },
          { _id: 'coord-space', numero_placa: 'COORD-SPC', coordenadas: '-23.55052, -46.633308' },
          { _id: 'coord-array-geo', numero_placa: 'ARR-GEO', coordinates: [-46.633308, -23.55052] },
          { _id: 'coord-array-latlng', numero_placa: 'ARR-LAT', coordinates: [-23.55052, -46.633308] },
          { _id: 'no-region', numero_placa: 'NO-REG', latitude: -23.55052, longitude: -46.633308, regiaoId: null },
        ],
      },
    });

    const locations = await fetchPlacaLocations();

    expect(locations.map((loc) => loc.id)).toEqual([
      'lat-string',
      'lat-lng',
      'coord-string',
      'coord-space',
      'coord-array-geo',
      'coord-array-latlng',
      'no-region',
    ]);
    expect(locations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'lat-string', latitude: -23.55052, longitude: -46.633308, coordenadas: '-23.55052,-46.633308' }),
      expect.objectContaining({ id: 'coord-space', latitude: -23.55052, longitude: -46.633308, coordenadas: '-23.55052,-46.633308' }),
      expect.objectContaining({ id: 'coord-array-geo', latitude: -23.55052, longitude: -46.633308, coordenadas: '-23.55052,-46.633308' }),
      expect.objectContaining({ id: 'no-region', latitude: -23.55052, longitude: -46.633308 }),
    ]));
  });

  it('mantem localizacao invalida sem coordenadas para o mapa descartar explicitamente', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [{ _id: 'invalid', numero_placa: 'INV', latitude: 999, longitude: -46.633308 }] },
    });

    const locations = await fetchPlacaLocations();

    expect(locations).toEqual([
      expect.objectContaining({
        id: 'invalid',
        latitude: null,
        longitude: null,
        coordenadas: '',
      }),
    ]);
  });

  it('retorna array vazio para payload nao-array', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { success: true, data: null } });

    await expect(fetchPlacaLocations()).resolves.toEqual([]);
  });

  it('envia organizacao visual para endpoint de reorder', async () => {
    apiClient.patch = vi.fn().mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { _id: 'p-1', numero_placa: 'A-1', numeroOperacional: 1, disponivel: true },
          { _id: 'p-2', numero_placa: 'A-2', numeroOperacional: 2, disponivel: true },
        ],
      },
    });

    const payload = {
      items: [
        { placaId: 'p-1', numeroOperacional: 1 },
        { placaId: 'p-2', numeroOperacional: 2 },
      ],
    };

    const result = await reorderPlacas(payload);

    expect(apiClient.patch).toHaveBeenCalledWith('/placas/reorder', payload);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].numeroOperacional).toBe(1);
  });

  it('remove campos comerciais do payload de criacao de placa', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { success: true } });
    const formData = new FormData();
    formData.append('numero_placa', 'ABC-123');
    formData.append('regiaoId', 'reg-1');
    formData.append('latitude', '-23.55052');
    formData.append('longitude', '-46.633308');
    formData.append('coordenadas', '-23.55052,-46.633308');
    formData.append('clienteId', 'cliente-1');
    formData.append('contratoId', 'contrato-1');
    formData.append('valor_mensal', '1000');
    formData.append('dataInicio', '2026-06-01');

    await addPlaca(formData);

    const sent = apiClient.post.mock.calls[0][1];
    expect([...sent.keys()]).toEqual(['numero_placa', 'regiaoId', 'latitude', 'longitude', 'coordenadas']);
  });

  it('remove campos comerciais do payload de atualizacao de placa', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { success: true } });
    const formData = new FormData();
    formData.append('endereco', 'Rua A');
    formData.append('latitude', '-23.55052');
    formData.append('longitude', '-46.633308');
    formData.append('coordenadas', '-23.55052,-46.633308');
    formData.append('contratoId', 'contrato-1');
    formData.append('dataFim', '2026-06-30');

    await updatePlaca('placa-1', formData);

    const sent = apiClient.put.mock.calls[0][1];
    expect([...sent.keys()]).toEqual(['endereco', 'latitude', 'longitude', 'coordenadas']);
  });
});
