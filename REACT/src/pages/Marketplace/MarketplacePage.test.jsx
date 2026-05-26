import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import MarketplacePage from './MarketplacePage';
import CapabilityCard from './components/CapabilityCard';
import CapabilityStatusBadge from './components/CapabilityStatusBadge';
import CapabilityDependencyList from './components/CapabilityDependencyList';
import MarketplaceEmptyState from './components/MarketplaceEmptyState';
import MarketplaceErrorState from './components/MarketplaceErrorState';
import { fetchMarketplaceCapabilities, fetchMarketplaceModules, activateMarketplaceCapability, deactivateMarketplaceCapability } from '../../services/marketplaceService';

const mockMarketplaceHook = vi.fn();

vi.mock('./hooks/useMarketplace', () => ({
  useMarketplace: () => mockMarketplaceHook(),
}));

vi.mock('../../services/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('MarketplacePage', () => {
  it('renders marketplace data', () => {
    mockMarketplaceHook.mockReturnValueOnce({
      isLoading: false,
      hasError: false,
      firstError: null,
      modules: [{ id: 'analytics-suite', name: 'Analytics Suite', description: 'BI layer', category: 'analytics', status: 'available', activeCapabilities: 1, availableCapabilities: 2 }],
      capabilities: [{ id: 'enterprise-bi', name: 'Enterprise BI', description: 'BI base', category: 'analytics', status: 'available', active: true, canActivate: false, dependencies: [], requirements: ['tenant-context'], scopes: ['admin.access'], warnings: [], blockers: [], missingDependencies: [] }],
      summary: { visibleModules: 1, visibleCapabilities: 1, activeCapabilities: 1 },
      activateCapability: vi.fn(),
      deactivateCapability: vi.fn(),
      isMutating: false,
    });

    const html = renderToString(<MarketplacePage />);
    expect(html).toContain('Marketplace');
    expect(html).toContain('Analytics Suite');
    expect(html).toContain('Enterprise BI');
  });

  it('renders empty state', () => {
    mockMarketplaceHook.mockReturnValueOnce({
      isLoading: false,
      hasError: false,
      firstError: null,
      modules: [],
      capabilities: [],
      summary: null,
      activateCapability: vi.fn(),
      deactivateCapability: vi.fn(),
      isMutating: false,
    });

    const html = renderToString(<MarketplacePage />);
    expect(html).toContain('Nenhuma capability disponivel');
  });

  it('renders error state', () => {
    mockMarketplaceHook.mockReturnValueOnce({
      isLoading: false,
      hasError: true,
      firstError: new Error('boom'),
      modules: [],
      capabilities: [],
      summary: null,
      activateCapability: vi.fn(),
      deactivateCapability: vi.fn(),
      isMutating: false,
    });

    const html = renderToString(<MarketplacePage />);
    expect(html).toContain('Erro no Marketplace');
    expect(html).toContain('boom');
  });
});

describe('Marketplace components', () => {
  it('renders capability card with actions', () => {
    const capability = {
      id: 'realtime-streams',
      name: 'Realtime Streams',
      description: 'Streams em tempo real',
      category: 'realtime',
      status: 'beta',
      active: false,
      canActivate: true,
      dependencies: [{ capabilityId: 'public-api-bridge' }],
      requirements: ['tenant-context'],
      scopes: ['admin.access'],
      warnings: ['beta'],
      blockers: [],
      missingDependencies: ['public-api-bridge'],
    };

    const html = renderToString(<CapabilityCard capability={capability} onActivate={vi.fn()} onDeactivate={vi.fn()} />);
    expect(html).toContain('Realtime Streams');
    expect(html).toContain('Ativar');
    expect(html).toContain('Desativar');
  });

  it('renders status badge', () => {
    const html = renderToString(<CapabilityStatusBadge status="beta" active={false} />);
    expect(html).toContain('Beta');
  });

  it('renders dependency list', () => {
    const html = renderToString(<CapabilityDependencyList dependencies={[{ capabilityId: 'enterprise-bi' }]} missingDependencies={['enterprise-bi']} />);
    expect(html).toContain('enterprise-bi');
  });

  it('renders empty state component', () => {
    const html = renderToString(<MarketplaceEmptyState />);
    expect(html).toContain('Nenhuma capability disponivel');
  });

  it('renders error state component', () => {
    const html = renderToString(<MarketplaceErrorState error={new Error('boom')} />);
    expect(html).toContain('boom');
  });
});

describe('marketplaceService functions', () => {
  it('exports callable fetch functions', () => {
    expect(typeof fetchMarketplaceModules).toBe('function');
    expect(typeof fetchMarketplaceCapabilities).toBe('function');
    expect(typeof activateMarketplaceCapability).toBe('function');
    expect(typeof deactivateMarketplaceCapability).toBe('function');
  });
});
