import { requestV4 } from './v4ServiceUtils.js';

export async function getSystemReadiness() {
  const data = await requestV4('get', '/system/readiness', {
    operation: 'system.readiness.read',
  });
  return data ?? {};
}
