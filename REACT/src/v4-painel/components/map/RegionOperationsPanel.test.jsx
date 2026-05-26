/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import RegionOperationsPanel from './RegionOperationsPanel.jsx';

describe('RegionOperationsPanel SLA', () => {
  it('mostra badge Atrasada para operacao vencida', () => {
    render(
      <RegionOperationsPanel
        operations={[
          {
            id: 'op-1',
            type: 'MAINTENANCE',
            status: 'PENDING',
            priority: 'HIGH',
            slaStatus: 'OVERDUE',
            slaPriority: 'CRITICAL',
            isOverdue: true,
            overdueMinutes: 90,
            plateNumber: 'PL-1',
            referenceDueAt: '2026-05-24T12:00:00.000Z',
          },
        ]}
        summary={{ total: 1, pending: 1, critical: 1, overdue: 1, dueSoon: 0 }}
      />,
    );

    expect(screen.getByText('Atrasada')).toBeInTheDocument();
    expect(screen.getByText('90 min atraso')).toBeInTheDocument();
  });

  it('mantem empty state honesto sem operacoes', () => {
    render(<RegionOperationsPanel operations={[]} summary={{ total: 0, pending: 0, critical: 0, overdue: 0 }} />);

    expect(screen.getByText('Nenhuma operacao regional pendente.')).toBeInTheDocument();
  });

  it('mostra Sem prazo quando SLA e desconhecido', () => {
    render(
      <RegionOperationsPanel
        operations={[{ id: 'op-2', type: 'OTHER', status: 'PENDING', priority: 'LOW', slaStatus: 'UNKNOWN', plateNumber: 'PL-2' }]}
        summary={{ total: 1, pending: 1, critical: 0, overdue: 0 }}
      />,
    );

    expect(screen.getAllByText('Sem prazo')).toHaveLength(2);
  });
});
