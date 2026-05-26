/**
 * Testes do features adapter — verifica estrutura, defaults e integração com a matriz canônica.
 */

import { featuresAdapter } from './features.adapter.js';
import { FEATURE_FLAGS_DEFAULTS } from '../../../services/featureFlagsService.js';

describe('features adapter', () => {
  it('tem domain features', () => {
    expect(featuresAdapter.domain).toBe('features');
  });

  it('tem resource features.flags', () => {
    const resource = featuresAdapter.resources.find((r) => r.key === 'features.flags');
    expect(resource).toBeDefined();
    expect(resource.key).toBe('features.flags');
  });

  it('features.flags não exige permissão', () => {
    const resource = featuresAdapter.resources.find((r) => r.key === 'features.flags');
    expect(resource.permissions).toEqual([]);
  });

  it('features.flags tem fallbackPolicy keep-last-valid', () => {
    const resource = featuresAdapter.resources.find((r) => r.key === 'features.flags');
    expect(resource.fallbackPolicy).toBe('keep-last-valid');
  });

  it('fallbackData contém todos os flags com valor false', () => {
    const resource = featuresAdapter.resources.find((r) => r.key === 'features.flags');
    expect(resource.fallbackData).toMatchObject({
      v4Painel:     false,
      v4Commercial: false,
      v4Reports:    false,
      v4Alerts:     false,
      v4Operations: false,
      syncDevtools: false,
    });
  });

  it('FEATURE_FLAGS_DEFAULTS contém todas as chaves esperadas', () => {
    const expectedKeys = ['v4Painel', 'v4Commercial', 'v4Reports', 'v4Alerts', 'v4Operations', 'syncDevtools'];
    for (const key of expectedKeys) {
      expect(Object.prototype.hasOwnProperty.call(FEATURE_FLAGS_DEFAULTS, key)).toBe(true);
      expect(FEATURE_FLAGS_DEFAULTS[key]).toBe(false);
    }
  });

  it('não tem mutations', () => {
    expect(featuresAdapter.mutations).toEqual([]);
  });

  it('TTL é de 5 minutos', () => {
    const resource = featuresAdapter.resources.find((r) => r.key === 'features.flags');
    expect(resource.ttlMs).toBe(5 * 60_000);
  });
});
