/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  getCanonicalizationReport,
  getOperationLinkResolutionContext,
  resolveOperationPlateLink,
  runOperationPlateBackfill,
} from '../../../services/operationAdminService.js';
import { listBoards } from '../../../services/inventoryV4Service.js';
import OperationCanonicalizationCard, { getCanonicalizationStatus } from './OperationCanonicalizationCard.jsx';

vi.mock('../../../services/operationAdminService.js', () => ({
  getCanonicalizationReport: vi.fn(),
  getOperationLinkResolutionContext: vi.fn(),
  resolveOperationPlateLink: vi.fn(),
  runOperationPlateBackfill: vi.fn(),
}));

vi.mock('../../../services/inventoryV4Service.js', () => ({
  listBoards: vi.fn(),
}));

const healthyReport = {
  totalOperations: 100,
  canonicalOperations: 98,
  legacyOnlyOperations: 1,
  unresolvedOperations: 1,
  ambiguousOperations: 0,
  canonicalizationRate: 98,
  legacyRate: 1,
  unresolvedRate: 1,
  byOperationType: {
    INSTALLATION: { total: 10, canonical: 9, legacyOnly: 1, unresolved: 0, ambiguous: 0 },
  },
  byOperationStatus: {
    PENDING: { total: 20, canonical: 18, legacyOnly: 1, unresolved: 1, ambiguous: 0 },
  },
  samples: {
    unresolved: [{ id: 'op-unresolved', title: 'Sem placa', type: 'OTHER', status: 'PENDING', reason: 'no-safe-match' }],
    legacyOnly: [],
    ambiguous: [],
  },
};

describe('OperationCanonicalizationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifica status saudavel, atencao e critico', () => {
    expect(getCanonicalizationStatus(95)).toMatchObject({ label: 'Saudável', variant: 'success' });
    expect(getCanonicalizationStatus(75)).toMatchObject({ label: 'Atenção', variant: 'warning' });
    expect(getCanonicalizationStatus(74)).toMatchObject({ label: 'Crítico', variant: 'danger' });
  });

  it('renderiza metricas do relatorio', async () => {
    getCanonicalizationReport.mockResolvedValueOnce(healthyReport);

    render(<OperationCanonicalizationCard canRunBackfill />);

    expect(await screen.findByText('Saúde operacional')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('Canônicas')).toBeInTheDocument();
    expect(screen.getByText('Legado-only')).toBeInTheDocument();
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
    expect(screen.getByText('Ambiguous')).toBeInTheDocument();
    expect(screen.getByText('Taxa legado')).toBeInTheDocument();
    expect(screen.getByText('Taxa unresolved')).toBeInTheDocument();
    expect(screen.getByText('Breakdown por tipo')).toBeInTheDocument();
    expect(screen.getByText('Breakdown por status')).toBeInTheDocument();
    expect(screen.getByText('Exemplos unresolved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rodar backfill' })).toBeInTheDocument();
  });

  it('mostra ambiguous e aviso de correcao manual', async () => {
    getCanonicalizationReport.mockResolvedValueOnce({
      ...healthyReport,
      ambiguousOperations: 2,
      samples: {
        ...healthyReport.samples,
        ambiguous: [{ id: 'op-amb', title: 'Duplicada', type: 'INSTALLATION', status: 'PENDING', reason: 'ambiguous-plateNumber' }],
      },
    });

    render(<OperationCanonicalizationCard canRunBackfill />);

    expect(await screen.findByText('Ambiguous')).toBeInTheDocument();
    expect(screen.getByText(/correcao manual/i)).toBeInTheDocument();
    expect(screen.getByText('Exemplos ambiguous')).toBeInTheDocument();
  });

  it('abre modal de resolucao ao clicar Resolver', async () => {
    getCanonicalizationReport.mockResolvedValueOnce({
      ...healthyReport,
      samples: {
        ...healthyReport.samples,
        unresolved: [{ operationId: 'op-1', title: 'Sem placa', operationType: 'OTHER', status: 'PENDING', reason: 'no-safe-match' }],
      },
    });
    getOperationLinkResolutionContext.mockResolvedValueOnce({
      operation: { operationId: 'op-1', title: 'Sem placa', operationType: 'OTHER', status: 'PENDING' },
      candidates: [],
      reason: 'no-safe-match',
      legacyFields: {},
    });

    render(<OperationCanonicalizationCard canRunBackfill />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resolver' }));

    expect(await screen.findByRole('dialog', { name: 'Resolver vinculo de placa' })).toBeInTheDocument();
    expect(screen.getByText('Esta acao sera auditada e nao remove os campos legados.')).toBeInTheDocument();
    expect(getOperationLinkResolutionContext).toHaveBeenCalledWith('op-1');
  });

  it('busca placa, exige motivo e envia resolucao manual', async () => {
    getCanonicalizationReport
      .mockResolvedValueOnce({
        ...healthyReport,
        samples: {
          ...healthyReport.samples,
          unresolved: [{ operationId: 'op-2', title: 'Sem placa', operationType: 'OTHER', status: 'PENDING' }],
        },
      })
      .mockResolvedValueOnce({ ...healthyReport, unresolvedOperations: 0, canonicalOperations: 99 });
    getOperationLinkResolutionContext.mockResolvedValueOnce({
      operation: { operationId: 'op-2', title: 'Sem placa', operationType: 'OTHER', status: 'PENDING' },
      candidates: [],
      reason: 'no-safe-match',
      legacyFields: {},
    });
    listBoards.mockResolvedValueOnce([{ id: 'plate-1', codigo: 'PL-1', localizacao: 'Rua A' }]);
    resolveOperationPlateLink.mockResolvedValueOnce({ task: { id: 'op-2' } });

    render(<OperationCanonicalizationCard canRunBackfill />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resolver' }));
    await screen.findByRole('dialog', { name: 'Resolver vinculo de placa' });
    fireEvent.change(screen.getByPlaceholderText('Codigo ou localizacao'), { target: { value: 'PL-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('option', { name: 'PL-1 - Rua A' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'plate-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular placa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o motivo da correcao.');

    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo da correcao' }), { target: { value: 'Conferencia manual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular placa' }));

    await waitFor(() => expect(resolveOperationPlateLink).toHaveBeenCalledWith('op-2', {
      plateId: 'plate-1',
      reason: 'Conferencia manual',
    }));
    await waitFor(() => expect(getCanonicalizationReport).toHaveBeenCalledTimes(2));
  });

  it('mostra erro do submit no modal', async () => {
    getCanonicalizationReport.mockResolvedValueOnce({
      ...healthyReport,
      samples: {
        ...healthyReport.samples,
        unresolved: [{ operationId: 'op-3', title: 'Sem placa', operationType: 'OTHER', status: 'PENDING' }],
      },
    });
    getOperationLinkResolutionContext.mockResolvedValueOnce({
      operation: { operationId: 'op-3', title: 'Sem placa', operationType: 'OTHER', status: 'PENDING' },
      candidates: [{ plateId: 'plate-1', plateNumber: 'PL-1', address: 'Rua A' }],
      reason: 'no-safe-match',
      legacyFields: {},
    });
    resolveOperationPlateLink.mockRejectedValueOnce(new Error('Falha ao vincular'));

    render(<OperationCanonicalizationCard canRunBackfill />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resolver' }));
    await screen.findByRole('dialog', { name: 'Resolver vinculo de placa' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Motivo da correcao' }), { target: { value: 'Conferencia manual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular placa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao vincular');
  });

  it('recarrega relatorio pelo botao atualizar', async () => {
    getCanonicalizationReport
      .mockResolvedValueOnce({ ...healthyReport, canonicalizationRate: 80 })
      .mockResolvedValueOnce({ ...healthyReport, canonicalizationRate: 99 });

    render(<OperationCanonicalizationCard canRunBackfill />);

    expect(await screen.findByText('80%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar relatório' }));

    await waitFor(() => expect(getCanonicalizationReport).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('99%')).toBeInTheDocument();
  });

  it('executa backfill, exibe resultado e recarrega relatorio', async () => {
    getCanonicalizationReport
      .mockResolvedValueOnce({ ...healthyReport, canonicalizationRate: 76 })
      .mockResolvedValueOnce({ ...healthyReport, canonicalizationRate: 96 });
    runOperationPlateBackfill.mockResolvedValueOnce({
      totalAnalyzed: 5,
      updated: 2,
      skippedAlreadyCanonical: 2,
      unresolved: 1,
      ambiguous: 1,
      matchedByLegacyId: 1,
      matchedByPlateNumber: 1,
      errors: [],
    });

    render(<OperationCanonicalizationCard canRunBackfill />);

    await screen.findByText('76%');
    fireEvent.click(screen.getByRole('button', { name: 'Rodar backfill' }));

    expect(await screen.findByText('Backfill concluído')).toBeInTheDocument();
    expect(screen.getByText('2 atualizadas')).toBeInTheDocument();
    expect(screen.getByText('1 ambiguous')).toBeInTheDocument();
    expect(screen.getByText('1 por ID legado')).toBeInTheDocument();
    expect(screen.getByText('1 por numero')).toBeInTheDocument();
    await waitFor(() => expect(getCanonicalizationReport).toHaveBeenCalledTimes(2));
    expect(runOperationPlateBackfill).toHaveBeenCalledTimes(1);
  });

  it('oculta backfill quando usuario nao e admin', async () => {
    getCanonicalizationReport.mockResolvedValueOnce(healthyReport);

    render(<OperationCanonicalizationCard canRunBackfill={false} />);

    await screen.findByText('98%');
    expect(screen.queryByRole('button', { name: 'Rodar backfill' })).not.toBeInTheDocument();
  });

  it('mostra estado de erro quando API falha', async () => {
    getCanonicalizationReport.mockRejectedValueOnce(new Error('Falha no relatorio'));

    render(<OperationCanonicalizationCard canRunBackfill />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha no relatorio');
  });
});
