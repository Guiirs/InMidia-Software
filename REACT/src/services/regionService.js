import { requestV4 } from './v4ServiceUtils.js';

export async function listRegions(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.city) params.city = filters.city;
  if (filters.search) params.search = filters.search;
  return requestV4('GET', '/regions', { operation: 'listRegions', params });
}

export async function getRegion(id) {
  return requestV4('GET', `/regions/${id}`, { operation: 'getRegion' });
}

export async function getRegionSummary(id) {
  return requestV4('GET', `/regions/${id}/summary`, { operation: 'getRegionSummary' });
}

export async function getRegionPlates(id) {
  return requestV4('GET', `/regions/${id}/plates`, { operation: 'getRegionPlates' });
}

export async function getRegionOperations(id) {
  return requestV4('GET', `/regions/${id}/operations`, { operation: 'getRegionOperations' });
}

export async function getRegionAlerts(id) {
  return requestV4('GET', `/regions/${id}/alerts`, { operation: 'getRegionAlerts' });
}

export async function createRegion(payload) {
  return requestV4('POST', '/regions', { operation: 'createRegion', data: payload });
}

export async function updateRegion(id, payload) {
  return requestV4('PATCH', `/regions/${id}`, { operation: 'updateRegion', data: payload });
}

export async function archiveRegion(id) {
  return requestV4('POST', `/regions/${id}/archive`, { operation: 'archiveRegion' });
}

export async function attachPlateToRegion(regionId, plateId, regionalLot) {
  return requestV4('POST', `/regions/${regionId}/attach-plate`, {
    operation: 'attachPlateToRegion',
    data: { plateId, regionalLot },
  });
}

export async function detachPlateFromRegion(regionId, plateId) {
  return requestV4('POST', `/regions/${regionId}/detach-plate`, {
    operation: 'detachPlateFromRegion',
    data: { plateId },
  });
}

export async function migrateLegacyRegions() {
  return requestV4('POST', '/regions/migrate-legacy', { operation: 'migrateLegacyRegions' });
}
