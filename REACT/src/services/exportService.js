import apiClient from './apiClient';

const BASE = '/exports';

/**
 * POST /api/v1/exports
 * Triggers an export build for the given profile + format.
 */
export async function createExport({ profile, format, label, maxRows }) {
  const response = await apiClient.post(BASE, { profile, format, label, maxRows });
  return response?.data ?? {};
}

/**
 * GET /api/v1/exports/profiles
 * Returns available export profiles and their supported formats.
 */
export async function fetchExportProfiles() {
  const response = await apiClient.get(`${BASE}/profiles`);
  return response?.data ?? { profiles: [], blockedFields: [] };
}

/**
 * GET /api/v1/exports/:id/status
 */
export async function fetchExportStatus(exportId) {
  const response = await apiClient.get(`${BASE}/${exportId}/status`);
  return response?.data ?? {};
}
