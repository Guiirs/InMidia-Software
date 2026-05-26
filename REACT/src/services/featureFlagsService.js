import apiClient from './apiClient.js';
import { v4Base, dataOf } from './v4ServiceUtils.js';

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
  const res = await apiClient.get(v4Base('/features'));
  const data = dataOf(res);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...FEATURE_FLAGS_DEFAULTS, ...data };
  }
  return { ...FEATURE_FLAGS_DEFAULTS };
}
