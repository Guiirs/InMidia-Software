import {
  isPlateNameDuplicateKeyError,
  normalizePlateName,
} from './plate-name.utils';

describe('plate-name.utils', () => {
  it('normaliza caixa, acentos e espacos do numero da placa', () => {
    expect(normalizePlateName('  Pláca   São  07 ')).toBe('placa sao 07');
  });

  it('identifica 11000 do indice normalizado e do indice legado', () => {
    expect(isPlateNameDuplicateKeyError({
      code: 11000,
      keyPattern: { empresaId: 1, numeroPlacaNormalizado: 1 },
    })).toBe(true);
    expect(isPlateNameDuplicateKeyError({
      code: 11000,
      message: 'dup key idx_placa_numero_empresa_unique',
    })).toBe(true);
  });

  it('nao trata outro indice unico como conflito de placa', () => {
    expect(isPlateNameDuplicateKeyError({
      code: 11000,
      keyPattern: { empresaId: 1, numeroOperacional: 1 },
    })).toBe(false);
  });
});
