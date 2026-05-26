import apiClient from './apiClient';

const BASE = '/enterprise-bi';

function unwrap(response) {
  return response?.data ?? {};
}

/**
 * GET /api/v1/enterprise-bi/snapshot
 * Returns the latest BI snapshot summary, or null if none available.
 */
export async function fetchBISnapshot() {
  const response = await apiClient.get(`${BASE}/snapshot`);
  const body = unwrap(response);
  if (body.empty) return { snapshot: null, empty: true, message: body.message };
  return { snapshot: body.data, empty: false, message: null };
}

/**
 * GET /api/v1/enterprise-bi/datasets/executive
 */
export async function fetchExecutiveDataset() {
  const response = await apiClient.get(`${BASE}/datasets/executive`);
  const body = unwrap(response);
  if (body.empty) return { dataset: null, empty: true, snapshotId: null };
  return { dataset: body.data, empty: false, snapshotId: body.snapshotId };
}

/**
 * GET /api/v1/enterprise-bi/datasets/regional
 */
export async function fetchRegionalDataset() {
  const response = await apiClient.get(`${BASE}/datasets/regional`);
  const body = unwrap(response);
  if (body.empty) return { dataset: null, empty: true, snapshotId: null };
  return { dataset: body.data, empty: false, snapshotId: body.snapshotId };
}

/**
 * GET /api/v1/enterprise-bi/datasets/inventory
 */
export async function fetchInventoryDataset() {
  const response = await apiClient.get(`${BASE}/datasets/inventory`);
  const body = unwrap(response);
  if (body.empty) return { dataset: null, empty: true, snapshotId: null };
  return { dataset: body.data, empty: false, snapshotId: body.snapshotId };
}

/**
 * GET /api/v1/enterprise-bi/datasets/quality
 */
export async function fetchQualityDataset() {
  const response = await apiClient.get(`${BASE}/datasets/quality`);
  const body = unwrap(response);
  if (body.empty) return { dataset: null, empty: true, snapshotId: null };
  return { dataset: body.data, empty: false, snapshotId: body.snapshotId };
}

/**
 * GET /api/v1/enterprise-bi/datasets/governance
 */
export async function fetchGovernanceDataset() {
  const response = await apiClient.get(`${BASE}/datasets/governance`);
  const body = unwrap(response);
  if (body.empty) return { dataset: null, empty: true, snapshotId: null };
  return { dataset: body.data, empty: false, snapshotId: body.snapshotId };
}
