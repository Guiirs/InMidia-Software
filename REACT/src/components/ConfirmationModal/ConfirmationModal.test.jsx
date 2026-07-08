// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConfirmationModal from './ConfirmationModal.jsx';

vi.mock('./ConfirmationModal.css', () => ({}));

function renderModal(props = {}) {
  return render(
    <ConfirmationModal
      isOpen={true}
      onClose={vi.fn()}
      onConfirm={vi.fn()}
      title="Confirmar"
      message="Tem certeza?"
      {...props}
    />,
  );
}

describe('ConfirmationModal', () => {
  it('não renderiza quando fechado', () => {
    const { container } = render(
      <ConfirmationModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza título, mensagem e botões', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByText('Tem certeza?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByTestId('confirmation-modal-confirm')).toBeInTheDocument();
  });

  it('chama onClose ao clicar em Cancelar', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chama onConfirm ao clicar no botão de confirmação', () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });
    fireEvent.click(screen.getByTestId('confirmation-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('[P1.4] fecha ao clicar no backdrop quando closeOnBackdrop=true (default)', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId('confirmation-modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('[P1.4] não fecha ao clicar no backdrop quando closeOnBackdrop=false (ação destrutiva)', () => {
    const onClose = vi.fn();
    renderModal({ onClose, closeOnBackdrop: false });
    fireEvent.click(screen.getByTestId('confirmation-modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('[P1.4] fecha com ESC independente de closeOnBackdrop', () => {
    const onClose = vi.fn();
    renderModal({ onClose, closeOnBackdrop: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('[P1.4] botões Cancelar e Confirmar sempre visíveis (fora de área scrollável)', () => {
    renderModal();
    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
    const confirmBtn = screen.getByTestId('confirmation-modal-confirm');
    const actionsDiv = cancelBtn.parentElement;

    // Footer de ações é filho direto do content, não dentro do body scrollável
    expect(actionsDiv).toHaveClass('confirmation-modal-actions');
    const body = document.querySelector('.confirmation-modal-body');
    expect(body).not.toContainElement(cancelBtn);
    expect(body).not.toContainElement(confirmBtn);
  });

  it('desabilita botões durante isConfirming', () => {
    renderModal({ isConfirming: true });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByTestId('confirmation-modal-confirm')).toBeDisabled();
    expect(screen.getByTestId('confirmation-modal-confirm')).toHaveTextContent('A confirmar...');
  });

  it('usa confirmText personalizado', () => {
    renderModal({ confirmText: 'Excluir definitivamente' });
    expect(screen.getByTestId('confirmation-modal-confirm')).toHaveTextContent('Excluir definitivamente');
  });
});
