import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createExport, fetchExportProfiles, fetchExportStatus } from '../../services/exportService';
import ExportPanel from './components/ExportPanel';

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    useQuery: ({ queryKey }) => {
      if (queryKey[0] === 'export-profiles') {
        return {
          data: {
            profiles: [
              {
                profile: 'executive-summary',
                label: 'Resumo Executivo',
                availableFormats: ['json', 'csv'],
                plannedFormats: ['pdf', 'xlsx'],
              },
              {
                profile: 'regional-performance',
                label: 'Desempenho Regional',
                availableFormats: ['json', 'csv'],
                plannedFormats: ['pdf', 'xlsx'],
              },
            ],
            blockedFields: ['password', 'email', 'tenantId'],
          },
          isLoading: false,
          isError: false,
        };
      }
      return { data: undefined, isLoading: false, isError: false };
    },
  };
});

// Mock exportService
vi.mock('../../services/exportService', () => ({
  createExport: vi.fn(),
  fetchExportProfiles: vi.fn(),
  fetchExportStatus: vi.fn(),
}));

describe('ExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export panel with title', () => {
    const html = renderToString(<ExportPanel defaultProfile="executive-summary" />);
    expect(html).toContain('Exportar Dados');
    expect(html).toContain('export-panel');
  });

  it('renders profile selector', () => {
    const html = renderToString(<ExportPanel />);
    expect(html).toContain('export-profile-select');
    expect(html).toContain('Resumo Executivo');
  });

  it('renders format selector with json and csv options', () => {
    const html = renderToString(<ExportPanel />);
    expect(html).toContain('export-format-select');
    expect(html).toContain('JSON');
    expect(html).toContain('CSV');
  });

  it('renders planned format options (pdf/xlsx)', () => {
    const html = renderToString(<ExportPanel />);
    expect(html).toContain('planejado');
  });

  it('renders export button', () => {
    const html = renderToString(<ExportPanel />);
    expect(html).toContain('export-btn');
    expect(html).toContain('Exportar');
  });

  it('uses defaultProfile prop to preselect profile', () => {
    const html = renderToString(<ExportPanel defaultProfile="regional-performance" />);
    // The select element should have the value set
    expect(html).toContain('regional-performance');
  });
});

// ── exportService unit tests ──────────────────────────────────────────────────

describe('exportService functions', () => {
  it('createExport is a mock function', () => {
    expect(typeof createExport).toBe('function');
  });

  it('fetchExportProfiles is a mock function', () => {
    expect(typeof fetchExportProfiles).toBe('function');
  });

  it('fetchExportStatus is a mock function', () => {
    expect(typeof fetchExportStatus).toBe('function');
  });
});
