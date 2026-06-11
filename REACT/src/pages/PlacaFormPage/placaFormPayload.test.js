import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  buildPlacaFormData,
  getPlateCoordinateFormValues,
  invalidatePlacaCoordinateQueries,
  normalizePlateCoordinatePair,
} from './placaFormPayload.js';

function entries(formData) {
  return Object.fromEntries([...formData.entries()]);
}

describe('placaFormPayload', () => {
  it('inclui latitude/longitude e coordenadas canonicas no payload de criacao', () => {
    const formData = buildPlacaFormData({
      numero_placa: 'OOH-001',
      endereco: 'Av. Paulista',
      latitude: '-23.55052',
      longitude: '-46.633308',
    });

    expect(entries(formData)).toEqual(expect.objectContaining({
      numero_placa: 'OOH-001',
      latitude: '-23.55052',
      longitude: '-46.633308',
      coordenadas: '-23.55052,-46.633308',
    }));
  });

  it('inclui latitude/longitude normalizados no payload de edicao quando alteradas', () => {
    const formData = buildPlacaFormData({
      endereco: 'Rua Editada',
      latitude: '-23.551',
      longitude: '-46.634',
    });

    expect(entries(formData)).toEqual(expect.objectContaining({
      endereco: 'Rua Editada',
      latitude: '-23.551',
      longitude: '-46.634',
      coordenadas: '-23.551,-46.634',
    }));
  });

  it('normaliza virgula decimal para number antes de enviar', () => {
    const formData = buildPlacaFormData({
      latitude: '-23,55052',
      longitude: '-46,633308',
    });

    expect(entries(formData)).toEqual(expect.objectContaining({
      latitude: '-23.55052',
      longitude: '-46.633308',
      coordenadas: '-23.55052,-46.633308',
    }));
  });

  it('nao transforma campos vazios em zero nem envia coordenadas parciais', () => {
    expect(entries(buildPlacaFormData({ latitude: '', longitude: '' }))).toEqual({});

    expect(normalizePlateCoordinatePair('', '-46.633308')).toEqual(expect.objectContaining({
      hasCoordinates: false,
      error: expect.any(String),
    }));
  });

  it('bloqueia coordenadas invalidas antes de montar payload silencioso', () => {
    expect(() => buildPlacaFormData({ latitude: '-91', longitude: '-46.633308' }))
      .toThrow('Latitude deve estar entre -90 e 90.');

    expect(() => buildPlacaFormData({ latitude: '-23.55052', longitude: '-181' }))
      .toThrow('Longitude deve estar entre -180 e 180.');
  });

  it('preenche edicao a partir de coordenadas canonicas ou string legada', () => {
    const expected = {
      latitude: '-3.742352',
      longitude: '-38.608361',
      coordenadas: '-3.742352,-38.608361',
    };
    expect(getPlateCoordinateFormValues({ latitude: -3.742352, longitude: -38.608361 })).toEqual(expected);
    expect(getPlateCoordinateFormValues({ coordenadas: '-3.742352,-38.608361' })).toEqual(expected);
  });

  it('invalida placas, mapa e inventario apos salvar', () => {
    const queryClient = { invalidateQueries: vi.fn() };
    invalidatePlacaCoordinateQueries(queryClient, 'placa-1');

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['placas'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['placaLocations'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inventory'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inventory-v4'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['placa', 'placa-1'] });
  });

  it('PlacaFormPage usa o builder testado para create/update', () => {
    const source = readFileSync(new URL('./PlacaFormPage.jsx', import.meta.url), 'utf8');

    expect(source).toContain('buildPlacaFormData(data');
    expect(source.match(/invalidatePlacaCoordinateQueries\(queryClient/g)).toHaveLength(2);
  });
});
