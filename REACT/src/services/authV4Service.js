import { requestV4 } from './v4ServiceUtils.js';

export async function getAuthSession() {
  return requestV4('get', '/auth/session', {
    operation: 'auth.session.read',
  });
}
