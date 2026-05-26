import apiClient from './apiClient';

const unwrapAuditList = (response) => ({
  data: Array.isArray(response?.data?.data) ? response.data.data : [],
  pagination: response?.data?.pagination || {},
});

export async function getAuditLogs(params = {}) {
  const response = await apiClient.get('/audit', { params });
  return unwrapAuditList(response);
}

export async function getAuditLogById(id) {
  const response = await apiClient.get(`/audit/${id}`);
  return response?.data?.data || null;
}

export async function getAuditLogsByEntity(entityType, entityId, params = {}) {
  const response = await apiClient.get(`/audit/entity/${entityType}/${entityId}`, { params });
  return unwrapAuditList(response);
}
