import { normalizeInventoryBoardCoordinates } from '../services/inventory-boards.service';

describe('InventoryBoardsService coordinates', () => {
  it('normaliza latitude/longitude canonicos', () => {
    expect(normalizeInventoryBoardCoordinates({ latitude: '-23.55', longitude: '-46.63' })).toEqual({
      latitude: -23.55,
      longitude: -46.63,
    });
  });

  it('normaliza coordenadas string sem inverter', () => {
    expect(normalizeInventoryBoardCoordinates({ coordenadas: '-3.7,-38.5' })).toEqual({
      latitude: -3.7,
      longitude: -38.5,
    });
  });

  it('normaliza GeoJSON como [longitude, latitude]', () => {
    expect(normalizeInventoryBoardCoordinates({ location: { coordinates: [-46.6333, -23.5505] } })).toEqual({
      latitude: -23.5505,
      longitude: -46.6333,
    });
  });

  it('rejeita valores invalidos', () => {
    expect(normalizeInventoryBoardCoordinates({ latitude: 999, longitude: -46 })).toBeNull();
  });
});
