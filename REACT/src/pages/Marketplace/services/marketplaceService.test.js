import { describe, expect, it, vi } from 'vitest';
import apiClient from '../../../services/apiClient';
import {
  fetchMarketplaceModules,
  fetchMarketplaceCapabilities,
  activateMarketplaceCapability,
  deactivateMarketplaceCapability,
} from '../../../services/marketplaceService';

vi.mock('../../../services/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('marketplaceService', () => {
  it('calls modules endpoint', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { modules: [], summary: {} } });
    const result = await fetchMarketplaceModules();
    expect(apiClient.get).toHaveBeenCalledWith('/marketplace/modules');
    expect(result.modules).toEqual([]);
  });

  it('calls capabilities endpoint', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { capabilities: [], summary: {} } });
    const result = await fetchMarketplaceCapabilities();
    expect(apiClient.get).toHaveBeenCalledWith('/marketplace/capabilities');
    expect(result.capabilities).toEqual([]);
  });

  it('calls activate endpoint', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { success: true } });
    const result = await activateMarketplaceCapability({ capabilityId: 'enterprise-bi' });
    expect(apiClient.post).toHaveBeenCalledWith('/marketplace/activate', { capabilityId: 'enterprise-bi' });
    expect(result.success).toBe(true);
  });

  it('calls deactivate endpoint', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { success: true } });
    const result = await deactivateMarketplaceCapability({ capabilityId: 'enterprise-bi' });
    expect(apiClient.post).toHaveBeenCalledWith('/marketplace/deactivate', { capabilityId: 'enterprise-bi' });
    expect(result.success).toBe(true);
  });
});
