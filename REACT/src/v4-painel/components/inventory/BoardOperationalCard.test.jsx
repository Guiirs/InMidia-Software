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
  // ── Imagem ────────────────────────────────────────────────────────────────────

  it('renderiza a imagem principal normalizada via imageUrl', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, imageUrl: 'https://cdn/main.webp', imageStatus: 'AVAILABLE' }} />);
    expect(screen.getByAltText('Imagem da placa PL-001')).toHaveAttribute('src', 'https://cdn/main.webp');
  });

  it('renderiza a imagem principal normalizada via mainImageUrl', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, mainImageUrl: 'https://cdn/main.webp', imageStatus: 'AVAILABLE' }} />);
    expect(screen.getByAltText('Imagem da placa PL-001')).toHaveAttribute('src', 'https://cdn/main.webp');
  });

  it('mostra fallback quando imageUrl e mainImageUrl sao null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, imageUrl: null, mainImageUrl: null, imageStatus: 'MISSING' }} />);
    expect(screen.getAllByText('PL-001').length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: /imagem da placa/i })).toBeNull();
  });

  it('nao exibe imagem quando imageUrl e vazio', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, imageUrl: '' }} />);
    expect(screen.queryByRole('img', { name: /imagem da placa/i })).toBeNull();
  });

  it('substitui por fallback quando a imagem quebra no onError', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, imageUrl: 'https://cdn/broken.webp' }} />);
    fireEvent.error(screen.getByAltText('Imagem da placa PL-001'));
    expect(screen.queryByRole('img', { name: /imagem da placa/i })).toBeNull();
    expect(screen.getAllByText('PL-001').length).toBeGreaterThan(0);
  });

  it('nao usa storageKey como src de imagem', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, storageKey: 'empresas/abc/plates/def/img.jpg', imageUrl: null }} />);
    const imgs = document.querySelectorAll('img');
    imgs.forEach((img) => {
      expect(img.getAttribute('src') ?? '').not.toContain('empresas/');
    });
  });

  it('nao usa imagemPrincipal diretamente como src', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, imagemPrincipal: 'https://cdn/legacy.jpg', imageUrl: null }} />);
    const imgs = document.querySelectorAll('img');
    imgs.forEach((img) => {
      expect(img.getAttribute('src') ?? '').not.toBe('https://cdn/legacy.jpg');
    });
  });

  // ── Dados textuais com fallback ───────────────────────────────────────────────

  it('mostra "Localização não informada" quando localizacao e null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, localizacao: null }} />);
    expect(screen.getByText('Localização não informada')).toBeInTheDocument();
  });

  it('mostra "Sem nome" quando nome e null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, nome: null, codigo: null }} />);
    expect(screen.getByText('Sem nome')).toBeInTheDocument();
  });

  it('mostra "—" quando codigo e null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, codigo: null }} />);
    // codigo aparece no img-footer e no fallback da imagem
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('mostra "Sem cliente ativo" quando cliente e null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, cliente: null }} />);
    expect(screen.getByText('Sem cliente ativo')).toBeInTheDocument();
  });

  // ── Status ────────────────────────────────────────────────────────────────────

  it('mostra "Status não informado" para status null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: null }} />);
    expect(screen.getByText('Status não informado')).toBeInTheDocument();
  });

  it('mostra "Status não informado" para status desconhecido', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'xpto_inexistente' }} />);
    expect(screen.getByText('Status não informado')).toBeInTheDocument();
  });

  it('mostra "Status não informado" para status undefined', () => {
    const { status: _omit, ...boardWithoutStatus } = baseBoard;
    render(<BoardOperationalCard board={boardWithoutStatus} />);
    expect(screen.getByText('Status não informado')).toBeInTheDocument();
  });

  it('renderiza badge Disponível para status available', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'available' }} />);
    expect(screen.getByText('Disponível')).toBeInTheDocument();
  });

  it('renderiza badge Ocupado para status occupied', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'occupied' }} />);
    expect(screen.getByText('Ocupado')).toBeInTheDocument();
  });

  it('renderiza badge Manutenção para status maintenance', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'maintenance' }} />);
    expect(screen.getByText('Manutenção')).toBeInTheDocument();
  });

  it('renderiza badge Reservado para status reserved', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'reserved' }} />);
    expect(screen.getByText('Reservado')).toBeInTheDocument();
  });

  // ── Layout e textos longos ────────────────────────────────────────────────────

  it('nao quebra com nome muito longo', () => {
    const nomeGigante = 'A'.repeat(300);
    render(<BoardOperationalCard board={{ ...baseBoard, nome: nomeGigante }} />);
    expect(screen.getByTitle(nomeGigante)).toBeInTheDocument();
  });

  it('nao quebra com localizacao muito longa', () => {
    const locGigante = 'B'.repeat(300);
    render(<BoardOperationalCard board={{ ...baseBoard, localizacao: locGigante }} />);
    expect(screen.getByTitle(locGigante)).toBeInTheDocument();
  });

  // ── Tolerância a dados completamente ausentes ─────────────────────────────────

  it('nao crasha com board minimo (apenas id)', () => {
    expect(() => render(<BoardOperationalCard board={{ id: 'x' }} />)).not.toThrow();
  });

  it('nao crasha com board vazio', () => {
    expect(() => render(<BoardOperationalCard board={{}} />)).not.toThrow();
  });

  it('nao crasha com board null usando fallback de prop', () => {
    expect(() => render(<BoardOperationalCard board={null} />)).not.toThrow();
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────────

  it('chama onSelect ao clicar no card', () => {
    const onSelect = vi.fn();
    render(<BoardOperationalCard board={baseBoard} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith(baseBoard);
  });
});
