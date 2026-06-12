// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BoardCreatePanel from './BoardCreatePanel.jsx';

vi.mock('../../../services/regionService.js', () => ({
  listRegions: vi.fn().mockResolvedValue([{ id: 'region-1', nome: 'Centro' }]),
}));

describe('BoardCreatePanel', () => {
  it('mantem o painel aberto e mostra conflito amigavel no numero da placa', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockRejectedValue({ code: 'PLATE_NAME_CONFLICT' });
    render(<BoardCreatePanel onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('Ex: PLB-001'), { target: { value: 'PLACA 07' } });
    fireEvent.change(screen.getByPlaceholderText(/Av\. Paulista/i), { target: { value: 'Rua Teste' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Centro' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('option', { name: 'Centro' }).parentElement, { target: { value: 'region-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar placa/i }));

    await waitFor(() => {
      expect(screen.getByText('Já existe uma placa cadastrada com esse nome.')).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
