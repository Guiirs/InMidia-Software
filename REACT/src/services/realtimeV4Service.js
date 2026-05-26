import apiClient from './apiClient.js';
import { API_BASE_URL } from '../utils/config.js';

export function getRealtimeV4Base() {
  return API_BASE_URL
    .replace(/\/api\/v\d+$/i, '/api/v4')
    .replace(/\/api$/i, '/api/v4');
}

export async function getRealtimeStreamToken() {
  const response = await apiClient.post(`${getRealtimeV4Base()}/realtime/stream-token`);
  return response?.data?.data?.token ?? null;
}
