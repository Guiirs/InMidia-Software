// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MaintenanceCompletionModal from './MaintenanceCompletionModal.jsx';

describe('MaintenanceCompletionModal', () => {
  it('não renderiza nada quando fechado', () => {
    const { container } = render(
      <MaintenanceCompletionModal open={false} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza o modal com título e campo de relatório final', () => {
    render(<MaintenanceCompletionModal open onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Concluir manutenção' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Concluir manutenção' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Relatório final/)).toBeInTheDocument();
  });

  it('valida relatório final obrigatório e impede o submit quando ausente', () => {
    const onConfirm = vi.fn();
    render(<MaintenanceCompletionModal open onClose={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Concluir manutenção' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Relatório final é obrigatório para concluir a manutenção/)).toBeInTheDocument();
  });

  it('chama onConfirm com o relatório preenchido', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<MaintenanceCompletionModal open onClose={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText(/Relatório final/), { target: { value: 'Troca de lona realizada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Concluir manutenção' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Troca de lona realizada.');
  });

  // ── Erro do servidor (mensagens amigáveis) ────────────────────────────────

  it('nao exibe banner de erro quando serverError ausente', () => {
    render(<MaintenanceCompletionModal open onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByTestId('maintenance-completion-error-banner')).not.toBeInTheDocument();
  });

  it('exibe banner amigavel e destaca o campo Relatório final quando OPERATION_FINAL_REPORT_REQUIRED', () => {
    render(<MaintenanceCompletionModal open onClose={vi.fn()} onConfirm={vi.fn()} serverError={{
      code: 'OPERATION_FINAL_REPORT_REQUIRED',
      message: 'Informe o relatório final da manutenção. Descreva o que foi feito antes de concluir.',
      field: 'finalReport',
      fieldMessage: 'Relatório final é obrigatório.',
    }} />);

    const banner = screen.getByTestId('maintenance-completion-error-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('Não foi possível concluir a manutenção.')).toBeInTheDocument();
    expect(screen.getByText(/Informe o relatório final da manutenção/)).toBeInTheDocument();
    expect(screen.getByText('Relatório final é obrigatório.')).toBeInTheDocument();

    // mensagem tecnica nunca aparece
    expect(screen.queryByText(/empresaId|ObjectId|nao pertence a empresa/i)).not.toBeInTheDocument();
  });

  it('exibe mensagem padrao quando codigo de erro nao mapeado', () => {
    render(<MaintenanceCompletionModal open onClose={vi.fn()} onConfirm={vi.fn()} serverError={{
      code: 'SOME_UNKNOWN_CODE',
      message: 'Não foi possível concluir a ação. Tente novamente em instantes.',
      field: null,
      fieldMessage: null,
    }} />);

    expect(screen.getByText('Não foi possível concluir a ação. Tente novamente em instantes.')).toBeInTheDocument();
  });
});
