// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SafeImage from './SafeImage.jsx';

describe('SafeImage', () => {
  it('mostra placeholder quando src esta ausente', () => {
    render(<SafeImage fallbackLabel="Sem imagem cadastrada" />);
    expect(screen.getByText('Sem imagem cadastrada')).toBeInTheDocument();
  });

  it('troca para fallback quando a imagem quebra', () => {
    const onBroken = vi.fn();
    render(<SafeImage src="https://cdn/quebrada.jpg" alt="Placa" fallbackLabel="Sem imagem cadastrada" onBroken={onBroken} />);

    fireEvent.error(screen.getByAltText('Placa'));

    expect(screen.getByText('Sem imagem cadastrada')).toBeInTheDocument();
    expect(onBroken).toHaveBeenCalledWith('https://cdn/quebrada.jpg');
  });
});
