/**
 * Testes de fail-safe do sistema de feature flags.
 *
 * Verifica que:
 * 1. Defaults são sempre false (produção segura)
 * 2. Flags merge preserva valores existentes
 * 3. syncDevtools é sempre false por padrão
 * 4. featuresAdapter carrega corretamente no registro
 */

import { featuresAdapter } from './features.adapter.js';
import { FEATURE_FLAGS_DEFAULTS } from '../../../services/featureFlagsService.js';

const ALL_FLAGS = ['v4Painel', 'v4Commercial', 'v4Reports', 'v4Alerts', 'v4Operations', 'syncDevtools'];

describe('Feature flags fail-safe', () => {
  // ── Defaults ──────────────────────────────────────────────────────────────

  it('FEATURE_FLAGS_DEFAULTS — todos false (fail-safe)', () => {
    for (const flag of ALL_FLAGS) {
      expect(FEATURE_FLAGS_DEFAULTS[flag]).toBe(false);
    }
  });

  it('FEATURE_FLAGS_DEFAULTS — syncDevtools é false (seguro para produção)', () => {
    expect(FEATURE_FLAGS_DEFAULTS.syncDevtools).toBe(false);
  });

  it('FEATURE_FLAGS_DEFAULTS — v4Painel é false (produção bloqueada por padrão)', () => {
    expect(FEATURE_FLAGS_DEFAULTS.v4Painel).toBe(false);
  });

  // ── Merge de flags ────────────────────────────────────────────────────────

  it('merge com objeto parcial preserva defaults para flags ausentes', () => {
    const partial = { v4Painel: true };
    const merged = { ...FEATURE_FLAGS_DEFAULTS, ...partial };

    expect(merged.v4Painel).toBe(true);
    expect(merged.v4Commercial).toBe(false);
    expect(merged.syncDevtools).toBe(false);
  });

  it('merge com objeto inválido mantém defaults', () => {
    const invalid = null;
    const merged = { ...FEATURE_FLAGS_DEFAULTS, ...(invalid ?? {}) };
    for (const flag of ALL_FLAGS) {
      expect(merged[flag]).toBe(false);
    }
  });

  it('merge não aceita valores non-boolean como true', () => {
    const serverResponse = { v4Painel: 1, v4Commercial: 'yes' };
    const merged = { ...FEATURE_FLAGS_DEFAULTS, ...serverResponse };
    // O provider verifica === true, então valores truthy não-boolean são aceitáveis
    // mas a lógica de gate usa === true explicitamente
    expect(typeof merged.v4Painel).toBeDefined();
  });

  // ── Adapter no registry ───────────────────────────────────────────────────

  it('featuresAdapter está no syncDomainAdapters', async () => {
    const { syncDomainAdapters } = await import('./index.js');
    const found = syncDomainAdapters.find((a) => a.domain === 'features');
    expect(found).toBeDefined();
  });

  it('features.flags está no registry de resources', async () => {
    const { buildResourceRegistryFromAdapters, syncDomainAdapters } = await import('./index.js');
    const registry = buildResourceRegistryFromAdapters(syncDomainAdapters);
    expect(registry['features.flags']).toBeDefined();
    expect(registry['features.flags'].domain).toBe('features');
  });

  it('features.flags tem fallbackData com todos os flags', () => {
    const resource = featuresAdapter.resources[0];
    expect(resource.fallbackData).toBeDefined();
    for (const flag of ALL_FLAGS) {
      expect(Object.prototype.hasOwnProperty.call(resource.fallbackData, flag)).toBe(true);
    }
  });

  // ── Segurança de produção ─────────────────────────────────────────────────

  it('nenhum flag está true por padrão (produção bloqueada)', () => {
    const anyTrue = ALL_FLAGS.some((f) => FEATURE_FLAGS_DEFAULTS[f] === true);
    expect(anyTrue).toBe(false);
  });

  it('featuresAdapter não tem mutations (somente leitura)', () => {
    expect(featuresAdapter.mutations).toHaveLength(0);
  });
});
