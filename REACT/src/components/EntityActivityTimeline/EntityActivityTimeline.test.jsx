import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

let canReadAudit = true;
let mockAuditData = { events: [] };
let mockLoading = false;
let mockError = false;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => canReadAudit,
  }),
}));

vi.mock('../../hooks/useEntityAudit', () => ({
  default: () => ({
    data: mockAuditData,
    isLoading: mockLoading,
    isError: mockError,
  }),
}));

import EntityActivityTimeline, { summarizeEvent } from './EntityActivityTimeline';

beforeEach(() => {
  canReadAudit = true;
  mockAuditData = { events: [] };
  mockLoading = false;
  mockError = false;
});

describe('EntityActivityTimeline', () => {
  it('usuario com audit.read ve timeline', () => {
    mockAuditData = {
      events: [{
        _id: 'audit-1',
        actorName: 'Joao',
        action: 'entity.updated',
        module: 'placas',
        entityType: 'placa',
        entityId: 'placa-a',
        entityLabel: 'Placa A',
        after: { disponivel: false },
        createdAt: '2026-05-15T10:00:00.000Z',
      }],
    };

    const html = renderToString(<EntityActivityTimeline entityType="placa" entityId="placa-a" />);

    expect(html).toContain('Joao alterou Placa A');
    expect(html).toContain('Detalhes');
  });

  it('usuario sem audit.read nao ve timeline', () => {
    canReadAudit = false;

    const html = renderToString(<EntityActivityTimeline entityType="placa" entityId="placa-a" />);

    expect(html).toBe('');
  });

  it('estado vazio funciona', () => {
    const html = renderToString(<EntityActivityTimeline entityType="contrato" entityId="contrato-a" />);

    expect(html).toContain('Ainda não há atividades registradas.');
  });

  it('evento sem before/after nao quebra', () => {
    mockAuditData = {
      events: [{
        _id: 'audit-2',
        actorEmail: 'maria@example.com',
        action: 'entity.created',
        entityType: 'contrato',
        entityId: 'contrato-a',
        createdAt: '2026-05-15T10:00:00.000Z',
      }],
    };

    const html = renderToString(<EntityActivityTimeline entityType="contrato" entityId="contrato-a" />);

    expect(html).toContain('maria@example.com criou contrato-a');
    expect(html).toContain('contrato-a');
  });

  it('resumo ignora chaves sensiveis', () => {
    expect(summarizeEvent({
      before: { password: 'x', nome: 'Ana' },
      metadata: { authorization: 'Bearer y', reason: 'test' },
    })).toBe('Campos: nome, reason');
  });
});
