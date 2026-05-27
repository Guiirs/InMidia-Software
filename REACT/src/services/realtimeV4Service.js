import { API_V4_BASE_URL } from '../utils/config.js';
import { requestV4 } from './v4ServiceUtils.js';

export function getRealtimeV4Base() {
  return API_V4_BASE_URL;
}

export async function getRealtimeStreamToken() {
  const data = await requestV4('post', '/realtime/stream-token', {
    operation: 'realtime.stream-token.get',
  });
  return data?.token ?? null;
}
