// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BoardOperationalCard from './BoardOperationalCard.jsx';

const baseBoard = {
  id: 'board-1',
  codigo: 'PL-001',
  nome: 'Placa 001',
  localizacao: 'Rua A',
  estado: 'healthy',
  prioridade: 'normal',
  status: 'available',
  siglaRegiao: 'SP',
  categoria: 'Standard',
  receitaFormatada: 'A negociar',
  recomendacao: 'Acionar carteira.',
};

describe('BoardOperationalCard', () => {
  it('renderiza a imagem principal normalizada', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, mainImageUrl: 'https://cdn/main.webp', imageStatus: 'AVAILABLE' }} />);

    expect(screen.getByAltText('Imagem da placa PL-001')).toHaveAttribute('src', 'https://cdn/main.webp');
  });

  it('mostra fallback quando nao ha imagem', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, mainImageUrl: null, imageStatus: 'MISSING' }} />);

    expect(screen.getAllByText('PL-001').length).toBeGreaterThan(0);
  });

  it('mantem fallback quando a imagem quebra', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, mainImageUrl: 'https://cdn/broken.webp' }} />);

    fireEvent.error(screen.getByAltText('Imagem da placa PL-001'));

    expect(screen.getAllByText('PL-001').length).toBeGreaterThan(0);
  });
});
