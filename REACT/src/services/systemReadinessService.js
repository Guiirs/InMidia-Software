import apiClient from './apiClient.js';
import { v4Base, dataOf } from './v4ServiceUtils.js';

export async function getSystemReadiness() {
  const res = await apiClient.get(v4Base('/system/readiness'));
  return dataOf(res) ?? {};
}
