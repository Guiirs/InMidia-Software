export const PLATE_NAME_CONFLICT_MESSAGE = 'Já existe uma placa cadastrada com esse nome.';

export function getPlateErrorMessage(error, fallback = 'Não foi possível salvar a placa no servidor.') {
  const data = error?.response?.data;
  const code = error?.code ?? data?.error?.code ?? data?.code ?? null;
  if (code === 'PLATE_NAME_CONFLICT') return PLATE_NAME_CONFLICT_MESSAGE;
  return error?.message ?? fallback;
}
