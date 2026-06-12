// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BoardOperationalCard from './BoardOperationalCard.jsx';

vi.mock('../../modules/map/mapBus.js', () => ({
  mapBus: { emit: vi.fn() },
}));

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

  it('mostra "Sem identificação" quando nome e codigo sao null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, nome: null, codigo: null }} />);
    expect(screen.getByText('Sem identificação')).toBeInTheDocument();
  });

  it('mostra "—" quando codigo e null', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, codigo: null }} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('mostra "Sem cliente ativo" para placa ocupada sem cliente', () => {
    // available sem receita nao exibe bloco comercial; occupied sempre exibe
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'occupied', cliente: null }} />);
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

  it('nao quebra com codigo muito longo', () => {
    const codigoGigante = 'A'.repeat(300);
    render(<BoardOperationalCard board={{ ...baseBoard, codigo: codigoGigante }} />);
    expect(screen.getByTitle(codigoGigante)).toBeInTheDocument();
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

  // ── Dados comerciais reais ─────────────────────────────────────────────────────

  it('exibe nome real do cliente quando cliente esta preenchido', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'occupied', cliente: 'Fortaleza Shopping' }} />);
    expect(screen.getByText('Fortaleza Shopping')).toBeInTheDocument();
    expect(screen.getByText('Cliente atual')).toBeInTheDocument();
    expect(screen.queryByText('Sem cliente ativo')).toBeNull();
  });

  it('exibe faturamento real quando receitaFormatada tem valor', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'occupied', receitaFormatada: 'R$ 3.500/mês' }} />);
    expect(screen.getByText('R$ 3.500/mês')).toBeInTheDocument();
  });

  it('exibe label Faturamento para placa ocupada com receita', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'occupied', receitaFormatada: 'R$ 4.200/mês' }} />);
    expect(screen.getByText(/Faturamento/)).toBeInTheDocument();
  });

  it('exibe label Potencial para placa disponivel com receita estimada', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'available', receitaFormatada: 'R$ 2.000/mês' }} />);
    expect(screen.getByText(/Potencial/)).toBeInTheDocument();
  });

  // ── Coordenadas / GPS ──────────────────────────────────────────────────────────

  it('exibe coordenadas GPS quando latitude e longitude estao presentes', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, latitude: -3.742352, longitude: -38.608361 }} />);
    expect(screen.getByText(/-3\.742352/)).toBeInTheDocument();
  });

  it('exibe "Sem GPS" quando coordenadas estao ausentes', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, latitude: null, longitude: null }} />);
    expect(screen.getByText('Sem GPS')).toBeInTheDocument();
  });

  it('exibe "Sem GPS" para board sem campos de coordenadas', () => {
    render(<BoardOperationalCard board={baseBoard} />);
    expect(screen.getByText('Sem GPS')).toBeInTheDocument();
  });

  // ── Ações — ver no mapa não dispara edição ─────────────────────────────────────

  it('botao ver no mapa nao chama onSelect', () => {
    const onSelect = vi.fn();
    render(<BoardOperationalCard board={baseBoard} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /ver no mapa/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('botao ver no mapa nao chama onEdit', () => {
    const onEdit = vi.fn();
    render(<BoardOperationalCard board={baseBoard} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /ver no mapa/i }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('botao acao primaria chama onSelect', () => {
    const onSelect = vi.fn();
    render(<BoardOperationalCard board={baseBoard} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /criar proposta/i }));
    expect(onSelect).toHaveBeenCalledWith(baseBoard);
  });

  it('botao editar chama onEdit quando onEdit fornecido', () => {
    const onEdit = vi.fn();
    render(<BoardOperationalCard board={baseBoard} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /editar placa/i }));
    expect(onEdit).toHaveBeenCalledWith(baseBoard);
  });

  it('botao editar nao aparece quando onEdit nao fornecido', () => {
    render(<BoardOperationalCard board={baseBoard} />);
    expect(screen.queryByRole('button', { name: /editar placa/i })).toBeNull();
  });

  // ── Card em manutenção ─────────────────────────────────────────────────────────

  it('card em manutencao exibe badge e acao de historico', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'maintenance' }} />);
    expect(screen.getByText('Manutenção')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver histórico/i })).toBeInTheDocument();
  });

  it('card em manutencao nao exibe bloco comercial — sem dado real', () => {
    // maintenance nao tem contexto comercial; bloco nao deve ocupar espaco
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'maintenance', cliente: 'Acme', receitaFormatada: 'R$ 1.000/mês' }} />);
    expect(screen.queryByText('Cliente atual')).toBeNull();
    expect(screen.queryByText('Acme')).toBeNull();
    expect(screen.queryByText(/Faturamento/)).toBeNull();
    expect(screen.queryByText(/Potencial/)).toBeNull();
  });

  // ── Hierarquia visual — título fora da imagem ──────────────────────────────────

  it('exibe codigo como titulo principal no bloco de identidade', () => {
    render(<BoardOperationalCard board={baseBoard} />);
    const title = screen.getByTestId('plate-title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('PL-001');
  });

  it('exibe codigo como titulo mesmo quando nome esta definido', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, nome: 'Placa Shopping Centro' }} />);
    expect(screen.getByTestId('plate-title')).toHaveTextContent('PL-001');
  });

  it('exibe "Sem identificação" quando codigo e nome sao ambos nulos', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, nome: null, codigo: null }} />);
    expect(screen.getByTestId('plate-title')).toHaveTextContent('Sem identificação');
  });

  it('titulo nao quebra com codigo muito longo', () => {
    const codigoGigante = 'A'.repeat(300);
    render(<BoardOperationalCard board={{ ...baseBoard, codigo: codigoGigante }} />);
    expect(screen.getByTestId('plate-title')).toHaveTextContent(codigoGigante.slice(0, 20));
  });

  it('titulo tem atributo title para tooltip com texto completo', () => {
    render(<BoardOperationalCard board={baseBoard} />);
    expect(screen.getByTestId('plate-title')).toHaveAttribute('title', 'PL-001');
  });

  it('badge de status continua visivel sobre a imagem', () => {
    render(<BoardOperationalCard board={{ ...baseBoard, status: 'occupied' }} />);
    expect(screen.getByText('Ocupado')).toBeInTheDocument();
  });

  // ── Bloqueio operacional ─────────────────────────────────────────────────────

  it('nao exibe secao de bloqueio operacional quando operationalBlock ausente', () => {
    render(<BoardOperationalCard board={baseBoard} />);
    expect(screen.queryByTestId('operational-block')).toBeNull();
    expect(screen.queryByText('Alocação bloqueada')).toBeNull();
  });

  it('exibe label, badge "Alocação bloqueada", equipe e observacao quando operationalBlock presente', () => {
    render(<BoardOperationalCard board={{
      ...baseBoard,
      operationalBlock: {
        operationId: 'op-1',
        operationType: 'INSTALLATION',
        operationStatus: 'PENDING',
        label: 'Pendente de instalação',
        assignedTo: 'Equipe Norte',
        notes: 'Aguardando liberação de acesso.',
      },
    }} />);

    const block = screen.getByTestId('operational-block');
    expect(block).toBeInTheDocument();
    expect(screen.getByText('Pendente de instalação')).toBeInTheDocument();
    expect(screen.getByText('Alocação bloqueada')).toBeInTheDocument();
    expect(screen.getByText('Equipe Norte')).toBeInTheDocument();
    expect(screen.getByText('Aguardando liberação de acesso.')).toBeInTheDocument();
  });

  it('omite equipe e observacao quando ausentes no operationalBlock', () => {
    render(<BoardOperationalCard board={{
      ...baseBoard,
      operationalBlock: {
        operationId: 'op-2',
        operationType: 'SCRAPING',
        operationStatus: 'IN_PROGRESS',
        label: 'Raspagem em andamento',
        assignedTo: null,
        notes: null,
      },
    }} />);

    expect(screen.getByTestId('operational-block')).toBeInTheDocument();
    expect(screen.getByText('Raspagem em andamento')).toBeInTheDocument();
    expect(screen.getByText('Alocação bloqueada')).toBeInTheDocument();
    expect(screen.queryByText('Equipe Norte')).toBeNull();
  });

  it('exibe bloqueio operacional mesmo em placas disponiveis (sem bloco comercial)', () => {
    render(<BoardOperationalCard board={{
      ...baseBoard,
      status: 'available',
      operationalBlock: {
        operationId: 'op-3',
        operationType: 'MAINTENANCE',
        operationStatus: 'PENDING',
        label: 'Manutenção pendente',
        assignedTo: null,
        notes: null,
      },
    }} />);

    expect(screen.getByTestId('operational-block')).toBeInTheDocument();
    expect(screen.getByText('Manutenção pendente')).toBeInTheDocument();
  });

  it('exibe equipe responsável (teamSnapshot) quando operationalBlock a fornece', () => {
    render(<BoardOperationalCard board={{
      ...baseBoard,
      operationalBlock: {
        operationId: 'op-4',
        operationType: 'SCRAPING',
        operationStatus: 'IN_PROGRESS',
        label: 'Raspagem em andamento',
        assignedTo: null,
        notes: null,
        teamSnapshot: { id: 'team-1', name: 'Equipe Fortaleza 01', memberCount: 3, members: [] },
      },
    }} />);

    expect(screen.getByTestId('operational-block')).toBeInTheDocument();
    expect(screen.getByText('Equipe: Equipe Fortaleza 01 · 3 integrantes')).toBeInTheDocument();
  });
});
