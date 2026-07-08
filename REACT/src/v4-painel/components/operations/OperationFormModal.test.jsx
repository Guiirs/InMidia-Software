// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import OperationFormModal from './OperationFormModal.jsx';

const testState = vi.hoisted(() => ({
  boardsResource: null,
  teamsResource: null,
}));

vi.mock('../../../core/sync-core/hooks/useSyncResource.js', () => ({
  useSyncResource: (key) => {
    if (key === 'inventory.boards') return testState.boardsResource;
    if (key === 'operations.teams') return testState.teamsResource;
    throw new Error(`Recurso inesperado: ${key}`);
  },
}));

const TEAMS = [
  { id: 'team-1', name: 'Equipe Instalação Norte', memberCount: 2, status: 'ACTIVE', members: [] },
  { id: 'team-2', name: 'Equipe Arquivada', memberCount: 1, status: 'ARCHIVED', members: [] },
];

const BOARDS = [
  {
    id: 'board-07',
    codigo: '07',
    endereco: 'Av. Central, 100',
    cidade: 'Caucaia',
    regiao: 'Ceará Norte',
    status: 'available',
  },
  {
    id: 'board-12',
    codigo: '12',
    endereco: 'Rua Beira Mar, 500',
    cidade: 'Fortaleza',
    regiao: 'Ceará Leste',
    status: 'maintenance',
    operationalBlock: { label: 'Raspagem em andamento' },
  },
];

function resource(overrides = {}) {
  return {
    data: BOARDS,
    status: 'success',
    error: null,
    isStale: false,
    isRefreshing: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function openSelector() {
  fireEvent.focus(screen.getByRole('combobox', { name: /^Placa/ }));
}

function selectBoard(code = '07') {
  openSelector();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Placa ${code}`) }));
}

describe('OperationFormModal', () => {
  beforeEach(() => {
    testState.boardsResource = resource();
    testState.teamsResource = resource({ data: TEAMS });
  });

  it('não renderiza nada quando fechado', () => {
    const { container } = render(
      <OperationFormModal open={false} onClose={vi.fn()} onSave={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza o modal com título, subtítulo e botão de fechar acessível', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Nova operação' })).toBeInTheDocument();
    expect(screen.getByText('Nova operação')).toBeInTheDocument();
    expect(screen.getByText(/Registre uma nova ordem de serviço/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fechar formulário de nova operação/i })).toBeInTheDocument();
  });

  it('usa os novos labels e placeholders amigáveis', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);

    expect(screen.getByPlaceholderText('Buscar por código, endereço, cidade ou região')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Responsável ou equipe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Adicione observações úteis para a equipe operacional')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Placa/)).toHaveAttribute('role', 'combobox');
    expect(screen.queryByText(/MongoDB ObjectId/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ID da placa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nome ou ID do responsável/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Informações adicionais/i)).not.toBeInTheDocument();
  });

  it('redireciona INSTALLATION para MAINTENANCE quando passado via initialType', () => {
    // INSTALLATION está desabilitada na UI; o form usa MAINTENANCE como fallback seguro
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="INSTALLATION" />);

    const maintenanceBtn = screen.getByRole('radio', { name: 'Manutenção' });
    expect(maintenanceBtn).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radio', { name: 'Instalação' })).not.toBeInTheDocument();
    // Campo Placa aparece pois MAINTENANCE requer placa
    expect(screen.getByRole('combobox', { name: /^Placa/ })).toBeInTheDocument();
  });

  it('mostra "Motivo do bloqueio" para Bloqueio operacional', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="BLOCK" />);

    expect(screen.getByLabelText(/Motivo do bloqueio/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Novo endereço/)).not.toBeInTheDocument();
  });

  it('mostra "Motivo da manutenção" para Manutenção', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="MAINTENANCE" />);

    expect(screen.getByLabelText(/Motivo da manutenção/)).toBeInTheDocument();
  });

  it('para Raspagem não exibe campos condicionais extras', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);

    expect(screen.queryByLabelText(/Motivo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Novo endereço/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Observações')).toBeInTheDocument();
  });

  it('permite trocar o tipo de operação pelos botões do seletor', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);

    const blockBtn = screen.getByRole('radio', { name: /Bloqueio operacional/i });
    expect(blockBtn).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(blockBtn);

    expect(blockBtn).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/Motivo do bloqueio/)).toBeInTheDocument();
  });

  it('oferece todos os tipos operacionais habilitados (sem Instalação)', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} />);

    for (const label of ['Raspagem', 'Limpeza', 'Retirada', 'Manutenção', 'Bloqueio operacional', 'Bloqueio de placa', 'Operação crítica', 'Inspeção', 'Outro']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  // ── Governança P0: INSTALLATION desabilitada ─────────────────────────────

  it('[P0] INSTALLATION não aparece no grid de tipos de operação', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: 'Instalação' })).not.toBeInTheDocument();
  });

  it('[P0] modal abre com tipo padrão diferente de INSTALLATION', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} />);
    const maintenanceBtn = screen.getByRole('radio', { name: 'Manutenção' });
    expect(maintenanceBtn).toHaveAttribute('aria-checked', 'true');
    const scrapingBtn = screen.getByRole('radio', { name: 'Raspagem' });
    expect(scrapingBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('chama onClose ao clicar em Cancelar e no botão de fechar', () => {
    const onClose = vi.fn();
    render(<OperationFormModal open onClose={onClose} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Fechar formulário de nova operação/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('valida campos obrigatórios e impede o submit quando ausentes', () => {
    const onSave = vi.fn();
    render(<OperationFormModal open onClose={vi.fn()} onSave={onSave} initialType="BLOCK" />);

    fireEvent.submit(screen.getByRole('button', { name: 'Criar operação' }).closest('form'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Selecione uma placa para criar a operação.')).toBeInTheDocument();
    expect(screen.getByText(/Motivo do bloqueio é obrigatório/)).toBeInTheDocument();
  });

  it('envia o payload de SCRAPING com campos corretos', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OperationFormModal open onClose={vi.fn()} onSave={onSave} initialType="SCRAPING" />);

    selectBoard('07');
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Tudo certo' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar operação' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload).toMatchObject({
      operationType: 'SCRAPING',
      priority: 'MEDIUM',
      plateId: 'board-07',
      notes: 'Tudo certo',
      domain: 'operations',
    });
    expect(payload.title).toBe('Raspagem — placa 07');
  });

  it('carrega placas do inventário e mostra dados amigáveis', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);
    openSelector();

    const list = screen.getByRole('listbox', { name: 'Placas cadastradas' });
    expect(within(list).getByText('Placa 07')).toBeInTheDocument();
    expect(within(list).getByText('Av. Central, 100')).toBeInTheDocument();
    expect(within(list).getByText('Caucaia · Ceará Norte')).toBeInTheDocument();
    expect(within(list).getByText('Disponível')).toBeInTheDocument();
  });

  it.each([
    ['07', 'Placa 07'],
    ['central', 'Placa 07'],
    ['caucaia', 'Placa 07'],
    ['norte', 'Placa 07'],
    ['fortaleza', 'Placa 12'],
  ])('filtra placas localmente por "%s"', (query, expected) => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);
    const input = screen.getByRole('combobox', { name: /^Placa/ });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('mostra placa com operação ativa desabilitada e aviso claro', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);
    openSelector();

    const blocked = screen.getByRole('button', { name: /Placa 12/ });
    expect(blocked).toBeDisabled();
    expect(screen.getByText('Raspagem em andamento')).toBeInTheDocument();
    expect(screen.getByText('Esta placa já possui uma operação em aberto.')).toBeInTheDocument();
  });

  it('mostra loading, erro e lista vazia das placas', () => {
    const { rerender } = render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);

    testState.boardsResource = resource({ data: null, status: 'loading' });
    rerender(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);
    openSelector();
    expect(screen.getByText('Carregando placas...')).toBeInTheDocument();

    testState.boardsResource = resource({ data: null, status: 'error' });
    rerender(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);
    expect(screen.getByText('Não foi possível carregar as placas. Tente novamente.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista' }));
    expect(testState.boardsResource.refresh).toHaveBeenCalled();

    testState.boardsResource = resource({ data: [], status: 'success' });
    rerender(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);
    expect(screen.getByText('Nenhuma placa cadastrada no inventário.')).toBeInTheDocument();
  });

  it('reflete nova placa recebida pelo inventory.boards e atualiza recurso stale ao abrir', () => {
    const staleResource = resource({ isStale: true });
    testState.boardsResource = staleResource;
    const { rerender } = render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);

    expect(staleResource.refresh).toHaveBeenCalledWith({ reason: 'operation-form-open-stale-boards' });
    openSelector();

    testState.boardsResource = resource({
      data: [...BOARDS, { id: 'board-20', codigo: '20', endereco: 'Av. Nova', cidade: 'Sobral', regiao: 'Norte' }],
    });
    rerender(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);
    expect(screen.getByText('Placa 20')).toBeInTheDocument();
  });

  it('limpa a seleção quando o Sync Core passa a marcar a placa como bloqueada', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <OperationFormModal open onClose={vi.fn()} onSave={onSave} initialType="SCRAPING" />
    );
    selectBoard('07');

    testState.boardsResource = resource({
      data: BOARDS.map((board) => board.id === 'board-07'
        ? { ...board, operationalBlock: { label: 'Manutenção em andamento' } }
        : board),
    });
    rerender(<OperationFormModal open onClose={vi.fn()} onSave={onSave} initialType="SCRAPING" />);

    expect(screen.getByText('Esta placa já possui uma operação em aberto. Selecione outra placa.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar operação' })).toBeDisabled();
  });

  // ── Erro do servidor (mensagens amigáveis) ────────────────────────────────

  it('nao exibe banner de erro quando serverError ausente', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByTestId('operation-form-error-banner')).not.toBeInTheDocument();
  });

  it('exibe banner amigavel e destaca o campo Placa quando OPERATION_BOARD_NOT_FOUND', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" serverError={{
      code: 'OPERATION_BOARD_NOT_FOUND',
      message: 'Não encontramos a placa selecionada. Selecione uma placa cadastrada no inventário e tente novamente.',
      field: 'plateId',
      fieldMessage: 'Placa não encontrada.',
    }} />);

    const banner = screen.getByTestId('operation-form-error-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('Não foi possível criar a operação.')).toBeInTheDocument();
    expect(screen.getByText(/Não encontramos a placa selecionada/)).toBeInTheDocument();
    expect(screen.getByText('Placa não encontrada.')).toBeInTheDocument();
    expect(testState.boardsResource.refresh).toHaveBeenCalledWith({ reason: 'operation-form-board-not-found' });

    // mensagem tecnica nunca aparece
    expect(screen.queryByText(/empresaId|ObjectId|nao pertence a empresa/i)).not.toBeInTheDocument();
  });

  it('exibe mensagem padrao quando codigo de erro nao mapeado', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} serverError={{
      code: 'SOME_UNKNOWN_CODE',
      message: 'Não foi possível concluir a ação. Tente novamente em instantes.',
      field: null,
      fieldMessage: null,
    }} />);

    expect(screen.getByText('Não foi possível concluir a ação. Tente novamente em instantes.')).toBeInTheDocument();
  });

  it('limpa a placa e atualiza a lista quando o backend detecta operação em aberto', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" serverError={{
      code: 'PLATE_OPERATION_ALREADY_OPEN',
      message: 'Esta placa já possui uma operação em aberto.',
      field: 'plateId',
      fieldMessage: 'Selecione outra placa.',
    }} />);

    expect(screen.getByText('Esta placa já possui uma operação em aberto.')).toBeInTheDocument();
    expect(screen.getByText('Selecione outra placa.')).toBeInTheDocument();
    expect(testState.boardsResource.refresh).toHaveBeenCalledWith({ reason: 'operation-form-board-not-found' });
  });

  // ── Equipe responsável ────────────────────────────────────────────────────

  it('lista apenas equipes ativas no seletor de equipe responsável', () => {
    render(<OperationFormModal open onClose={vi.fn()} onSave={vi.fn()} initialType="SCRAPING" />);

    const select = screen.getByLabelText('Equipe responsável');
    expect(within(select).getByText('Nenhuma equipe')).toBeInTheDocument();
    expect(within(select).getByText('Equipe Instalação Norte — 2 pessoas')).toBeInTheDocument();
    expect(within(select).queryByText(/Equipe Arquivada/)).not.toBeInTheDocument();
  });

  it('inclui teamId no payload ao selecionar uma equipe responsável', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OperationFormModal open onClose={vi.fn()} onSave={onSave} initialType="SCRAPING" />);

    selectBoard('07');
    fireEvent.change(screen.getByLabelText('Equipe responsável'), { target: { value: 'team-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar operação' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ teamId: 'team-1' });
  });

  it('não inclui teamId no payload quando nenhuma equipe é selecionada', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<OperationFormModal open onClose={vi.fn()} onSave={onSave} initialType="SCRAPING" />);

    selectBoard('07');
    fireEvent.click(screen.getByRole('button', { name: 'Criar operação' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('teamId');
  });
});
