import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import AuditEventDetails from './AuditEventDetails';
import AuditFilters from './AuditFilters';
import AuditTimeline from './AuditTimeline';
import { describeAuditEvent } from './AuditEventCard';

describe('Audit UI', () => {
  it('gestor ve timeline de auditoria', () => {
    const html = renderToString(
      <AuditTimeline
        events={[
          {
            _id: 'audit-1',
            actorName: 'Joao',
            action: 'entity.updated',
            module: 'placas',
            entityLabel: 'Placa A',
            severity: 'info',
            createdAt: '2026-05-15T10:00:00.000Z',
          },
        ]}
      />,
    );

    expect(html).toContain('Joao alterou Placa A');
    expect(html).toContain('placas');
  });

  it('renderiza filtros basicos', () => {
    const html = renderToString(<AuditFilters filters={{}} onChange={vi.fn()} />);

    expect(html).toContain('Todos os modulos');
    expect(html).toContain('Acao');
    expect(html).toContain('Todas severidades');
  });

  it('evento sem before/after nao quebra detalhe', () => {
    const html = renderToString(
      <AuditEventDetails event={{ _id: 'audit-2', actorEmail: 'maria@example.com', module: 'sync' }} />,
    );

    expect(html).toContain('maria@example.com');
    expect(html).toContain('Sem dados');
  });

  it('nao mostra dados sensiveis no detalhe', () => {
    const html = renderToString(
      <AuditEventDetails
        event={{
          _id: 'audit-3',
          before: { password: 'secret', nome: 'Carlos' },
          after: { token: 'jwt', email: 'carlos@example.com' },
          metadata: { authorization: 'Bearer token', action: 'update' },
        }}
      />,
    );

    expect(html).toContain('Carlos');
    expect(html).toContain('carlos@example.com');
    expect(html).toContain('update');
    expect(html).not.toContain('secret');
    expect(html).not.toContain('Bearer token');
  });

  it('gera linguagem humana para sync diagnostics', () => {
    expect(describeAuditEvent({
      actorName: 'Carlos',
      action: 'sensitive.access',
      module: 'sync',
    })).toContain('Carlos acessou diagnosticos do Sync');
  });
});
