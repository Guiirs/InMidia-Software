import { describe, expect, it } from 'vitest';
import { normalizeBoardCoordinates } from './boardCoordinates.js';

describe('normalizeBoardCoordinates', () => {
  it('le latitude/longitude diretos', () => {
    expect(normalizeBoardCoordinates({ latitude: '-23.55', longitude: '-46.63' })).toEqual({
      latitude: -23.55,
      longitude: -46.63,
      hasCoordinates: true,
      source: 'latitude/longitude',
    });
  });

  it('le lat/lng sem inverter', () => {
    expect(normalizeBoardCoordinates({ lat: -3.7, lng: -38.5 })).toMatchObject({
      latitude: -3.7,
      longitude: -38.5,
      source: 'lat/lng',
    });
  });

  it('le coordinates object', () => {
    expect(normalizeBoardCoordinates({ coordinates: { lat: -22.9, lng: -43.2 } })).toMatchObject({
      latitude: -22.9,
      longitude: -43.2,
      source: 'coordinates.lat/lng',
    });
  });

  it('le coordenadas object', () => {
    expect(normalizeBoardCoordinates({ coordenadas: { latitude: -19.9, longitude: -43.9 } })).toMatchObject({
      latitude: -19.9,
      longitude: -43.9,
      source: 'coordenadas.latitude/longitude',
    });
  });

  it('le coordenadas string "lat,lng"', () => {
    expect(normalizeBoardCoordinates({ coordenadas: '-25.57,-49.22' })).toMatchObject({
      latitude: -25.57,
      longitude: -49.22,
      source: 'coordenadas:string',
    });
  });

  it('le localizacao.coordinates no padrao GeoJSON [lng, lat]', () => {
    expect(normalizeBoardCoordinates({ localizacao: { coordinates: [-46.6333, -23.5505] } })).toMatchObject({
      latitude: -23.5505,
      longitude: -46.6333,
      source: 'localizacao.coordinates',
    });
  });

  it('le location.coordinates no padrao GeoJSON [lng, lat]', () => {
    expect(normalizeBoardCoordinates({ location: { coordinates: [-35.2, -5.8] } })).toMatchObject({
      latitude: -5.8,
      longitude: -35.2,
      source: 'location.coordinates',
    });
  });

  it('le geo.coordinates no padrao GeoJSON [lng, lat]', () => {
    expect(normalizeBoardCoordinates({ geo: { coordinates: [-51.23, -30.03] } })).toMatchObject({
      latitude: -30.03,
      longitude: -51.23,
      source: 'geo.coordinates',
    });
  });

  it('rejeita valores invalidos', () => {
    expect(normalizeBoardCoordinates({ latitude: 999, longitude: -46 })).toEqual({
      latitude: null,
      longitude: null,
      hasCoordinates: false,
      source: null,
    });
  });

  it('nao corrige nem inverte arrays fora do padrao GeoJSON', () => {
    expect(normalizeBoardCoordinates({ location: { coordinates: [-23.55, -200] } }).hasCoordinates).toBe(false);
  });
});
