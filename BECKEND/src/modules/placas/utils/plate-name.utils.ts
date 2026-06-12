export const PLATE_NAME_CONFLICT_CODE = 'PLATE_NAME_CONFLICT';
export const PLATE_NAME_CONFLICT_FIELD = 'numero_placa';
export const PLATE_NAME_CONFLICT_MESSAGE = 'Já existe uma placa cadastrada com esse nome.';
export const PLATE_NORMALIZED_NAME_INDEX = 'idx_placa_nome_normalizado_empresa_unique';

export function normalizePlateName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function isMongoDuplicateKeyError(error: unknown): error is {
  code: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
  index?: string;
  message?: string;
} {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
}

export function isPlateNameDuplicateKeyError(error: unknown): boolean {
  if (!isMongoDuplicateKeyError(error)) return false;

  const fields = [
    ...Object.keys(error.keyPattern ?? {}),
    ...Object.keys(error.keyValue ?? {}),
  ];
  const details = `${error.index ?? ''} ${error.message ?? ''}`;

  return fields.includes('numeroPlacaNormalizado')
    || fields.includes('numero_placa')
    || details.includes(PLATE_NORMALIZED_NAME_INDEX)
    || details.includes('idx_placa_numero_empresa_unique');
}
