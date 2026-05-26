import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createMockAuth } from '../../test/test-utils.jsx';

let authState;

vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }) => children,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../components/map/index.js', () => ({
  RegionManagerPanel: ({ onRegionSelect }) => (
    <div data-testid="region-manager-panel">RegionManagerPanel</div>
  ),
  V4OperationalMap: () => null,
  RegionSidebar: () => null,
  OpportunityMapPanel: () => null,
  RegionManager: () => null,
  RegionList: () => null,
  RegionSummaryCard: () => null,
  RegionPlateList: () => null,
}));

describe('RegionsPage integration surface', () => {
  beforeEach(() => {
    authState = createMockAuth({
      role: 'admin_empresa',
      permissions: [
        'inventory.read',
        'regions.read',
        'regions.create',
        'regions.update',
        'regions.archive',
        'regions.manage',
      ],
    });
  });

  it('nao importa mock, preview ou fetch direto', () => {
    const source = readFileSync(new URL('./RegionsPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/mapMockData|mockData|preview|apiClient|axios|fetch\s*\(|services\//i);
  });

  it('renderiza header com titulo Regioes', async () => {
    const { default: RegionsPage } = await import('./RegionsPage.jsx');
    const html = renderToString(
      <MemoryRouter>
        <RegionsPage />
      </MemoryRouter>,
    );
    expect(html).toContain('Regiões');
    expect(html).toContain('Gestão territorial');
    expect(html).toContain('Gerencie territórios');
  });

  it('renderiza botao Ver mapa', async () => {
    const { default: RegionsPage } = await import('./RegionsPage.jsx');
    const html = renderToString(
      <MemoryRouter>
        <RegionsPage />
      </MemoryRouter>,
    );
    expect(html).toContain('Ver mapa');
  });

  it('renderiza RegionManagerPanel para usuario com regions.read', async () => {
    const { default: RegionsPage } = await import('./RegionsPage.jsx');
    const html = renderToString(
      <MemoryRouter>
        <RegionsPage />
      </MemoryRouter>,
    );
    expect(html).toContain('RegionManagerPanel');
  });

  it('renderiza tela de acesso bloqueado para usuario sem regions.read', async () => {
    authState = createMockAuth({ role: 'operador', permissions: ['inventory.read'] });
    const { default: RegionsPage } = await import('./RegionsPage.jsx');
    const html = renderToString(
      <MemoryRouter>
        <RegionsPage />
      </MemoryRouter>,
    );
    expect(html).toContain('permissão para visualizar regiões');
    expect(html).not.toContain('RegionManagerPanel');
  });
});
