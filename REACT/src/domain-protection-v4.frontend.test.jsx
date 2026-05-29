// @vitest-environment jsdom

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizePlaca } from './adapters/placaAdapter.js';
import apiClient from './services/apiClient.js';
import { updateBoard } from './services/inventoryV4Service.js';
import PlacaCard from './components/PlacaCard/PlacaCard.jsx';

vi.mock('./services/apiClient.js', () => ({
  default: {
    request: vi.fn(),
  },
}));

function mockBoardResponse(data) {
  apiClient.request.mockResolvedValueOnce({ data: { success: true, data } });
}

function lastRequest() {
  return apiClient.request.mock.calls.at(-1)?.[0];
}

describe('Domain protection V4.1 frontend', () => {
  beforeEach(() => {
    apiClient.request.mockReset();
  });

  it('Adapter: nao deve expor campos comerciais internos como contrato da Placa', () => {
    const placa = normalizePlaca({
      _id: 'p-1',
      numero_placa: 'FRONT-001',
      disponivel: true,
      statusComercial: 'OCCUPIED',
      valor_mensal: 9999,
      aluguel_ativo: true,
      aluguel_futuro: false,
      statusAluguel: 'alugada',
      cliente_nome: 'Cliente Interno',
      aluguel_data_inicio: '2026-06-01',
      aluguel_data_fim: '2026-06-30',
    });

    expect(placa).not.toHaveProperty('valor_mensal');
    expect(placa).not.toHaveProperty('aluguel_ativo');
    expect(placa).not.toHaveProperty('aluguel_futuro');
    expect(placa).not.toHaveProperty('statusAluguel');
    expect(placa).not.toHaveProperty('cliente_nome');
    expect(placa).not.toHaveProperty('aluguel_data_inicio');
    expect(placa).not.toHaveProperty('aluguel_data_fim');
  });

  it('Service: updateBoard nao deve enviar disponibilidade comercial legada', async () => {
    mockBoardResponse({ id: 'b1', codigo: 'FRONT-EDIT', status: 'occupied', disponivel: false });

    await updateBoard('b1', {
      id: 'b1',
      codigo: 'FRONT-EDIT',
      endereco: 'Rua Fisica',
      status: 'occupied',
      disponivel: false,
      aluguel_ativo: true,
      contratoId: 'ctr-1',
    });

    expect(lastRequest().data).toEqual(expect.objectContaining({
      numero_placa: 'FRONT-EDIT',
      endereco: 'Rua Fisica',
    }));
    expect(lastRequest().data).not.toHaveProperty('disponivel');
    expect(lastRequest().data).not.toHaveProperty('status');
    expect(lastRequest().data).not.toHaveProperty('aluguel_ativo');
    expect(lastRequest().data).not.toHaveProperty('contratoId');
  });

  it('UI: PlacaCard deve preferir estado comercial derivado em vez de Placa.disponivel', () => {
    render(
      <MemoryRouter>
        <PlacaCard
          sequentialNumber={1}
          placa={{
            id: 'p-ui-1',
            numero_placa: 'UI-001',
            nomeDaRua: 'Rua UI',
            regiao: 'Centro',
            disponivel: false,
            temporalStatus: 'CONTRACTED_ACTIVE',
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.queryByText('Manutencao')).not.toBeInTheDocument();
  });
});
