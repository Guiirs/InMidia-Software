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
  TileLayer:     () => null,
  Marker:        ({ children, eventHandlers, position }) => (
    <div data-testid="marker" data-pos={position?.join(',')}>
      <button onClick={eventHandlers?.click}>click</button>
      {children}
    </div>
  ),
  Popup:         ({ children }) => <div data-testid="popup">{children}</div>,
  GeoJSON:       () => null,
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
    expect(labelTexts).toContain('Disponivel');
    expect(labelTexts).toContain('Reservada');
    expect(labelTexts).toContain('Manutencao');
    expect(labelTexts).toContain('Critica');
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
