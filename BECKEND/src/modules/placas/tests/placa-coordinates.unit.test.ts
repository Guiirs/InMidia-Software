/**
 * Plate Coordinate Persistence — unit tests
 *
 * Validates that validateCreatePlaca / validateUpdatePlaca correctly coerce
 * string lat/lng values (as sent by multipart/FormData) into numbers before
 * Zod validates them, and that the resulting DTO carries the correct numeric
 * values through to the repository layer.
 */

import { validateCreatePlaca, validateUpdatePlaca } from '../dtos/placa.dto';

const VALID_REGIAO_ID = '507f1f77bcf86cd799439011';

// ─── create ─────────────────────────────────────────────────────────────────

describe('validateCreatePlaca — coordinate coercion', () => {
  it('coerces string lat/lng from FormData to numbers', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-001',
      regiaoId: VALID_REGIAO_ID,
      latitude: '-23.55052',
      longitude: '-46.633308',
      coordenadas: '-23.55052,-46.633308',
    }) as any;

    expect(typeof dto.latitude).toBe('number');
    expect(typeof dto.longitude).toBe('number');
    expect(dto.latitude).toBeCloseTo(-23.55052);
    expect(dto.longitude).toBeCloseTo(-46.633308);
    expect(dto.coordenadas).toBe('-23.55052,-46.633308');
  });

  it('coerces comma-decimal string (Brazilian locale) to number', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-002',
      regiaoId: VALID_REGIAO_ID,
      latitude: '-23,55052',
      longitude: '-46,633308',
    }) as any;

    expect(dto.latitude).toBeCloseTo(-23.55052);
    expect(dto.longitude).toBeCloseTo(-46.633308);
  });

  it('treats empty-string lat/lng as absent — no coordinates saved', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-003',
      regiaoId: VALID_REGIAO_ID,
      latitude: '',
      longitude: '',
    }) as any;

    expect(dto.latitude).toBeUndefined();
    expect(dto.longitude).toBeUndefined();
  });

  it('treats whitespace-only lat/lng as absent', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-004',
      regiaoId: VALID_REGIAO_ID,
      latitude: '   ',
      longitude: '   ',
    }) as any;

    expect(dto.latitude).toBeUndefined();
    expect(dto.longitude).toBeUndefined();
  });

  it('treats empty coordenadas string as absent', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-005',
      regiaoId: VALID_REGIAO_ID,
      coordenadas: '',
    }) as any;

    expect(dto.coordenadas).toBeUndefined();
  });

  it('passes through numeric lat/lng unchanged', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-006',
      regiaoId: VALID_REGIAO_ID,
      latitude: -23.55052,
      longitude: -46.633308,
    }) as any;

    expect(dto.latitude).toBe(-23.55052);
    expect(dto.longitude).toBe(-46.633308);
  });

  it('rejects latitude out of range (+91) with ZodError', () => {
    expect(() =>
      validateCreatePlaca({
        numero_placa: 'P-007',
        regiaoId: VALID_REGIAO_ID,
        latitude: '91',
        longitude: '-46.633308',
      }),
    ).toThrow();
  });

  it('rejects longitude out of range (-181) with ZodError', () => {
    expect(() =>
      validateCreatePlaca({
        numero_placa: 'P-008',
        regiaoId: VALID_REGIAO_ID,
        latitude: '-23.55',
        longitude: '-181',
      }),
    ).toThrow();
  });

  it('rejects partial coordinates — lat provided without lng', () => {
    expect(() =>
      validateCreatePlaca({
        numero_placa: 'P-009',
        regiaoId: VALID_REGIAO_ID,
        latitude: '-23.55',
      }),
    ).toThrow();
  });

  it('rejects partial coordinates — lng provided without lat', () => {
    expect(() =>
      validateCreatePlaca({
        numero_placa: 'P-010',
        regiaoId: VALID_REGIAO_ID,
        longitude: '-46.63',
      }),
    ).toThrow();
  });

  it('does not coerce empty string to 0 (equator)', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-011',
      regiaoId: VALID_REGIAO_ID,
      latitude: '',
      longitude: '',
    }) as any;

    // Must be undefined, NOT zero
    expect(dto.latitude).not.toBe(0);
    expect(dto.longitude).not.toBe(0);
    expect(dto.latitude).toBeUndefined();
    expect(dto.longitude).toBeUndefined();
  });

  it('stores both lat, lng and coordenadas string together', () => {
    const dto = validateCreatePlaca({
      numero_placa: 'P-012',
      regiaoId: VALID_REGIAO_ID,
      latitude: '-10.0',
      longitude: '45.0',
      coordenadas: '-10.0,45.0',
    }) as any;

    expect(dto.latitude).toBe(-10.0);
    expect(dto.longitude).toBe(45.0);
    expect(dto.coordenadas).toBe('-10.0,45.0');
  });
});

// ─── update ─────────────────────────────────────────────────────────────────

describe('validateUpdatePlaca — coordinate coercion', () => {
  it('coerces string lat/lng from FormData to numbers', () => {
    const dto = validateUpdatePlaca({
      latitude: '-23.55052',
      longitude: '-46.633308',
    }) as any;

    expect(typeof dto.latitude).toBe('number');
    expect(typeof dto.longitude).toBe('number');
    expect(dto.latitude).toBeCloseTo(-23.55052);
    expect(dto.longitude).toBeCloseTo(-46.633308);
  });

  it('treats empty-string lat/lng as absent on update', () => {
    const dto = validateUpdatePlaca({
      latitude: '',
      longitude: '',
    }) as any;

    expect(dto.latitude).toBeUndefined();
    expect(dto.longitude).toBeUndefined();
  });

  it('does not allow empty string to overwrite existing coordinate with 0', () => {
    const dto = validateUpdatePlaca({ latitude: '', longitude: '' }) as any;
    expect(dto.latitude).not.toBe(0);
    expect(dto.longitude).not.toBe(0);
  });

  it('rejects partial update — lat without lng', () => {
    expect(() =>
      validateUpdatePlaca({ latitude: '-23.55' }),
    ).toThrow();
  });

  it('accepts update with both lat/lng as strings', () => {
    const dto = validateUpdatePlaca({
      latitude: '0',
      longitude: '0',
      coordenadas: '0,0',
    }) as any;

    expect(dto.latitude).toBe(0);
    expect(dto.longitude).toBe(0);
  });

  it('treats empty coordenadas string as absent on update', () => {
    const dto = validateUpdatePlaca({ coordenadas: '' }) as any;
    expect(dto.coordenadas).toBeUndefined();
  });

  it('strips commercial fields that must not contaminate coordinates', () => {
    const dto = validateUpdatePlaca({
      latitude: '-23.55',
      longitude: '-46.63',
      valor: 1000,
      contrato: 'CTR-001',
    }) as any;

    expect(dto.latitude).toBeCloseTo(-23.55);
    expect(dto.longitude).toBeCloseTo(-46.63);
    expect(dto.valor).toBeUndefined();
    expect(dto.contrato).toBeUndefined();
  });
});
