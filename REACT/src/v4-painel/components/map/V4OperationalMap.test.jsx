// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Leaflet e react-leaflet não rodam em jsdom — mockar por completo
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    icon: vi.fn(() => ({})),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer:  ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer:     ({ url, attribution, subdomains }) => (
    <div data-testid="tile-layer" data-url={url} data-attribution={attribution} data-subdomains={subdomains ?? ''} />
  ),
  Marker:        ({ children, eventHandlers, position }) => (
    <div data-testid="marker" data-pos={position?.join(',')}>
      <button onClick={eventHandlers?.click}>click</button>
      {children}
    </div>
  ),
  Popup:         ({ children }) => <div data-testid="popup">{children}</div>,
  GeoJSON:       ({ data, style }) => (
    <div
      data-testid="geojson"
      data-region-id={data?.properties?.id}
      data-fill={style?.fillColor}
      data-fill-opacity={style?.fillOpacity}
    />
  ),
  useMap:        () => ({ setView: vi.fn(), flyTo: vi.fn(), fitBounds: vi.fn() }),
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }) => <div data-testid="marker-cluster-group">{children}</div>,
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));

vi.mock('../media/SafeImage.jsx', () => ({
  default: ({ alt, fallbackLabel }) => <span data-testid="safe-image">{alt || fallbackLabel}</span>,
}));

vi.mock('../ui/index.js', () => ({
  V4EmptyState: ({ title }) => <div data-testid="empty-state">{title}</div>,
}));

vi.mock('../../modules/map/mapBus.js', () => ({
  mapBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

vi.mock('./V4OperationalMap.css', () => ({}));

vi.mock('../operations/PlateOperationHistory.jsx', () => ({
  default: ({ plateId, refreshKey }) => plateId ? (
    <div
      data-testid="plate-operation-history-mock"
      data-plate-id={plateId}
      data-refresh-key={refreshKey ?? ''}
    >
      Histórico: {plateId}
    </div>
  ) : null,
}));

const { default: V4OperationalMap } = await import('./V4OperationalMap.jsx');

function point(overrides = {}) {
  return {
    id: 'p1',
    title: 'BR-001',
    subtitle: 'Placa Sul',
    latitude: -23.55,
    longitude: -46.63,
    status: 'available',
    region: 'r1',
    address: 'Av. Paulista, 1000',
    mainImageUrl: null,
    images: [],
    imageStatus: 'MISSING',
    metadata: null,
    ...overrides,
  };
}

function points(count) {
  return Array.from({ length: count }, (_, index) => point({
    id: `p${index + 1}`,
    title: `BR-${String(index + 1).padStart(3, '0')}`,
    latitude: -23.55 + (index * 0.001),
    longitude: -46.63 + (index * 0.001),
  }));
}

function selectedHarnessPoint(overrides = {}) {
  return point({
    id: 'p-details',
    title: 'DET-001',
    subtitle: 'Painel premium',
    status: 'occupied',
    region: 'r1',
    address: 'Rua Enterprise, 123',
    metadata: {
      commercialStatus: 'CONTRACTED_ACTIVE',
      activeContract: {
        clientName: 'Itau',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      commercialProjection: { pricing: { contractValue: 12000 } },
      reservation: { id: 'res-1' },
    },
    ...overrides,
  });
}

function ControlledMap({ points: mapPoints = [selectedHarnessPoint()], ...props }) {
  const [selected, setSelected] = React.useState(null);
  return (
    <V4OperationalMap
      points={mapPoints}
      selectedPointId={selected?.id ?? null}
      onSelectPoint={setSelected}
      onClearSelection={() => setSelected(null)}
      {...props}
    />
  );
}

describe('V4OperationalMap â€” clustering e fullscreen', () => {
  it('renderiza markers diretos quando pontos <= 50', () => {
    render(<V4OperationalMap points={points(50)} />);

    expect(screen.queryByTestId('marker-cluster-group')).toBeNull();
    expect(screen.getAllByTestId('marker')).toHaveLength(50);
    expect(document.querySelector('[data-clustered="false"]')).not.toBeNull();
  });

  it('ativa clustering quando pontos > 50', () => {
    render(<V4OperationalMap points={points(51)} />);

    expect(screen.getByTestId('marker-cluster-group')).toBeInTheDocument();
    expect(screen.getByText(/Clustering ativo: 51 pontos/)).toBeInTheDocument();
    expect(document.querySelector('[data-clustered="true"]')).not.toBeNull();
  });

  it('mantem popup operacional em marker clusterizado', () => {
    render(<V4OperationalMap points={points(51)} />);

    expect(screen.getByTestId('marker-cluster-group')).toBeInTheDocument();
    expect(screen.getByText('BR-001')).toBeInTheDocument();
  });

  it('renderiza botao de fullscreen', () => {
    render(<V4OperationalMap points={[point()]} />);

    expect(screen.getByLabelText('Abrir mapa em tela cheia')).toBeInTheDocument();
  });

  it('fullscreen fallback nao quebra sem suporte do browser', () => {
    render(<V4OperationalMap points={[point()]} />);

    const button = screen.getByLabelText('Abrir mapa em tela cheia');
    expect(() => fireEvent.click(button)).not.toThrow();
    expect(button).toHaveClass('v4-geomap-fullscreen--unsupported');
  });

  it('permite alternar clusters pelo controle visual', () => {
    render(<V4OperationalMap points={points(51)} />);

    expect(screen.getByTestId('marker-cluster-group')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Desligar clusters'));
    expect(screen.queryByTestId('marker-cluster-group')).toBeNull();
    expect(screen.getAllByTestId('marker')).toHaveLength(51);
  });
});

describe('V4OperationalMap - tile provider e controles enterprise', () => {
  it('renderiza CartoDB Positron como tile provider padrao', () => {
    render(<V4OperationalMap points={[point()]} />);

    const tile = screen.getByTestId('tile-layer');
    expect(tile.dataset.url).toContain('basemaps.cartocdn.com');
    expect(tile.dataset.url).toContain('light_all');
    expect(tile.dataset.attribution).toContain('CARTO');
  });

  it('preserva fallback OSM quando provider desconhecido e usado', () => {
    render(<V4OperationalMap points={[point()]} tileProvider="unknown" />);

    const tile = screen.getByTestId('tile-layer');
    expect(tile.dataset.url).toContain('tile.openstreetmap.org');
    expect(tile.dataset.attribution).toContain('OpenStreetMap');
  });

  it('renderiza controles e dispara alternancias principais', () => {
    const mapPoints = [
      point({ id: 'p1', latitude: -23.55, longitude: -46.63 }),
      point({ id: 'p2', latitude: null, longitude: null, title: 'SEM-001' }),
    ];

    render(
      <V4OperationalMap
        points={mapPoints}
        regionBoundaries={[{
          id: 'r1',
          label: 'Regiao 1',
          occupancy: 0.8,
          geometry: { type: 'Polygon', coordinates: [[[-46.7, -23.6], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -23.5], [-46.7, -23.6]]] },
        }]}
      />,
    );

    expect(screen.getByLabelText('Abrir mapa em tela cheia')).toBeInTheDocument();
    expect(screen.getByLabelText('Centralizar todos os pontos')).toBeInTheDocument();
    expect(screen.getByLabelText('Ligar heatmap regional')).toBeInTheDocument();
    expect(screen.getByLabelText('Desligar clusters')).toBeInTheDocument();
    expect(screen.getByLabelText('Mostrar placas sem coordenadas')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Ligar heatmap regional'));
    expect(screen.getByLabelText('Heatmap de ocupacao regional')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mostrar placas sem coordenadas'));
    expect(screen.getByRole('dialog')).toHaveTextContent('SEM-001');

    expect(() => fireEvent.click(screen.getByLabelText('Centralizar todos os pontos'))).not.toThrow();
  });
});

describe('V4OperationalMap - slideout da placa selecionada', () => {
  it('abre slideout ao selecionar placa', () => {
    render(<ControlledMap />);

    fireEvent.click(screen.getByText('click'));

    expect(screen.getByLabelText('Detalhes da placa selecionada')).toBeInTheDocument();
    expect(screen.getByLabelText('Detalhes da placa selecionada')).toHaveTextContent('DET-001');
  });

  it('mostra dados comerciais no slideout sem chamada extra', () => {
    render(<ControlledMap />);

    fireEvent.click(screen.getByText('click'));
    const panel = screen.getByLabelText('Detalhes da placa selecionada');

    expect(panel).toHaveTextContent('Contratada ativa');
    expect(panel).toHaveTextContent('Itau');
    expect(panel).toHaveTextContent(/R\$\s*12\.000/);
    expect(panel).toHaveTextContent('Reserva ativa/futura');
  });

  it('fecha slideout corretamente', () => {
    render(<ControlledMap />);

    fireEvent.click(screen.getByText('click'));
    expect(screen.getByLabelText('Detalhes da placa selecionada')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Fechar detalhes da placa'));
    expect(screen.queryByLabelText('Detalhes da placa selecionada')).toBeNull();
  });

  it('bottom sheet mobile possui classe responsiva', () => {
    render(<ControlledMap />);

    fireEvent.click(screen.getByText('click'));
    expect(screen.getByLabelText('Detalhes da placa selecionada')).toHaveClass('v4-geomap-bottom-sheet');
  });

  it('exibe operacao em aberto no slideout quando operationalBlock.blocked e true', () => {
    render(
      <ControlledMap
        points={[selectedHarnessPoint({
          status: 'maintenance',
          operationalBlock: { blocked: true, operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', label: 'Manutenção em andamento' },
        })]}
      />,
    );

    fireEvent.click(screen.getByText('click'));
    const panel = screen.getByLabelText('Detalhes da placa selecionada');
    expect(panel).toHaveTextContent('Operação em aberto');
    expect(panel).toHaveTextContent('Manutenção em andamento');
  });

  it('exibe equipe responsável no slideout quando operationalBlock traz teamSnapshot', () => {
    render(
      <ControlledMap
        points={[selectedHarnessPoint({
          status: 'maintenance',
          operationalBlock: {
            blocked: true,
            operationType: 'SCRAPING',
            operationStatus: 'IN_PROGRESS',
            label: 'Raspagem em andamento',
            teamSnapshot: {
              id: 'team-1',
              name: 'Equipe Fortaleza 01',
              memberCount: 3,
              members: [{ name: 'João Silva', role: 'Instalador', phone: null }],
            },
          },
        })]}
      />,
    );

    fireEvent.click(screen.getByText('click'));
    const panel = screen.getByLabelText('Detalhes da placa selecionada');
    expect(panel).toHaveTextContent('Equipe responsável');
    expect(panel).toHaveTextContent('Equipe Fortaleza 01 · 3 integrantes');
    expect(panel).toHaveTextContent('João Silva — Instalador');
  });

  it('nao exibe equipe responsável no slideout quando operationalBlock nao traz teamSnapshot', () => {
    render(
      <ControlledMap
        points={[selectedHarnessPoint({
          status: 'maintenance',
          operationalBlock: { blocked: true, operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', label: 'Manutenção em andamento' },
        })]}
      />,
    );

    fireEvent.click(screen.getByText('click'));
    const panel = screen.getByLabelText('Detalhes da placa selecionada');
    expect(panel).not.toHaveTextContent('Equipe responsável');
  });
});

describe('V4OperationalMap - heatmap regional', () => {
  it('heatmap toggle renderiza boundaries quando existem', () => {
    render(
      <V4OperationalMap
        points={[point()]}
        regionBoundaries={[{
          id: 'r1',
          label: 'Regiao 1',
          occupancy: 0.2,
          geometry: { type: 'Polygon', coordinates: [[[-46.7, -23.6], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -23.5], [-46.7, -23.6]]] },
        }]}
      />,
    );

    expect(screen.getByTestId('geojson')).toHaveAttribute('data-region-id', 'r1');
    fireEvent.click(screen.getByLabelText('Ligar heatmap regional'));

    expect(screen.getByLabelText('Heatmap de ocupacao regional')).toHaveTextContent('Baixa ocupacao (1)');
    expect(screen.getByTestId('geojson')).toHaveAttribute('data-fill', '#ef4444');
  });

  it('nao quebra sem boundaries ao alternar heatmap', () => {
    render(<V4OperationalMap points={[point()]} />);

    expect(() => fireEvent.click(screen.getByLabelText('Ligar heatmap regional'))).not.toThrow();
    expect(screen.queryByLabelText('Heatmap de ocupacao regional')).toBeNull();
  });
});

describe('V4OperationalMap — legenda de status', () => {
  it('renderiza legenda com todos os 5 status em modo normal', () => {
    render(<V4OperationalMap points={[point()]} />);

    const legend = document.querySelector('.v4-geomap-legend');
    expect(legend).not.toBeNull();

    const dots = document.querySelectorAll('.v4-geomap-legend__dot');
    expect(dots).toHaveLength(5);

    const labels = document.querySelectorAll('.v4-geomap-legend__label');
    expect(labels).toHaveLength(5);

    const labelTexts = Array.from(labels).map((l) => l.textContent);
    expect(labelTexts).toContain('Ocupada');
    expect(labelTexts).toContain('Disponível');
    expect(labelTexts).toContain('Reservada');
    expect(labelTexts).toContain('Manutenção');
    expect(labelTexts).toContain('Crítica');
  });

  it('renderiza legenda em modo compacto sem labels', () => {
    render(<V4OperationalMap points={[point()]} compact />);

    const legend = document.querySelector('.v4-geomap-legend--compact');
    expect(legend).not.toBeNull();

    const dots = document.querySelectorAll('.v4-geomap-legend__dot');
    expect(dots).toHaveLength(5);

    const labels = document.querySelectorAll('.v4-geomap-legend__label');
    expect(labels).toHaveLength(0);
  });
});

describe('V4OperationalMap — popup operacional', () => {
  it('renderiza popup com titulo da placa', () => {
    render(<V4OperationalMap points={[point()]} />);
    expect(screen.getByText('BR-001')).toBeInTheDocument();
  });

  it('renderiza commercialStatus canonico no popup', () => {
    render(
      <V4OperationalMap
        points={[point({ metadata: { commercialStatus: 'CONTRACTED_ACTIVE' } })]}
      />,
    );
    expect(screen.getByText('Contratada ativa')).toBeInTheDocument();
  });

  it('renderiza clientName de activeContract.clientName no popup', () => {
    render(
      <V4OperationalMap
        points={[point({
          metadata: {
            activeContract: { clientName: 'Ambev S.A.', startDate: null, endDate: null },
          },
        })]}
      />,
    );
    expect(screen.getByText('Ambev S.A.')).toBeInTheDocument();
  });

  it('renderiza clientName de cliente_nome quando activeContract ausente', () => {
    render(
      <V4OperationalMap
        points={[point({ metadata: { cliente_nome: 'Natura Cosméticos' } })]}
      />,
    );
    expect(screen.getByText('Natura Cosméticos')).toBeInTheDocument();
  });

  it('renderiza valor formatado vindo da commercialProjection', () => {
    render(
      <V4OperationalMap
        points={[point({
          metadata: {
            commercialProjection: { pricing: { contractValue: 8500 } },
          },
        })]}
      />,
    );
    expect(screen.getByText(/R\$\s*8\.500/)).toBeInTheDocument();
  });

  it('renderiza valor de valorMensal quando commercialProjection ausente', () => {
    render(
      <V4OperationalMap
        points={[point({ metadata: { valorMensal: 4200 } })]}
      />,
    );
    expect(screen.getByText(/R\$\s*4\.200/)).toBeInTheDocument();
  });

  it('nao quebra quando metadata e null', () => {
    expect(() =>
      render(<V4OperationalMap points={[point({ metadata: null })]} />),
    ).not.toThrow();
  });

  it('nao quebra quando commercialProjection e null', () => {
    expect(() =>
      render(<V4OperationalMap points={[point({ metadata: { commercialProjection: null } })]} />),
    ).not.toThrow();
  });

  it('nao quebra quando activeContract e null', () => {
    expect(() =>
      render(<V4OperationalMap points={[point({ metadata: { activeContract: null } })]} />),
    ).not.toThrow();
  });

  it('nao exibe secao comercial quando todos campos comerciais sao nulos', () => {
    render(<V4OperationalMap points={[point({ metadata: {} })]} />);
    expect(document.querySelector('.v4-geomap-popup__commercial')).toBeNull();
  });

  it('exibe indicacao de reserva ativa quando reservation presente', () => {
    render(
      <V4OperationalMap
        points={[point({ metadata: { reservation: { id: 'res-1' } } })]}
      />,
    );
    expect(screen.getByText(/Reserva ativa/)).toBeInTheDocument();
  });

  it('exibe o tipo real da operacao aberta no popup mesmo com status visual Manutencao', () => {
    render(
      <V4OperationalMap
        points={[point({
          status: 'maintenance',
          operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem em andamento' },
        })]}
      />,
    );
    expect(screen.getByText('Raspagem em andamento')).toBeInTheDocument();
  });

  it('nao exibe texto de operacao quando operationalBlock.blocked e false', () => {
    render(
      <V4OperationalMap
        points={[point({
          status: 'available',
          operationalBlock: { blocked: false, operationType: 'MAINTENANCE', label: 'Manutenção em andamento' },
        })]}
      />,
    );
    expect(screen.queryByText('Manutenção em andamento')).toBeNull();
  });

  it('renderiza datas de inicio e fim do contrato', () => {
    render(
      <V4OperationalMap
        points={[point({
          metadata: {
            activeContract: {
              clientName: null,
              startDate: '2026-01-01',
              endDate: '2026-06-30',
            },
          },
        })]}
      />,
    );
    // Confirma que a secao comercial renderizou (hasCommercial inclui datas)
    const commercial = document.querySelector('.v4-geomap-popup__commercial');
    expect(commercial).not.toBeNull();
    // O label "Contrato" aparece quando há datas
    expect(screen.getByText('Contrato')).toBeInTheDocument();
    // O valor deve conter o ano em algum formato de data localizada
    const valueEls = document.querySelectorAll('.v4-geomap-popup__value');
    const dateValue = Array.from(valueEls).find((el) => el.textContent.includes('2026'));
    expect(dateValue).not.toBeNull();
  });
});

describe('V4OperationalMap — placas sem coordenadas', () => {
  const boardsWithAndWithout = [
    point({ id: 'p1', title: 'BR-001', latitude: -23.55, longitude: -46.63, address: 'Rua A' }),
    point({ id: 'p2', title: 'BR-002', latitude: null,   longitude: null,   address: 'Rua B', region: 'r2' }),
    point({ id: 'p3', title: 'BR-003', latitude: null,   longitude: null,   address: 'Rua C' }),
  ];

  it('exibe badge com contagem correta de placas sem coords', () => {
    render(<V4OperationalMap points={boardsWithAndWithout} />);
    expect(screen.getByText(/2 placas sem coordenadas/)).toBeInTheDocument();
  });

  it('abre painel ao clicar no badge de placas sem coords', () => {
    render(<V4OperationalMap points={boardsWithAndWithout} />);

    const notice = screen.getByTitle('Ver placas sem coordenadas');
    fireEvent.click(notice);

    const panel = screen.getByRole('dialog');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent('BR-002');
    expect(panel).toHaveTextContent('BR-003');
    expect(panel).not.toHaveTextContent('BR-001'); // placa com coords não aparece no painel
  });

  it('exibe codigo, endereco e regiao de cada placa sem coords', () => {
    render(<V4OperationalMap points={boardsWithAndWithout} />);

    const notice = screen.getByTitle('Ver placas sem coordenadas');
    fireEvent.click(notice);

    expect(screen.getByText('BR-002')).toBeInTheDocument();
    expect(screen.getByText('Rua B')).toBeInTheDocument();
    expect(screen.getByText(/r2/)).toBeInTheDocument();
  });

  it('filtra busca dentro do painel de placas sem coords', () => {
    render(<V4OperationalMap points={boardsWithAndWithout} />);

    fireEvent.click(screen.getByTitle('Ver placas sem coordenadas'));
    fireEvent.change(screen.getByLabelText('Buscar placas sem coordenadas'), { target: { value: 'BR-003' } });

    expect(screen.getByText('BR-003')).toBeInTheDocument();
    expect(screen.queryByText('BR-002')).toBeNull();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
  });

  it('fecha painel ao clicar no botao fechar', () => {
    render(<V4OperationalMap points={boardsWithAndWithout} />);

    fireEvent.click(screen.getByTitle('Ver placas sem coordenadas'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Fechar lista'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('nao exibe badge quando todas as placas tem coordenadas', () => {
    const allValid = [point({ id: 'p1', latitude: -23.55, longitude: -46.63 })];
    render(<V4OperationalMap points={allValid} />);
    expect(screen.queryByTitle('Ver placas sem coordenadas')).toBeNull();
  });
});

describe('V4OperationalMap — dimming e highlight por selectedRegionId', () => {
  const regionPoints = [
    point({ id: 'r1-p1', region: 'region-abc', latitude: -23.55, longitude: -46.63 }),
    point({ id: 'r2-p1', region: 'region-xyz', latitude: -23.56, longitude: -46.64 }),
  ];

  it('[P0.3] não aplica dimming quando selectedRegionId é null', () => {
    render(
      <V4OperationalMap
        points={regionPoints}
        selectedRegionId={null}
        onSelectPoint={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
  });

  it('[P0.3] GeoJSON selecionado tem fillOpacity maior que GeoJSON não-selecionado', () => {
    const boundaries = [
      { id: 'region-abc', label: 'Região A', occupancy: 0.7, geometry: { type: 'Polygon', coordinates: [[[-46.7, -23.6], [-46.6, -23.6], [-46.6, -23.5], [-46.7, -23.5], [-46.7, -23.6]]] } },
      { id: 'region-xyz', label: 'Região B', occupancy: 0.4, geometry: { type: 'Polygon', coordinates: [[[-46.8, -23.7], [-46.7, -23.7], [-46.7, -23.6], [-46.8, -23.6], [-46.8, -23.7]]] } },
    ];

    render(
      <V4OperationalMap
        points={regionPoints}
        regionBoundaries={boundaries}
        selectedRegionId="region-abc"
        onSelectPoint={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    const geojsons = screen.getAllByTestId('geojson');
    expect(geojsons).toHaveLength(2);

    const selected = geojsons.find((g) => g.dataset.regionId === 'region-abc');
    const dimmed   = geojsons.find((g) => g.dataset.regionId === 'region-xyz');

    expect(selected).toBeTruthy();
    expect(dimmed).toBeTruthy();
    expect(Number(selected.dataset.fillOpacity)).toBeGreaterThan(Number(dimmed.dataset.fillOpacity));
  });
});

describe('V4OperationalMap — historico operacional no slideout', () => {
  it('1. renderiza PlateOperationHistory no slideout ao selecionar placa', () => {
    render(<ControlledMap />);
    fireEvent.click(screen.getByText('click'));
    expect(screen.getByTestId('plate-operation-history-mock')).toBeInTheDocument();
  });

  it('2. PlateOperationHistory recebe plateId correto via point.id', () => {
    render(<ControlledMap />);
    fireEvent.click(screen.getByText('click'));
    const mock = screen.getByTestId('plate-operation-history-mock');
    expect(mock.dataset.plateId).toBe('p-details');
  });

  it('3. PlateOperationHistory nao e renderizado quando slideout esta fechado', () => {
    render(<ControlledMap />);
    expect(screen.queryByTestId('plate-operation-history-mock')).toBeNull();
  });

  it('4. PlateOperationHistory aparece apos as informacoes da placa no DOM', () => {
    render(<ControlledMap />);
    fireEvent.click(screen.getByText('click'));
    const panel = screen.getByLabelText('Detalhes da placa selecionada');
    const dl = panel.querySelector('dl');
    const historyMock = panel.querySelector('[data-testid="plate-operation-history-mock"]');
    expect(dl).not.toBeNull();
    expect(historyMock).not.toBeNull();
    // history mock deve vir depois do dl
    expect(dl.compareDocumentPosition(historyMock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('5. PlateOperationHistory persiste junto com operacao em aberto no slideout', () => {
    render(
      <ControlledMap
        points={[selectedHarnessPoint({
          status: 'maintenance',
          operationalBlock: { blocked: true, operationType: 'MAINTENANCE', operationStatus: 'IN_PROGRESS', label: 'Manutenção em andamento' },
        })]}
      />,
    );
    fireEvent.click(screen.getByText('click'));
    const panel = screen.getByLabelText('Detalhes da placa selecionada');
    expect(panel).toHaveTextContent('Operação em aberto');
    expect(panel).toHaveTextContent('Manutenção em andamento');
    expect(screen.getByTestId('plate-operation-history-mock')).toBeInTheDocument();
  });

  it('6. PlateOperationHistory persiste quando placa nao tem operacao em aberto', () => {
    render(
      <ControlledMap
        points={[selectedHarnessPoint({ status: 'available', operationalBlock: null })]}
      />,
    );
    fireEvent.click(screen.getByText('click'));
    const panel = screen.getByLabelText('Detalhes da placa selecionada');
    expect(panel).not.toHaveTextContent('Operação em aberto');
    expect(screen.getByTestId('plate-operation-history-mock')).toBeInTheDocument();
  });

  it('7. fechar slideout remove PlateOperationHistory da tela', () => {
    render(<ControlledMap />);
    fireEvent.click(screen.getByText('click'));
    expect(screen.getByTestId('plate-operation-history-mock')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Fechar detalhes da placa'));
    expect(screen.queryByTestId('plate-operation-history-mock')).toBeNull();
  });

  it('8. troca de placa atualiza plateId passado ao PlateOperationHistory', () => {
    const twoPoints = [
      selectedHarnessPoint({ id: 'placa-A', title: 'PAI-001' }),
      point({ id: 'placa-B', title: 'PAI-002', latitude: -23.56, longitude: -46.64 }),
    ];
    const { rerender } = render(
      <V4OperationalMap
        points={twoPoints}
        selectedPointId="placa-A"
        onSelectPoint={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByTestId('plate-operation-history-mock').dataset.plateId).toBe('placa-A');

    rerender(
      <V4OperationalMap
        points={twoPoints}
        selectedPointId="placa-B"
        onSelectPoint={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByTestId('plate-operation-history-mock').dataset.plateId).toBe('placa-B');
  });

  it('9. refreshKey reflete operationType-operationStatus da operacao aberta', () => {
    render(
      <ControlledMap
        points={[selectedHarnessPoint({
          status: 'maintenance',
          operationalBlock: { blocked: true, operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', label: 'Raspagem' },
        })]}
      />,
    );
    fireEvent.click(screen.getByText('click'));
    const mock = screen.getByTestId('plate-operation-history-mock');
    expect(mock.dataset.refreshKey).toBe('SCRAPING-IN_PROGRESS');
  });

  it('10. refreshKey e string vazia quando nao ha operationalBlock', () => {
    render(
      <ControlledMap
        points={[selectedHarnessPoint({ operationalBlock: null })]}
      />,
    );
    fireEvent.click(screen.getByText('click'));
    const mock = screen.getByTestId('plate-operation-history-mock');
    expect(mock.dataset.refreshKey).toBe('-');
  });

  it('11. refreshKey muda quando operationalBlock muda (simula conclusao de operacao)', () => {
    const twoPoints = [
      selectedHarnessPoint({
        id: 'placa-op',
        operationalBlock: { blocked: true, operationType: 'INSTALLATION', operationStatus: 'IN_PROGRESS', label: 'Instalação' },
      }),
    ];
    const { rerender } = render(
      <V4OperationalMap
        points={twoPoints}
        selectedPointId="placa-op"
        onSelectPoint={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByTestId('plate-operation-history-mock').dataset.refreshKey).toBe('INSTALLATION-IN_PROGRESS');

    rerender(
      <V4OperationalMap
        points={[selectedHarnessPoint({ id: 'placa-op', operationalBlock: null })]}
        selectedPointId="placa-op"
        onSelectPoint={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByTestId('plate-operation-history-mock').dataset.refreshKey).toBe('-');
  });

  it('12. nao quebra quando ponto selecionado nao tem operationalBlock', () => {
    expect(() => {
      render(
        <ControlledMap
          points={[selectedHarnessPoint({ operationalBlock: undefined })]}
        />,
      );
      fireEvent.click(screen.getByText('click'));
    }).not.toThrow();
    expect(screen.getByTestId('plate-operation-history-mock')).toBeInTheDocument();
  });
});
