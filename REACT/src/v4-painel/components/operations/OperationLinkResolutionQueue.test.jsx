/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  getOperationLinkResolutionContext,
  getOperationLinkResolutionQueue,
  refreshOperationCanonicalizationDiagnostics,
  resolveOperationPlateLink,
} from '../../../services/operationAdminService.js';
import { listBoards } from '../../../services/inventoryV4Service.js';
import OperationLinkResolutionQueue from './OperationLinkResolutionQueue.jsx';

vi.mock('../../../services/operationAdminService.js', () => ({
  getOperationLinkResolutionContext: vi.fn(),
  getOperationLinkResolutionQueue: vi.fn(),
  refreshOperationCanonicalizationDiagnostics: vi.fn(),
  resolveOperationPlateLink: vi.fn(),
}));

vi.mock('../../../services/inventoryV4Service.js', () => ({
  listBoards: vi.fn(),
}));

const queuePayload = {
  items: [
    {
      operationId: 'op-queue-1',
      reason: 'UNRESOLVED',
      operationType: 'MAINTENANCE',
      operationStatus: 'PENDING',
      priority: 'CRITICAL',
      createdAt: '2026-05-01T00:00:00.000Z',
      ageDays: 23,
      legacyHints: { legacyPlateNumber: 'LEG-1', legacyBoardId: null, addressHint: 'Rua Fila' },
      possibleCandidatesCount: 0,
      lastAttemptAt: '2026-05-02T12:00:00.000Z',
      safeSummary: { title: 'Manutencao sem placa', domain: 'operations' },
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, pages: 1, hasNextPage: false, hasPreviousPage: false },
  summary: { total: 1, unresolved: 1, ambiguous: 0, olderThan7Days: 1, criticalPriority: 1, byOperationType: { MAINTENANCE: 1 } },
};

describe('OperationLinkResolutionQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza fila com contadores e item compacto', async () => {
    getOperationLinkResolutionQueue.mockResolvedValueOnce(queuePayload);

    render(<OperationLinkResolutionQueue />);

    expect(await screen.findByText('Resolucao de vinculos pendentes')).toBeInTheDocument();
    expect(screen.getByText('Manutencao sem placa')).toBeInTheDocument();
    expect(screen.getByText('UNRESOLVED')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('Placa: LEG-1')).toBeInTheDocument();
    expect(screen.getByText('Endereco: Rua Fila')).toBeInTheDocument();
    expect(screen.getByText('Diagnostico 02/05/2026')).toBeInTheDocument();
  });

  it('aplica filtros de status, tipo e busca', async () => {
    getOperationLinkResolutionQueue
      .mockResolvedValueOnce(queuePayload)
      .mockResolvedValueOnce({ ...queuePayload, items: [], summary: { ...queuePayload.summary, total: 0 } })
      .mockResolvedValueOnce({ ...queuePayload, items: [], summary: { ...queuePayload.summary, total: 0 } })
      .mockResolvedValueOnce({ ...queuePayload, items: [], summary: { ...queuePayload.summary, total: 0 } });

    render(<OperationLinkResolutionQueue />);

    await screen.findByText('Manutencao sem placa');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ambiguous' } });
    await waitFor(() => expect(getOperationLinkResolutionQueue).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ambiguous' })));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'MAINTENANCE' } });
    await waitFor(() => expect(getOperationLinkResolutionQueue).toHaveBeenLastCalledWith(expect.objectContaining({ operationType: 'MAINTENANCE' })));

    fireEvent.change(screen.getByPlaceholderText('Placa, endereco ou titulo'), { target: { value: 'Rua' } });
    await waitFor(() => expect(getOperationLinkResolutionQueue).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Rua' })));
  });

  it('mostra empty state sem pendencias', async () => {
    getOperationLinkResolutionQueue.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 1, hasNextPage: false, hasPreviousPage: false },
      summary: { total: 0, unresolved: 0, ambiguous: 0, olderThan7Days: 0, criticalPriority: 0, byOperationType: {} },
    });

    render(<OperationLinkResolutionQueue />);

    expect(await screen.findByText('Nenhuma resolucao pendente')).toBeInTheDocument();
  });

  it('abre modal, resolve e remove item da fila', async () => {
    const onReportRefresh = vi.fn();
    getOperationLinkResolutionQueue
      .mockResolvedValueOnce(queuePayload)
      .mockResolvedValueOnce({
        ...queuePayload,
        items: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 1, hasNextPage: false, hasPreviousPage: false },
        summary: { total: 0, unresolved: 0, ambiguous: 0, olderThan7Days: 0, criticalPriority: 0, byOperationType: {} },
      });
    getOperationLinkResolutionContext.mockResolvedValueOnce({
      operation: { operationId: 'op-queue-1', title: 'Manutencao sem placa', operationType: 'MAINTENANCE', status: 'PENDING' },
      candidates: [],
      reason: 'no-safe-match',
      legacyFields: {},
    });
    listBoards.mockResolvedValueOnce([{ id: 'plate-1', codigo: 'PL-1', localizacao: 'Rua A' }]);
    resolveOperationPlateLink.mockResolvedValueOnce({ task: { id: 'op-queue-1' } });

    render(<OperationLinkResolutionQueue onReportRefresh={onReportRefresh} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resolver' }));
    expect(await screen.findByRole('dialog', { name: 'Resolver vinculo de placa' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Codigo ou localizacao'), { target: { value: 'PL-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('option', { name: 'PL-1 - Rua A' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Placa'), { target: { value: 'plate-1' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo da correcao' }), { target: { value: 'Conferencia manual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular placa' }));

    await waitFor(() => expect(resolveOperationPlateLink).toHaveBeenCalledWith('op-queue-1', {
      plateId: 'plate-1',
      reason: 'Conferencia manual',
    }));
    await waitFor(() => expect(onReportRefresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Nenhuma resolucao pendente')).toBeInTheDocument();
  });

  it('mostra erro da API da fila', async () => {
    getOperationLinkResolutionQueue.mockRejectedValueOnce(new Error('Falha na fila'));

    render(<OperationLinkResolutionQueue />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na fila');
  });

  it('botao atualizar diagnostico chama endpoint e recarrega fila com force refresh', async () => {
    const onReportRefresh = vi.fn();
    getOperationLinkResolutionQueue
      .mockResolvedValueOnce(queuePayload)
      .mockResolvedValueOnce({ ...queuePayload, items: [] });
    refreshOperationCanonicalizationDiagnostics.mockResolvedValueOnce({ updated: 1 });

    render(<OperationLinkResolutionQueue onReportRefresh={onReportRefresh} />);

    await screen.findByText('Manutencao sem placa');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar diagnostico' }));

    await waitFor(() => expect(refreshOperationCanonicalizationDiagnostics).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getOperationLinkResolutionQueue).toHaveBeenLastCalledWith(expect.objectContaining({ forceRefresh: true })));
    expect(onReportRefresh).toHaveBeenCalledTimes(1);
  });
});
