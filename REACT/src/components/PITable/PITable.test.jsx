import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// ── Mocks — declarados antes dos imports do componente ────────────────────

let mockCanManage = true;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => mockCanManage,
  }),
}));

vi.mock('../ToastNotification/ToastNotification', () => ({
  useToast: () => vi.fn(),
}));

vi.mock('../../services', () => ({
  queuePDFJob: vi.fn(),
}));

vi.mock('../Spinner/Spinner', () => ({
  default: ({ mini }) => `[Spinner${mini ? '-mini' : ''}]`,
}));

// ── import after mocks ─────────────────────────────────────────────────────
import { PIsTable } from './PITable.jsx';

// ── helpers ───────────────────────────────────────────────────────────────

const noop = () => {};
const PI_ID = 'pi-abc123';

function basePI(overrides = {}) {
  return {
    _id: PI_ID,
    status: 'DRAFT',
    descricao: 'Campanha Verão',
    clienteId: { nome: 'Acme Corp' },
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-06-30T00:00:00.000Z',
    valorTotal: 5000,
    ...overrides,
  };
}

function renderTable(pi, props = {}) {
  const defaultProps = {
    pis: [pi],
    onEdit: noop,
    onDelete: noop,
    onApprove: noop,
    onReject: noop,
    onCancel: noop,
    onGenerateContractFromPI: noop,
    onDownloadPDF: noop,
    onDownloadExcel: noop,
    downloadingPIId: null,
    actionLoadingId: null,
    ...props,
  };
  return renderToString(
    <table><PIsTable {...defaultProps} /></table>
  );
}

beforeEach(() => {
  mockCanManage = true;
});

// ── Status badges ─────────────────────────────────────────────────────────

describe('PITable — status badges', () => {
  it('exibe label traduzido para DRAFT', () => {
    const html = renderTable(basePI({ status: 'DRAFT' }));
    expect(html).toContain('Rascunho');
    expect(html).toContain('pi-status-badge--draft');
  });

  it('exibe label traduzido para PENDING_APPROVAL', () => {
    const html = renderTable(basePI({ status: 'PENDING_APPROVAL' }));
    expect(html).toContain('Pendente de aprovação');
    expect(html).toContain('pi-status-badge--pending-approval');
  });

  it('exibe label traduzido para APPROVED', () => {
    const html = renderTable(basePI({ status: 'APPROVED' }));
    expect(html).toContain('Aprovada');
    expect(html).toContain('pi-status-badge--approved');
  });

  it('exibe label traduzido para REJECTED', () => {
    const html = renderTable(basePI({ status: 'REJECTED' }));
    expect(html).toContain('Rejeitada');
    expect(html).toContain('pi-status-badge--rejected');
  });

  it('exibe label traduzido para CONTRACT_GENERATED', () => {
    const html = renderTable(basePI({ status: 'CONTRACT_GENERATED' }));
    expect(html).toContain('Contrato gerado');
    expect(html).toContain('pi-status-badge--contract-generated');
  });

  it('exibe label traduzido para CANCELLED', () => {
    const html = renderTable(basePI({ status: 'CANCELLED' }));
    expect(html).toContain('Cancelada');
    expect(html).toContain('pi-status-badge--cancelled');
  });

  it('exibe label legado vencida', () => {
    const html = renderTable(basePI({ status: 'vencida' }));
    expect(html).toContain('Vencida');
    expect(html).toContain('pi-status-badge--vencida');
  });
});

// ── Botões de workflow — visibilidade ────────────────────────────────────

describe('PITable — visibilidade dos botões de workflow', () => {
  it('DRAFT mostra botão Aprovar e Rejeitar', () => {
    const html = renderTable(basePI({ status: 'DRAFT' }));
    expect(html).toContain('Aprovar');
    expect(html).toContain('Rejeitar');
  });

  it('PENDING_APPROVAL mostra botão Aprovar e Rejeitar', () => {
    const html = renderTable(basePI({ status: 'PENDING_APPROVAL' }));
    expect(html).toContain('Aprovar');
    expect(html).toContain('Rejeitar');
  });

  it('APPROVED mostra Cancelar e Gerar contrato', () => {
    const html = renderTable(basePI({ status: 'APPROVED' }));
    expect(html).toContain('Cancelar');
    expect(html).toContain('Gerar contrato');
  });

  it('APPROVED nao mostra Aprovar nem Rejeitar', () => {
    const html = renderTable(basePI({ status: 'APPROVED' }));
    expect(html).not.toContain('Aprovar');
    expect(html).not.toContain('Rejeitar');
  });

  it('CONTRACT_GENERATED nao mostra Gerar contrato', () => {
    const html = renderTable(basePI({ status: 'CONTRACT_GENERATED' }));
    expect(html).not.toContain('Gerar contrato');
  });

  it('CANCELLED nao mostra nenhuma acao principal', () => {
    const html = renderTable(basePI({ status: 'CANCELLED' }));
    expect(html).not.toContain('Aprovar');
    expect(html).not.toContain('Rejeitar');
    expect(html).not.toContain('Cancelar');
    expect(html).not.toContain('Gerar contrato');
  });

  it('REJECTED nao mostra nenhuma acao principal', () => {
    const html = renderTable(basePI({ status: 'REJECTED' }));
    expect(html).not.toContain('Aprovar');
    expect(html).not.toContain('Rejeitar');
    expect(html).not.toContain('Cancelar');
    expect(html).not.toContain('Gerar contrato');
  });

  it('concluida nao mostra nenhuma acao principal', () => {
    const html = renderTable(basePI({ status: 'concluida' }));
    expect(html).not.toContain('Aprovar');
    expect(html).not.toContain('Gerar contrato');
  });
});

// ── RBAC — sem permissão ─────────────────────────────────────────────────

describe('PITable — RBAC', () => {
  it('sem permissao propostas.update, acoes ficam ocultas', () => {
    mockCanManage = false;
    const html = renderTable(basePI({ status: 'DRAFT' }));
    expect(html).not.toContain('Aprovar');
    expect(html).not.toContain('Rejeitar');
    expect(html).not.toContain('Cancelar');
    expect(html).not.toContain('Gerar contrato');
  });

  it('sem permissao, botoes de editar e apagar ficam ocultos', () => {
    mockCanManage = false;
    const html = renderTable(basePI({ status: 'DRAFT' }));
    expect(html).not.toContain('fa-pencil-alt');
    expect(html).not.toContain('fa-trash');
  });

  it('com permissao, botoes de editar e apagar aparecem', () => {
    mockCanManage = true;
    const html = renderTable(basePI({ status: 'DRAFT' }));
    expect(html).toContain('fa-pencil-alt');
    expect(html).toContain('fa-trash');
  });
});

// ── Dados da PI na linha ─────────────────────────────────────────────────

describe('PITable — dados exibidos', () => {
  it('exibe descricao da PI', () => {
    const html = renderTable(basePI({ descricao: 'Campanha Inverno' }));
    expect(html).toContain('Campanha Inverno');
  });

  it('exibe nome do cliente', () => {
    const html = renderTable(basePI({ clienteId: { nome: 'Globo S.A.' } }));
    expect(html).toContain('Globo S.A.');
  });

  it('exibe valor total formatado', () => {
    const html = renderTable(basePI({ valorTotal: 12500 }));
    expect(html).toContain('12.500');
  });

  it('exibe periodo usando startDate/endDate V4.1', () => {
    // Use midday to avoid midnight UTC timezone drift
    const html = renderTable(basePI({
      startDate: '2026-06-15T12:00:00.000Z',
      endDate: '2026-06-25T12:00:00.000Z',
    }));
    expect(html).toContain('15/06/26');
    expect(html).toContain('25/06/26');
  });

  it('exibe periodo usando dataInicio/dataFim legado como fallback', () => {
    const pi = basePI({});
    delete pi.startDate;
    delete pi.endDate;
    pi.dataInicio = '2026-07-10T12:00:00.000Z';
    pi.dataFim    = '2026-07-20T12:00:00.000Z';
    const html = renderTable(pi);
    expect(html).toContain('10/07/26');
    expect(html).toContain('20/07/26');
  });

  it('lista vazia exibe mensagem de nenhum resultado', () => {
    const html = renderToString(
      <table>
        <PIsTable
          pis={[]}
          onEdit={noop} onDelete={noop}
          onApprove={noop} onReject={noop} onCancel={noop}
          onGenerateContractFromPI={noop}
          onDownloadPDF={noop} onDownloadExcel={noop}
        />
      </table>
    );
    expect(html).toContain('Nenhuma proposta interna');
  });
});
