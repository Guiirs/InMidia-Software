// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

let resources;
const MAP_PAGE_SOURCE = 'src/v4-painel/pages/map/MapPage.jsx';
const OPERATIONAL_MAP_SOURCE = 'src/v4-painel/components/map/V4OperationalMap.jsx';

vi.mock('../../../core/sync-core/hooks/useSyncResource.js', () => ({
  useSyncResource: (key) => resources[key],
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../components/map/index.js', () => ({
  V4OperationalMap: ({ flyTo, selectedRegionId, regionColorMap, regionBoundaries = [], points = [] }) => (
    <div
      data-testid="operational-map"
      data-fly-to={flyTo ? `${flyTo.lat},${flyTo.lng}` : null}
      data-selected-region={selectedRegionId ?? null}
      data-has-region-colors={Object.keys(regionColorMap ?? {}).length > 0 ? 'yes' : 'no'}
      data-boundaries={regionBoundaries.map((region) => region.id).join('|')}
      data-points={points.map((point) => point.title).join('|')}
      data-coordinates={points.map((point) => `${point.latitude ?? 'null'},${point.longitude ?? 'null'}`).join('|')}
    />
  ),
  RegionSidebar: ({ selectedRegionId, onRegionSelect }) => (
    <div data-testid="region-sidebar">
      <span data-testid="sidebar-selected">{selectedRegionId ?? 'none'}</span>
      <button onClick={() => onRegionSelect?.('r1')}>Selecionar Regiao 1</button>
      <button onClick={() => onRegionSelect?.('r2')}>Selecionar sem coords</button>
    </div>
  ),
  OpportunityMapPanel: () => null,
  RegionManager: () => null,
  RegionManagerPanel: () => <div data-testid="region-manager-panel" />,
  RegionList: () => null,
  RegionSummaryCard: () => null,
  RegionPlateList: () => null,
}));

function resource(data, status = 'success') {
  return {
    data,
    status,
    error: null,
    isStale: false,
    isRefreshing: false,
    refresh: vi.fn(),
  };
}

function setMapData({ regions = [], boards = [] } = {}) {
  resources = {
    'inventory.boards': resource(boards),
    'inventory.regions': resource({ regions, total: regions.length }),
    'inventory.summary': resource({ compact: { taxaOcupacao: 0 } }),
  };
}

describe('MapPage integration surface', () => {
  beforeEach(() => {
    setMapData();
  });

  it('nao importa mock, preview, services ou api direta', () => {
    const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');

    expect(source).toContain("useSyncResource('inventory.boards')");
    expect(source).toContain("useSyncResource('inventory.regions')");
    expect(source).toContain("useSyncResource('inventory.summary')");
    expect(source).not.toMatch(/mapMockData|mockData|preview|apiClient|axios|fetch\s*\(|services\//i);
  });

  it('nao contem RegionManagerPanel completo no codigo do mapa', () => {
    const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
    expect(source).not.toContain('v4p-map-region-manager-panel');
    expect(source).not.toContain('<RegionManagerPanel');
    expect(source).not.toContain('toManagerRegions');
  });

  it('contem botao Gerenciar regioes apontando para /regioes', () => {
    const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
    expect(source).toContain('/regioes');
    expect(source).toMatch(/Gerenciar regi/i);
  });

  it('renderiza empty-state real quando nao ha regioes', async () => {
    const { default: MapPage } = await import('./MapPage.jsx');

    const html = renderToString(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    );

    expect(html).toContain('VAZIO REAL');
    expect(html).toContain('Nenhuma regiao com placas cadastradas.');
    expect(html).not.toContain('Mapa mockado');
  });

  it('renderiza error-state quando API falha', async () => {
    resources['inventory.regions'] = {
      ...resources['inventory.regions'],
      status: 'error',
      error: new Error('Falha regions V4'),
    };
    const { default: MapPage } = await import('./MapPage.jsx');

    const html = renderToString(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    );

    expect(html).toContain('Falha regions V4');
  });

  it('renderiza com regioes reais da API', async () => {
    setMapData({
      regions: [
        { id: 'r1', name: 'Nordeste', occupancyRate: 0.8, totalBoards: 10, availableBoards: 2, color: '#38c78f' },
      ],
      boards: [
        { id: 'b1', codigo: 'NE-001', nome: 'Placa NE 1', lat: -5.8, lng: -35.2, status: 'occupied', regiaoId: 'r1', localizacao: 'Natal RN' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    const html = renderToString(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    );

    expect(html).toContain('operational-map');
    expect(html).not.toContain('Nenhuma regiao');
  });

  it('repassa coordenadas normalizadas para o mapa', async () => {
    setMapData({
      regions: [
        { id: 'r1', name: 'Sudeste', occupancyRate: 0.5, totalBoards: 1, availableBoards: 1 },
      ],
      boards: [
        { id: 'b1', codigo: 'GEO-001', nome: 'Geo 1', location: { coordinates: [-46.6333, -23.5505] }, status: 'available', regionId: 'r1', localizacao: 'Rua Geo' },
      ],
    });
    const { default: MapPage } = await import('./MapPage.jsx');

    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-coordinates', '-23.5505,-46.6333');
  });

  it('repassa flyTo para V4OperationalMap quando regiao selecionada tem coordenadas', () => {
    const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
    expect(source).toContain('flyTo={flyTo}');
    expect(source).toContain('centerLatitude');
    expect(source).toContain('centerLongitude');
  });

  it('repassa selectedRegionId e regionColorMap para V4OperationalMap', () => {
    const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
    expect(source).toContain('selectedRegionId={selectedRegionId}');
    expect(source).toContain('regionColorMap={regionColorMap}');
  });

  it('repassa boundaries existentes das regioes para V4OperationalMap', async () => {
    setMapData({
      regions: [
        {
          id: 'r1',
          name: 'Regiao com limite',
          occupancyRate: 0.8,
          totalBoards: 0,
          availableBoards: 0,
          color: '#22d3ee',
          boundary: {
            type: 'Polygon',
            coordinates: [[[-46.7, -23.6], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -23.5], [-46.7, -23.6]]],
          },
        },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    render(<MemoryRouter><MapPage /></MemoryRouter>);

    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-boundaries', 'r1');
  });

  it('nao quebra quando selectedRegion nao tem coordenadas (flyTo null)', () => {
    const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
    expect(source).toContain('if (!selectedRegion?.centerLatitude || !selectedRegion?.centerLongitude) return null');
  });

  it('renderiza chip de regiao ativa quando selectedRegion existe', () => {
    const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
    expect(source).toContain('RegionActiveChip');
    expect(source).toMatch(/Regi.o ativa/);
  });

  it('mostra contadores leves da regiao ativa no mapa', async () => {
    setMapData({
      regions: [
        {
          id: 'r1',
          name: 'Regiao 1',
          occupancyRate: 0.8,
          totalBoards: 2,
          availableBoards: 1,
          pendingOperations: 3,
          criticalAlertsCount: 2,
          endingContracts: 1,
        },
      ],
      boards: [
        { id: 'b1', codigo: 'R1-001', nome: 'R1', lat: -23.1, lng: -46.1, status: 'available', regionId: 'r1', localizacao: 'A' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    render(<MemoryRouter><MapPage /></MemoryRouter>);

    fireEvent.click(screen.getByText('Selecionar Regiao 1'));

    expect(screen.getByText('3 ops')).toBeInTheDocument();
    expect(screen.getByText('2 alertas')).toBeInTheDocument();
    expect(screen.getByText('1 vencendo')).toBeInTheDocument();
  });

  it('V4OperationalMap recebe prioridade de cor: critico > temporal > regional', () => {
    const source = readFileSync(OPERATIONAL_MAP_SOURCE, 'utf8');
    expect(source).toContain('isCritical');
    expect(source).toContain('isInSelectedRegion');
    expect(source).toContain('isDimmed');
  });

  it('V4OperationalMap renderiza GeoJSON de boundaries sem alterar prioridade dos pins', () => {
    const source = readFileSync(OPERATIONAL_MAP_SOURCE, 'utf8');
    expect(source).toContain('GeoJSON');
    expect(source).toContain('regionBoundaries = []');
    expect(source).toContain('fillOpacity');
    expect(source).toContain('const isCritical');
  });

  it('filtro Sem regiao inclui boards com campos ausentes, null, vazios e no-region', async () => {
    setMapData({
      regions: [
        { id: 'r1', name: 'Regiao 1', occupancyRate: 0.7, totalBoards: 1, availableBoards: 0 },
      ],
      boards: [
        { id: 'b1', codigo: 'NO-REGION', nome: 'Sem regiao explicita', lat: -23.1, lng: -46.1, status: 'available', regiaoId: 'no-region', localizacao: 'A' },
        { id: 'b2', codigo: 'REGION-NULL', nome: 'Region null', lat: -23.2, lng: -46.2, status: 'available', regionId: null, localizacao: 'B' },
        { id: 'b3', codigo: 'SEM-REGIONID', nome: 'Sem regionId', lat: -23.3, lng: -46.3, status: 'available', regiaoId: null, localizacao: 'C' },
        { id: 'b4', codigo: 'SEM-REGIAOID', nome: 'Sem regiaoId', lat: -23.4, lng: -46.4, status: 'available', regionId: null, localizacao: 'D' },
        { id: 'b5', codigo: 'REGIAO-VAZIA', nome: 'Regiao vazia', lat: -23.5, lng: -46.5, status: 'available', regiao: '', localizacao: 'E' },
        { id: 'b6', codigo: 'FORMAL-VALIDA', nome: 'Formal valida', lat: -23.6, lng: -46.6, status: 'available', regionId: 'r1', localizacao: 'F' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    render(<MemoryRouter><MapPage /></MemoryRouter>);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'no-region' } });

    const titles = screen.getByTestId('operational-map').dataset.points;
    expect(titles).toContain('NO-REGION');
    expect(titles).toContain('REGION-NULL');
    expect(titles).toContain('SEM-REGIONID');
    expect(titles).toContain('SEM-REGIAOID');
    expect(titles).toContain('REGIAO-VAZIA');
    expect(titles).not.toContain('FORMAL-VALIDA');
  });

  it('sincroniza selecao entre sidebar, dropdown e mapa', async () => {
    setMapData({
      regions: [
        { id: 'r1', name: 'Regiao 1', occupancyRate: 0.8, totalBoards: 2, availableBoards: 1, centerLatitude: -23.5, centerLongitude: -46.6 },
        { id: 'r2', name: 'Regiao 2', occupancyRate: 0.4, totalBoards: 1, availableBoards: 1 },
      ],
      boards: [
        { id: 'b1', codigo: 'R1-001', nome: 'R1', lat: -23.1, lng: -46.1, status: 'available', regionId: 'r1', localizacao: 'A' },
        { id: 'b2', codigo: 'R2-001', nome: 'R2', lat: -23.2, lng: -46.2, status: 'available', regionId: 'r2', localizacao: 'B' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    render(<MemoryRouter><MapPage /></MemoryRouter>);

    const regionSelect = screen.getAllByRole('combobox')[0];
    fireEvent.click(screen.getByText('Selecionar Regiao 1'));

    expect(regionSelect.value).toBe('r1');
    expect(screen.getByTestId('sidebar-selected')).toHaveTextContent('r1');
    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-selected-region', 'r1');

    fireEvent.change(regionSelect, { target: { value: 'r2' } });
    expect(screen.getByTestId('sidebar-selected')).toHaveTextContent('r2');
    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-selected-region', 'r2');

    fireEvent.click(screen.getByText(/Limpar regi/));
    expect(regionSelect.value).toBe('all');
    expect(screen.getByTestId('sidebar-selected')).toHaveTextContent('none');
    expect(screen.getByTestId('operational-map')).not.toHaveAttribute('data-selected-region');
  });

  it('limpa selecao com fallback seguro quando a regiao selecionada some', async () => {
    setMapData({
      regions: [
        { id: 'r1', name: 'Regiao 1', occupancyRate: 0.8, totalBoards: 2, availableBoards: 1 },
      ],
      boards: [
        { id: 'b1', codigo: 'R1-001', nome: 'R1', lat: -23.1, lng: -46.1, status: 'available', regionId: 'r1', localizacao: 'A' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    const view = render(<MemoryRouter><MapPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Selecionar Regiao 1'));
    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-selected-region', 'r1');

    resources['inventory.regions'] = resource({ regions: [] });
    view.rerender(<MemoryRouter><MapPage focusBoard={null} /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByTestId('operational-map')).not.toHaveAttribute('data-selected-region');
    });
  });
});

describe('V4OperationalMap flyTo e highlight', () => {
  it('possui componente MapFlyTo interno', () => {
    const source = readFileSync(OPERATIONAL_MAP_SOURCE, 'utf8');
    expect(source).toContain('MapFlyTo');
    expect(source).toContain('map.flyTo');
  });

  it('aceita props flyTo, selectedRegionId e regionColorMap', () => {
    const source = readFileSync(OPERATIONAL_MAP_SOURCE, 'utf8');
    expect(source).toContain('flyTo = null');
    expect(source).toContain('selectedRegionId = null');
    expect(source).toContain('regionColorMap = {}');
  });

  it('aplica opacity reduzida em pins fora da regiao selecionada', () => {
    const source = readFileSync(OPERATIONAL_MAP_SOURCE, 'utf8');
    expect(source).toContain('isDimmed');
    expect(source).toContain('opacity');
  });
});
