import { requestV4 } from './v4ServiceUtils.js';

/**
 * Busca as feature flags do tenant autenticado.
 * Falha silenciosa: em caso de erro retorna todos os flags false (fail-safe).
 */
export const FEATURE_FLAGS_DEFAULTS = {
  v4Painel:     false,
  v4Commercial: false,
  v4Reports:    false,
  v4Alerts:     false,
  v4Operations: false,
  syncDevtools: false,
};

export async function getFeatureFlags() {
  const data = await requestV4('get', '/features', {
    operation: 'features.flags.read',
  });
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...FEATURE_FLAGS_DEFAULTS, ...data };
  }
  return { ...FEATURE_FLAGS_DEFAULTS };
}
