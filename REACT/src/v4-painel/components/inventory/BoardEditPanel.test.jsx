// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BoardEditPanel from './BoardEditPanel.jsx';
import { deleteMedia, getMediaByOwner, setMediaAsMain, uploadMedia } from '../../../services/mediaService.js';

vi.mock('../../../services/regionService.js', () => ({
  listRegions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/mediaService.js', () => ({
  uploadMedia: vi.fn(),
  getMediaByOwner: vi.fn(),
  setMediaAsMain: vi.fn(),
  deleteMedia: vi.fn(),
}));

describe('BoardEditPanel', () => {
  beforeEach(() => {
    uploadMedia.mockReset();
    getMediaByOwner.mockReset();
    setMediaAsMain.mockReset();
    deleteMedia.mockReset();
    getMediaByOwner.mockResolvedValue([]);
    global.URL.createObjectURL = vi.fn(() => 'blob:test-preview');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('preenche latitude e longitude salvas em formatos legados', async () => {
    render(
      <BoardEditPanel
        board={{
          id: 'b1',
          codigo: 'SP-001',
          endereco: 'Av Paulista',
          coordenadas: '-23.5505,-46.6333',
          status: 'available',
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('-23.5505')).toBeInTheDocument();
      expect(screen.getByDisplayValue('-46.6333')).toBeInTheDocument();
    });
  });

  it('mostra estado comercial como leitura quando existe status temporal', () => {
    render(
      <BoardEditPanel
        board={{
          id: 'b2',
          codigo: 'SP-002',
          endereco: 'Rua B',
          location: { coordinates: [-46.64, -23.56] },
          status: 'reserved',
          cliente: 'Cliente legado',
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Contratos e clientes sao gerenciados em PI\/Contratos/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Cliente$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Contrato$/i)).not.toBeInTheDocument();
  });

  it('mostra preview da imagem atual e galeria', () => {
    render(
      <BoardEditPanel
        board={{
          id: 'b3',
          codigo: 'SP-003',
          endereco: 'Rua C',
          imageUrl: 'https://cdn/main.jpg',
          imagens: [{ id: 'img-1', url: 'https://cdn/main.jpg', filename: 'main.jpg', category: 'MAIN', isMain: true }],
          status: 'available',
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByAltText('Imagem da placa SP-003')).toHaveAttribute('src', 'https://cdn/main.jpg');
    expect(screen.getByText('main.jpg')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
  });

  it('mostra preview local antes do upload e atualiza imagem principal apos envio', async () => {
    uploadMedia.mockResolvedValueOnce({
      id: 'img-2',
      publicUrl: 'https://cdn/new.jpg',
      filename: 'new.webp',
      category: 'MAIN',
      isMain: true,
    });
    const onImageChange = vi.fn();

    render(
      <BoardEditPanel
        board={{ id: 'b4', codigo: 'SP-004', endereco: 'Rua D', status: 'available' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onImageChange={onImageChange}
      />,
    );

    const input = document.querySelector('input[type="file"]');
    const file = new File(['image'], 'new.webp', { type: 'image/webp' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByAltText('Imagem da placa SP-004').getAttribute('src')).toContain('blob:');
    fireEvent.click(screen.getByText('Trocar imagem principal'));

    await waitFor(() => expect(uploadMedia).toHaveBeenCalledWith(file, {
      ownerType: 'PLATE',
      ownerId: 'b4',
      category: 'MAIN',
      setAsMain: true,
      source: 'UPLOAD',
    }));
    await waitFor(() => expect(onImageChange).toHaveBeenCalled());
    expect(screen.getByText('new.webp')).toBeInTheDocument();
  });

  it('define e remove imagem da galeria', async () => {
    setMediaAsMain.mockResolvedValueOnce({ id: 'img-2', publicUrl: 'https://cdn/2.jpg', isMain: true });
    deleteMedia.mockResolvedValueOnce({ id: 'img-2', status: 'DELETED' });

    render(
      <BoardEditPanel
        board={{
          id: 'b5',
          codigo: 'SP-005',
          endereco: 'Rua E',
          imageUrl: 'https://cdn/1.jpg',
          imagens: [
            { id: 'img-1', url: 'https://cdn/1.jpg', filename: '1.jpg', isMain: true },
            { id: 'img-2', url: 'https://cdn/2.jpg', filename: '2.jpg', isMain: false },
          ],
          status: 'available',
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Definir como principal'));
    await waitFor(() => expect(setMediaAsMain).toHaveBeenCalledWith('img-2'));

    fireEvent.click(screen.getAllByText('Remover').at(-1));
    await waitFor(() => expect(deleteMedia).toHaveBeenCalledWith('img-2'));
  });
});
