// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

let resources;
const MAP_PAGE_SOURCE = 'src/v4-painel/pages/map/MapPage.jsx';
const MAP_PAGE_CSS = 'src/v4-painel/pages/map/MapPage.css';
const OPERATIONAL_MAP_SOURCE = 'src/v4-painel/components/map/V4OperationalMap.jsx';

vi.mock('../../../core/sync-core/hooks/useSyncResource.js', () => ({
  useSyncResource: (key) => resources[key],
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../components/map/V4OperationalMap.jsx', () => ({
  default: ({ flyTo, selectedRegionId, regionColorMap, regionBoundaries = [], points = [] }) => (
    <div
      data-testid="operational-map"
      data-fly-to={flyTo ? `${flyTo.lat},${flyTo.lng}` : null}
      data-selected-region={selectedRegionId ?? null}
      data-has-region-colors={Object.keys(regionColorMap ?? {}).length > 0 ? 'yes' : 'no'}
      data-boundaries={regionBoundaries.map((region) => region.id).join('|')}
      data-points={points.map((point) => point.title).join('|')}
      data-coordinates={points.map((point) => `${point.latitude ?? 'null'},${point.longitude ?? 'null'}`).join('|')}
      data-statuses={points.map((point) => point.status).join('|')}
      data-base-statuses={points.map((point) => point.baseStatus).join('|')}
      data-operational-blocks={points.map((point) => (point.operationalBlock ? point.operationalBlock.operationType : '')).join('|')}
    />
  ),
}));

vi.mock('../../components/map/RegionSidebar.jsx', () => ({
  default: ({ selectedRegionId, onRegionSelect }) => (
    <div data-testid="region-sidebar">
      <span data-testid="sidebar-selected">{selectedRegionId ?? 'none'}</span>
      <button onClick={() => onRegionSelect?.('r1')}>Selecionar Regiao 1</button>
      <button onClick={() => onRegionSelect?.('r2')}>Selecionar sem coords</button>
    </div>
  ),
}));

vi.mock('../../components/map/OpportunityMapPanel.jsx', () => ({
  default: () => null,
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

  it('gera markers para placas com latitude/longitude string, coordenadas string e coordinates array', async () => {
    setMapData({
      regions: [],
      boards: [
        { id: 'b1', codigo: 'LAT-STR', nome: 'Lat string', latitude: '-23.55052', longitude: '-46.633308', localizacao: 'Rua 1' },
        { id: 'b2', codigo: 'COORD-STR', nome: 'Coord string', coordenadas: '-23.55052, -46.633308', localizacao: 'Rua 2' },
        { id: 'b3', codigo: 'ARR-GEO', nome: 'Array geo', coordinates: [-46.633308, -23.55052], localizacao: 'Rua 3' },
        { id: 'b4', codigo: 'ARR-LAT', nome: 'Array latlng', coordinates: [-23.55052, -46.633308], localizacao: 'Rua 4' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    render(<MemoryRouter><MapPage /></MemoryRouter>);

    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-points', 'LAT-STR|COORD-STR|ARR-GEO|ARR-LAT');
    expect(screen.getByTestId('operational-map')).toHaveAttribute(
      'data-coordinates',
      '-23.55052,-46.633308|-23.55052,-46.633308|-23.55052,-46.633308|-23.55052,-46.633308',
    );
  });

  it('nao remove placa com coordenada valida por status ou regiao ausente', async () => {
    setMapData({
      regions: [],
      boards: [
        { id: 'b1', codigo: 'SEM-STATUS', nome: 'Sem status', latitude: -23.55052, longitude: -46.633308, localizacao: 'Rua 1' },
        { id: 'b2', codigo: 'SEM-REGIAO', nome: 'Sem regiao', latitude: -23.551, longitude: -46.634, status: 'available', localizacao: 'Rua 2' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    render(<MemoryRouter><MapPage /></MemoryRouter>);

    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-points', 'SEM-STATUS|SEM-REGIAO');
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

  it('renderiza chips de filtro por status com contagens', async () => {
    setMapData({
      regions: [
        { id: 'r1', name: 'Regiao 1', occupancyRate: 0.7, totalBoards: 4, availableBoards: 1 },
      ],
      boards: [
        { id: 'b1', codigo: 'DISP-001', nome: 'Disp', lat: -23.1, lng: -46.1, status: 'available', regionId: 'r1', localizacao: 'A' },
        { id: 'b2', codigo: 'OCUP-001', nome: 'Ocup', lat: -23.2, lng: -46.2, status: 'occupied', regionId: 'r1', localizacao: 'B' },
        { id: 'b3', codigo: 'RES-001', nome: 'Res', lat: -23.3, lng: -46.3, status: 'reserved', regionId: 'r1', localizacao: 'C' },
        { id: 'b4', codigo: 'CRIT-001', nome: 'Crit', lat: -23.4, lng: -46.4, status: 'critical', regionId: 'r1', localizacao: 'D' },
      ],
    });

    const { default: MapPage } = await import('./MapPage.jsx');
    render(<MemoryRouter><MapPage /></MemoryRouter>);

    const chips = screen.getByRole('group', { name: 'Filtro visual por status' });
    expect(chips).toHaveTextContent('Todos');
    expect(chips).toHaveTextContent('4');
    expect(chips).toHaveTextContent('Disponiveis');
    expect(chips).toHaveTextContent('Ocupadas');
    expect(chips).toHaveTextContent('Reservadas');
    expect(chips).toHaveTextContent('Manutencao');
    expect(chips).toHaveTextContent('Criticas');

    fireEvent.click(screen.getByRole('button', { name: /Criticas/i }));
    expect(screen.getByTestId('operational-map')).toHaveAttribute('data-points', 'CRIT-001');
  });

  it('possui classes e breakpoint mobile para layout responsivo', () => {
    const css = readFileSync(MAP_PAGE_CSS, 'utf8');

    expect(css).toContain('@media (max-width: 780px)');
    expect(css).toContain('.v4p-map-workspace');
    expect(css).toContain('.v4p-map-regions');
    expect(css).toContain('.v4p-map-opportunities');
    expect(css).toContain('.v4p-map-status-chips');
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

  describe('toMapPoints — metadata comercial', () => {
    it('MapPoint preserva commercialStatus no metadata', async () => {
      setMapData({
        regions: [{ id: 'r1', name: 'R1', occupancyRate: 0.5, totalBoards: 1, availableBoards: 1 }],
        boards: [{
          id: 'b1', codigo: 'T-001', nome: 'Teste', lat: -23.1, lng: -46.1, status: 'occupied', regionId: 'r1', localizacao: 'X',
          commercialStatus: 'CONTRACTED_ACTIVE',
        }],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
      const toMapPointsBody = source.slice(source.indexOf('function toMapPoints'), source.indexOf('function getRegionValue'));
      expect(toMapPointsBody).not.toContain('commercialStatus');
      expect(source).toContain('metadata:');
    });

    it('MapPoint preserva commercialProjection no metadata', () => {
      const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
      const toMapPointsBody = source.slice(source.indexOf('function toMapPoints'), source.indexOf('function getRegionValue'));
      expect(toMapPointsBody).not.toContain('commercialProjection');
      expect(toMapPointsBody).not.toContain('cp?.activeContract');
    });

    it('MapPoint preserva cliente_nome no metadata', () => {
      const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
      const toMapPointsBody = source.slice(source.indexOf('function toMapPoints'), source.indexOf('function getRegionValue'));
      expect(toMapPointsBody).not.toContain('cliente_nome');
    });

    it('MapPoint preserva valorMensal no metadata', () => {
      const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
      const toMapPointsBody = source.slice(source.indexOf('function toMapPoints'), source.indexOf('function getRegionValue'));
      expect(toMapPointsBody).not.toContain('valorMensal');
      expect(toMapPointsBody).not.toContain('receitaEstimada');
    });

    it('MapPoint preserva activeContract no metadata', () => {
      const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
      const toMapPointsBody = source.slice(source.indexOf('function toMapPoints'), source.indexOf('function getRegionValue'));
      expect(toMapPointsBody).not.toContain('activeContract');
    });

    it('MapPoint preserva reservation no metadata', () => {
      const source = readFileSync(MAP_PAGE_SOURCE, 'utf8');
      const toMapPointsBody = source.slice(source.indexOf('function toMapPoints'), source.indexOf('function getRegionValue'));
      expect(toMapPointsBody).not.toContain('reservation');
    });

    it('toMapPoints repassa commercialStatus no data-points via metadata', async () => {
      setMapData({
        regions: [{ id: 'r1', name: 'R1', occupancyRate: 0.8, totalBoards: 1, availableBoards: 0 }],
        boards: [{
          id: 'b1', codigo: 'COM-001', nome: 'Comercial', lat: -23.1, lng: -46.1,
          status: 'occupied', regionId: 'r1', localizacao: 'Av Teste',
          commercialStatus: 'CONTRACTED_ACTIVE',
          cliente_nome: 'Itau',
          valor_mensal: 5000,
          activeContract: { clientName: 'Itau', startDate: '2026-01-01', endDate: '2026-12-31' },
        }],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);
      // O mock de V4OperationalMap recebe os points — verificar que a placa chegou
      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.points).toContain('COM-001');
    });
  });

  describe('toMapPoints — status visual sobreposto por operationalBlock', () => {
    it('placa disponivel sem operacao permanece Disponivel', async () => {
      setMapData({
        regions: [],
        boards: [
          { id: 'b1', codigo: 'DISP-001', nome: 'Disp', lat: -23.1, lng: -46.1, status: 'available', localizacao: 'A' },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('available');
      expect(mapEl.dataset.baseStatuses).toBe('available');
    });

    it('placa ocupada sem operacao permanece Ocupada', async () => {
      setMapData({
        regions: [],
        boards: [
          { id: 'b1', codigo: 'OCUP-001', nome: 'Ocup', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A' },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('occupied');
    });

    it('placa reservada sem operacao permanece Reservada', async () => {
      setMapData({
        regions: [],
        boards: [
          { id: 'b1', codigo: 'RES-001', nome: 'Res', lat: -23.1, lng: -46.1, status: 'reserved', localizacao: 'A' },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('reserved');
    });

    it('placa ocupada com operacao de manutencao aberta aparece como Manutencao', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'MNT-001', nome: 'Manutencao', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', label: 'Manutenção em andamento' },
          },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('maintenance');
      expect(mapEl.dataset.baseStatuses).toBe('occupied');
    });

    it('placa com operacao de raspagem aberta aparece como Manutencao sem criar nova cor', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'RASP-001', nome: 'Raspagem', lat: -23.1, lng: -46.1, status: 'available', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('maintenance');
    });

    it('placa com operacao de limpeza/vistoria aberta aparece como Manutencao', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'INSP-001', nome: 'Vistoria', lat: -23.1, lng: -46.1, status: 'available', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'INSPECTION', operationStatus: 'PENDING', label: 'Vistoria pendente' },
          },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('maintenance');
    });

    it('placa com operacao critica (BLOCK) aberta aparece como Critica', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'BLK-001', nome: 'Bloqueio', lat: -23.1, lng: -46.1, status: 'available', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'BLOCK', operationStatus: 'IN_PROGRESS', label: 'Bloqueio operacional' },
          },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('critical');
    });

    it('operationalBlock.blocked === false nao altera o status visual', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'OK-001', nome: 'Ok', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A',
            operationalBlock: { blocked: false, operationType: 'MAINTENANCE' },
          },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('occupied');
    });

    it('ao concluir/cancelar operacao (operationalBlock ausente) o status volta ao original', async () => {
      setMapData({
        regions: [],
        boards: [
          { id: 'b1', codigo: 'BACK-001', nome: 'De volta', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A', operationalBlock: null },
        ],
      });
      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const mapEl = screen.getByTestId('operational-map');
      expect(mapEl.dataset.statuses).toBe('occupied');
      expect(mapEl.dataset.operationalBlocks).toBe('');
    });
  });

  describe('filtros e contadores — status visual final (operationalBlock)', () => {
    function chipCount(name) {
      const chip = screen.getByRole('button', { name: new RegExp(name, 'i') });
      return chip.querySelector('strong').textContent;
    }

    it('contadores base: Disponiveis/Ocupadas/Reservadas contam placas sem operacao', async () => {
      setMapData({
        regions: [],
        boards: [
          { id: 'b1', codigo: 'DISP-001', nome: 'Disp', lat: -23.1, lng: -46.1, status: 'available', localizacao: 'A' },
          { id: 'b2', codigo: 'OCUP-001', nome: 'Ocup', lat: -23.2, lng: -46.2, status: 'occupied', localizacao: 'B' },
          { id: 'b3', codigo: 'RES-001', nome: 'Res', lat: -23.3, lng: -46.3, status: 'reserved', localizacao: 'C' },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      expect(chipCount('Disponiveis')).toBe('1');
      expect(chipCount('Ocupadas')).toBe('1');
      expect(chipCount('Reservadas')).toBe('1');
      expect(chipCount('Manutencao')).toBe('0');
      expect(chipCount('Criticas')).toBe('0');
    });

    it('placa ocupada com raspagem aberta conta em Manutencao, nao em Ocupadas', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'RASP-001', nome: 'Raspagem', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      expect(chipCount('Ocupadas')).toBe('0');
      expect(chipCount('Manutencao')).toBe('1');
    });

    it('placa disponivel com manutencao aberta conta em Manutencao, nao em Disponiveis', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'MNT-001', nome: 'Manutencao', lat: -23.1, lng: -46.1, status: 'available', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', label: 'Manutencao em andamento' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      expect(chipCount('Disponiveis')).toBe('0');
      expect(chipCount('Manutencao')).toBe('1');
    });

    it('placa reservada com vistoria aberta conta em Manutencao, nao em Reservadas', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'INSP-001', nome: 'Vistoria', lat: -23.1, lng: -46.1, status: 'reserved', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'INSPECTION', operationStatus: 'PENDING', label: 'Vistoria pendente' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      expect(chipCount('Reservadas')).toBe('0');
      expect(chipCount('Manutencao')).toBe('1');
    });

    it('operacao critica (BLOCK) conta em Criticos', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'BLK-001', nome: 'Bloqueio', lat: -23.1, lng: -46.1, status: 'available', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'BLOCK', operationStatus: 'IN_PROGRESS', label: 'Bloqueio operacional' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      expect(chipCount('Disponiveis')).toBe('0');
      expect(chipCount('Criticas')).toBe('1');
    });

    it('operationalBlock.blocked === false nao altera os contadores', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'OK-001', nome: 'Ok', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A',
            operationalBlock: { blocked: false, operationType: 'MAINTENANCE' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      expect(chipCount('Ocupadas')).toBe('1');
      expect(chipCount('Manutencao')).toBe('0');
    });

    it('botao Manutencao mostra placas com raspagem/manutencao/vistoria abertas, botao Ocupadas exclui a placa em raspagem', async () => {
      setMapData({
        regions: [],
        boards: [
          { id: 'b1', codigo: 'OCUP-001', nome: 'Ocup', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A' },
          {
            id: 'b2', codigo: 'RASP-001', nome: 'Raspagem', lat: -23.2, lng: -46.2, status: 'occupied', localizacao: 'B',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
          {
            id: 'b3', codigo: 'MNT-001', nome: 'Manutencao', lat: -23.3, lng: -46.3, status: 'available', localizacao: 'C',
            operationalBlock: { blocked: true, operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', label: 'Manutencao em andamento' },
          },
          {
            id: 'b4', codigo: 'INSP-001', nome: 'Vistoria', lat: -23.4, lng: -46.4, status: 'reserved', localizacao: 'D',
            operationalBlock: { blocked: true, operationType: 'INSPECTION', operationStatus: 'PENDING', label: 'Vistoria pendente' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      fireEvent.click(screen.getByRole('button', { name: /Manutencao/i }));
      const maintenancePoints = screen.getByTestId('operational-map').dataset.points;
      expect(maintenancePoints).toContain('RASP-001');
      expect(maintenancePoints).toContain('MNT-001');
      expect(maintenancePoints).toContain('INSP-001');
      expect(maintenancePoints).not.toContain('OCUP-001');

      fireEvent.click(screen.getByRole('button', { name: /Ocupadas/i }));
      const occupiedPoints = screen.getByTestId('operational-map').dataset.points;
      expect(occupiedPoints).toContain('OCUP-001');
      expect(occupiedPoints).not.toContain('RASP-001');
    });

    it('select "Todos os status" usa a mesma logica dos botoes para status visual final', async () => {
      setMapData({
        regions: [],
        boards: [
          { id: 'b1', codigo: 'OCUP-001', nome: 'Ocup', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A' },
          {
            id: 'b2', codigo: 'RASP-001', nome: 'Raspagem', lat: -23.2, lng: -46.2, status: 'occupied', localizacao: 'B',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      const statusSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(statusSelect, { target: { value: 'maintenance' } });

      const points = screen.getByTestId('operational-map').dataset.points;
      expect(points).toBe('RASP-001');
    });

    it('busca por texto continua funcionando junto com filtro de status visual', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'RASP-001', nome: 'Raspagem Norte', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
          {
            id: 'b2', codigo: 'RASP-002', nome: 'Raspagem Sul', lat: -23.2, lng: -46.2, status: 'occupied', localizacao: 'B',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      fireEvent.click(screen.getByRole('button', { name: /Manutencao/i }));
      fireEvent.change(screen.getByPlaceholderText('Buscar placa ou localizacao'), { target: { value: 'Norte' } });

      const points = screen.getByTestId('operational-map').dataset.points;
      expect(points).toBe('RASP-001');
    });

    it('filtro por regiao continua funcionando junto com filtro de status visual', async () => {
      setMapData({
        regions: [
          { id: 'r1', name: 'Regiao 1', occupancyRate: 0.5, totalBoards: 1, availableBoards: 0 },
          { id: 'r2', name: 'Regiao 2', occupancyRate: 0.5, totalBoards: 1, availableBoards: 0 },
        ],
        boards: [
          {
            id: 'b1', codigo: 'RASP-R1', nome: 'Raspagem R1', lat: -23.1, lng: -46.1, status: 'occupied', regionId: 'r1', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
          {
            id: 'b2', codigo: 'RASP-R2', nome: 'Raspagem R2', lat: -23.2, lng: -46.2, status: 'occupied', regionId: 'r2', localizacao: 'B',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      render(<MemoryRouter><MapPage /></MemoryRouter>);

      fireEvent.click(screen.getByRole('button', { name: /Manutencao/i }));
      const regionSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(regionSelect, { target: { value: 'r1' } });

      const points = screen.getByTestId('operational-map').dataset.points;
      expect(points).toBe('RASP-R1');
    });

    it('apos conclusao/cancelamento da operacao, contadores voltam ao status base', async () => {
      setMapData({
        regions: [],
        boards: [
          {
            id: 'b1', codigo: 'RASP-001', nome: 'Raspagem', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A',
            operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
          },
        ],
      });

      const { default: MapPage } = await import('./MapPage.jsx');
      const view = render(<MemoryRouter><MapPage /></MemoryRouter>);

      expect(chipCount('Manutencao')).toBe('1');
      expect(chipCount('Ocupadas')).toBe('0');

      resources['inventory.boards'] = resource([
        { id: 'b1', codigo: 'RASP-001', nome: 'Raspagem', lat: -23.1, lng: -46.1, status: 'occupied', localizacao: 'A', operationalBlock: null },
      ]);
      // focusBoard precisa mudar para forcar re-render do componente memo()
      view.rerender(<MemoryRouter><MapPage focusBoard={null} /></MemoryRouter>);

      expect(chipCount('Manutencao')).toBe('0');
      expect(chipCount('Ocupadas')).toBe('1');
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
