import { describe, expect, it } from 'vitest';
import { getPlateErrorMessage, PLATE_NAME_CONFLICT_MESSAGE } from './plateErrorMessages.js';

describe('plateErrorMessages', () => {
  it('traduz PLATE_NAME_CONFLICT nos formatos estruturados da API', () => {
    expect(getPlateErrorMessage({ code: 'PLATE_NAME_CONFLICT' })).toBe(PLATE_NAME_CONFLICT_MESSAGE);
    expect(getPlateErrorMessage({
      response: { data: { error: { code: 'PLATE_NAME_CONFLICT' } } },
    })).toBe(PLATE_NAME_CONFLICT_MESSAGE);
  });

  it('preserva fallback para erros desconhecidos', () => {
    expect(getPlateErrorMessage({}, 'Falha')).toBe('Falha');
  });
});
