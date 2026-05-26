import apiClient from './apiClient';

const BASE = '/marketplace';

function unwrap(response) {
  return response?.data ?? {};
}

export async function fetchMarketplaceModules() {
  const response = await apiClient.get(`${BASE}/modules`);
  return unwrap(response);
}

export async function fetchMarketplaceCapabilities() {
  const response = await apiClient.get(`${BASE}/capabilities`);
  return unwrap(response);
}

export async function activateMarketplaceCapability(payload) {
  const response = await apiClient.post(`${BASE}/activate`, payload);
  return unwrap(response);
}

export async function deactivateMarketplaceCapability(payload) {
  const response = await apiClient.post(`${BASE}/deactivate`, payload);
  return unwrap(response);
}
