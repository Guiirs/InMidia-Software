// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PlateOperationHistory from './PlateOperationHistory.jsx';

const mockGetOperationsByPlate = vi.fn();

vi.mock('../../../services/operationsV4Service.js', () => ({
  getOperationsByPlate: (...args) => mockGetOperationsByPlate(...args),
}));

const PLATE_ID = 'plate-abc123';

function buildItem(overrides = {}) {
  return {
    id: 'op-1',
    operationType: 'SCRAPING',
    operationTypeLabel: 'Raspagem',
    operationStatus: 'DONE',
    statusLabel: 'Concluída',
    createdAt: '2026-06-12T10:00:00.000Z',
    completedAt: '2026-06-12T14:30:00.000Z',
    cancelledAt: null,
    startedAt: null,
    scheduledAt: null,
    teamSnapshot: null,
    finalReport: null,
    completionNotes: null,
    evidences: [],
    payload: {},
    ...overrides,
  };
}

function mockResolve(items = [], total = null) {
  mockGetOperationsByPlate.mockResolvedValue({
    plateId: PLATE_ID,
    total: total ?? items.length,
    items,
    tasks: items,
  });
}

beforeEach(() => vi.clearAllMocks());

describe('PlateOperationHistory', () => {

  // ── 1. Painel/card da placa mostra histórico operacional ──────────────────

  it('1. renderiza seção de histórico operacional para o plateId', async () => {
    mockResolve([buildItem()]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId('plate-operation-history')).toBeInTheDocument();
    });
    expect(screen.getByText('Histórico operacional')).toBeInTheDocument();
  });

  // ── 2. Histórico mostra tipo, status, equipe e datas ─────────────────────

  it('2. mostra tipo de operação, status e data de conclusão', async () => {
    mockResolve([buildItem({
      operationType: 'SCRAPING',
      operationTypeLabel: 'Raspagem',
      operationStatus: 'DONE',
      statusLabel: 'Concluída',
      completedAt: '2026-06-12T14:30:00.000Z',
    })]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getByTestId('history-item')).toBeInTheDocument());

    expect(screen.getByTestId('history-type')).toHaveTextContent('Raspagem');
    expect(screen.getByTestId('history-status')).toHaveTextContent('Concluída');
    expect(screen.getByTestId('history-date')).toBeInTheDocument();
  });

  // ── 3. Histórico mostra relatório final ────────────────────────────────────

  it('3. exibe finalReport quando presente', async () => {
    mockResolve([buildItem({ finalReport: 'Placa raspada com sucesso.' })]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getByTestId('history-report')).toBeInTheDocument());
    expect(screen.getByTestId('history-report')).toHaveTextContent('Placa raspada com sucesso.');
  });

  // ── 4. Histórico não quebra sem equipe ────────────────────────────────────

  it('4. não quebra quando teamSnapshot é null', async () => {
    mockResolve([buildItem({ teamSnapshot: null })]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getByTestId('history-item')).toBeInTheDocument());
    expect(screen.queryByTestId('history-team')).not.toBeInTheDocument();
  });

  // ── 5. Histórico não quebra sem evidências ────────────────────────────────

  it('5. não quebra quando evidences é vazio ou null', async () => {
    mockResolve([
      buildItem({ evidences: [] }),
      buildItem({ id: 'op-2', evidences: null }),
    ]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getAllByTestId('history-item')).toHaveLength(2));
    expect(screen.queryByTestId('history-evidences')).not.toBeInTheDocument();
  });

  // ── Equipe exibida ─────────────────────────────────────────────────────────

  it('mostra equipe responsável quando teamSnapshot existe', async () => {
    mockResolve([buildItem({
      teamSnapshot: { name: 'Equipe Fortaleza 01', memberCount: 3 },
    })]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getByTestId('history-team')).toBeInTheDocument());
    expect(screen.getByTestId('history-team')).toHaveTextContent('Equipe Fortaleza 01');
    expect(screen.getByTestId('history-team')).toHaveTextContent('3 integrantes');
  });

  // ── Evidências são renderizadas ───────────────────────────────────────────

  it('renderiza chips de evidências com links válidos', async () => {
    mockResolve([buildItem({
      evidences: [
        { url: 'https://cdn.example.com/img1.jpg', type: 'IMAGE', caption: 'Foto antes' },
        { url: 'https://cdn.example.com/img2.jpg', type: 'IMAGE', caption: 'Foto depois' },
      ],
    })]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getByTestId('history-evidences')).toBeInTheDocument());
    expect(screen.getByText('Foto antes')).toBeInTheDocument();
    expect(screen.getByText('Foto depois')).toBeInTheDocument();
  });

  // ── Vazio quando sem operações ────────────────────────────────────────────

  it('exibe mensagem de vazio quando não há operações', async () => {
    mockResolve([]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getByTestId('history-empty')).toBeInTheDocument());
    expect(screen.getByTestId('history-empty')).toHaveTextContent('Nenhuma operação');
  });

  // ── Múltiplos status ───────────────────────────────────────────────────────

  it('renderiza múltiplos itens com status distintos', async () => {
    mockResolve([
      buildItem({ id: 'op-1', operationStatus: 'DONE',        statusLabel: 'Concluída'    }),
      buildItem({ id: 'op-2', operationStatus: 'CANCELLED',   statusLabel: 'Cancelada',   completedAt: null, cancelledAt: '2026-06-11T10:00:00.000Z' }),
      buildItem({ id: 'op-3', operationStatus: 'IN_PROGRESS', statusLabel: 'Em andamento', completedAt: null, startedAt: '2026-06-13T09:00:00.000Z' }),
    ]);
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() => expect(screen.getAllByTestId('history-item')).toHaveLength(3));

    const items = screen.getAllByTestId('history-item');
    expect(items[0]).toHaveAttribute('data-status', 'DONE');
    expect(items[1]).toHaveAttribute('data-status', 'CANCELLED');
    expect(items[2]).toHaveAttribute('data-status', 'IN_PROGRESS');
  });

  // ── Sem plateId não renderiza ─────────────────────────────────────────────

  it('não renderiza nada quando plateId é falsy', () => {
    render(<PlateOperationHistory plateId={null} />);
    expect(screen.queryByTestId('plate-operation-history')).not.toBeInTheDocument();
  });

  // ── Erro de carregamento ──────────────────────────────────────────────────

  it('exibe mensagem de erro quando a API falha', async () => {
    mockGetOperationsByPlate.mockRejectedValue(new Error('API error'));
    render(<PlateOperationHistory plateId={PLATE_ID} />);
    await waitFor(() =>
      expect(screen.getByText(/não foi possível/i)).toBeInTheDocument(),
    );
  });
});
