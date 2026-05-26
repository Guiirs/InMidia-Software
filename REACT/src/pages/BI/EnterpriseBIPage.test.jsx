import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import BIEmptyState from './components/BIEmptyState';
import BIErrorState from './components/BIErrorState';
import ExecutiveSummaryCards from './components/ExecutiveSummaryCards';
import RegionalPerformanceTable from './components/RegionalPerformanceTable';
import InventoryHealthPanel from './components/InventoryHealthPanel';
import QualityOverviewPanel from './components/QualityOverviewPanel';
import GovernanceOverviewPanel from './components/GovernanceOverviewPanel';
import {
  formatPercent,
  formatScore,
  formatCount,
  availabilityLabel,
  severityLabel,
  metricValue,
  scoreClass,
  formatDate,
} from './utils/biFormatters';

// ─── biFormatters ──────────────────────────────────────────────────────────────

describe('biFormatters', () => {
  describe('formatPercent', () => {
    it('formats number with one decimal place', () => {
      expect(formatPercent(87.654)).toBe('87.7%');
    });

    it('formats 0', () => {
      expect(formatPercent(0)).toBe('0.0%');
    });

    it('returns — for null', () => {
      expect(formatPercent(null)).toBe('—');
    });

    it('returns — for undefined', () => {
      expect(formatPercent(undefined)).toBe('—');
    });
  });

  describe('formatScore', () => {
    it('rounds to integer', () => {
      expect(formatScore(92.6)).toBe('93');
    });

    it('returns — for null', () => {
      expect(formatScore(null)).toBe('—');
    });
  });

  describe('formatCount', () => {
    it('formats whole number', () => {
      expect(formatCount(1234)).toBe('1.234');
    });

    it('returns — for null', () => {
      expect(formatCount(null)).toBe('—');
    });
  });

  describe('availabilityLabel', () => {
    it('maps available correctly', () => {
      expect(availabilityLabel('available')).toBe('Disponível');
    });

    it('maps unavailable correctly', () => {
      expect(availabilityLabel('unavailable')).toBe('Indisponível');
    });

    it('returns — for null', () => {
      expect(availabilityLabel(null)).toBe('—');
    });

    it('returns raw value for unknown', () => {
      expect(availabilityLabel('custom')).toBe('custom');
    });
  });

  describe('severityLabel', () => {
    it('maps critical correctly', () => {
      expect(severityLabel('critical')).toBe('Crítico');
    });

    it('returns — for null', () => {
      expect(severityLabel(null)).toBe('—');
    });
  });

  describe('metricValue', () => {
    const metrics = [
      { key: 'total_placas', value: 150 },
      { key: 'quality_score', value: 85 },
    ];

    it('returns value by key', () => {
      expect(metricValue(metrics, 'total_placas')).toBe(150);
    });

    it('returns null for missing key', () => {
      expect(metricValue(metrics, 'missing')).toBeNull();
    });

    it('returns null for non-array', () => {
      expect(metricValue(null, 'key')).toBeNull();
    });
  });

  describe('scoreClass', () => {
    it('returns good for score >= 80', () => {
      expect(scoreClass(80)).toBe('good');
      expect(scoreClass(100)).toBe('good');
    });

    it('returns warning for 50–79', () => {
      expect(scoreClass(65)).toBe('warning');
    });

    it('returns critical for < 50', () => {
      expect(scoreClass(30)).toBe('critical');
    });

    it('returns unknown for null', () => {
      expect(scoreClass(null)).toBe('unknown');
    });
  });

  describe('formatDate', () => {
    it('returns — for null', () => {
      expect(formatDate(null)).toBe('—');
    });

    it('formats a valid ISO string', () => {
      const result = formatDate('2026-05-18T12:00:00.000Z');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(5);
    });
  });
});

// ─── BIEmptyState ──────────────────────────────────────────────────────────────

describe('BIEmptyState', () => {
  it('renders empty state message', () => {
    const html = renderToString(<BIEmptyState />);
    expect(html).toContain('Dados BI ainda n');
    expect(html).toContain('bi-empty-state');
  });
});

// ─── BIErrorState ──────────────────────────────────────────────────────────────

describe('BIErrorState', () => {
  it('renders error message from prop', () => {
    const html = renderToString(
      <BIErrorState error={{ message: 'Falha de rede' }} />,
    );
    expect(html).toContain('Falha de rede');
  });

  it('renders default message when error is null', () => {
    const html = renderToString(<BIErrorState error={null} />);
    expect(html).toContain('Erro ao carregar dados BI');
  });
});

// ─── ExecutiveSummaryCards ─────────────────────────────────────────────────────

describe('ExecutiveSummaryCards', () => {
  it('renders empty panel when dataset is null', () => {
    const html = renderToString(<ExecutiveSummaryCards dataset={null} />);
    expect(html).toContain('bi-executive-cards');
    expect(html).toContain('indispon');
  });

  it('renders KPI cards when dataset has metrics', () => {
    const dataset = {
      metrics: [
        { key: 'total_placas', value: 500 },
        { key: 'occupancyRate', value: 72.5 },
        { key: 'qualityScore', value: 88 },
        { key: 'governanceScore', value: 91 },
      ],
      rows: [],
      completeness: 'complete',
    };
    const html = renderToString(<ExecutiveSummaryCards dataset={dataset} />);
    expect(html).toContain('bi-kpi-card');
    expect(html).toContain('Total de Placas');
  });

  it('shows partial notice when completeness is partial', () => {
    const dataset = { metrics: [], rows: [], completeness: 'partial' };
    const html = renderToString(<ExecutiveSummaryCards dataset={dataset} />);
    expect(html).toContain('parcialmente');
  });
});

// ─── RegionalPerformanceTable ──────────────────────────────────────────────────

describe('RegionalPerformanceTable', () => {
  it('renders empty panel when dataset is null', () => {
    const html = renderToString(<RegionalPerformanceTable dataset={null} />);
    expect(html).toContain('bi-regional-table');
    expect(html).toContain('indispon');
  });

  it('renders table rows when dataset has rows', () => {
    const dataset = {
      rows: [
        {
          regiaoId: 'r-1',
          label: 'Região Sul',
          availability: 'available',
          occupancyRate: 68,
          qualityScore: 82,
          governanceScore: 75,
          severity: 'low',
        },
      ],
      metrics: [],
    };
    const html = renderToString(<RegionalPerformanceTable dataset={dataset} />);
    expect(html).toContain('Regi');
    expect(html).toContain('bi-table');
  });

  it('renders empty message when rows are empty', () => {
    const html = renderToString(<RegionalPerformanceTable dataset={{ rows: [], metrics: [] }} />);
    expect(html).toContain('Nenhuma regi');
  });
});

// ─── InventoryHealthPanel ──────────────────────────────────────────────────────

describe('InventoryHealthPanel', () => {
  it('renders empty panel when dataset is null', () => {
    const html = renderToString(<InventoryHealthPanel dataset={null} />);
    expect(html).toContain('invent');
    expect(html).toContain('indispon');
  });

  it('renders counts from rows', () => {
    const dataset = {
      rows: [
        { regiaoId: 'r-1', label: 'R1', availability: 'available' },
        { regiaoId: 'r-2', label: 'R2', availability: 'occupied' },
      ],
      metrics: [],
    };
    const html = renderToString(<InventoryHealthPanel dataset={dataset} />);
    expect(html).toContain('inv-total');
    expect(html).toContain('inv-available');
  });
});

// ─── QualityOverviewPanel ──────────────────────────────────────────────────────

describe('QualityOverviewPanel', () => {
  it('renders empty panel when dataset is null', () => {
    const html = renderToString(<QualityOverviewPanel dataset={null} />);
    expect(html).toContain('qualid');
    expect(html).toContain('indispon');
  });

  it('renders score bars for each region', () => {
    const dataset = {
      rows: [
        { regiaoId: 'r-1', label: 'Região Norte', qualityScore: 90, severity: 'low' },
        { regiaoId: 'r-2', label: 'Região Sul', qualityScore: 45, severity: 'high' },
      ],
      metrics: [],
    };
    const html = renderToString(<QualityOverviewPanel dataset={dataset} />);
    expect(html).toContain('score-bar');
    expect(html).toContain('Regi');
  });
});

// ─── GovernanceOverviewPanel ───────────────────────────────────────────────────

describe('GovernanceOverviewPanel', () => {
  it('renders empty panel when dataset is null', () => {
    const html = renderToString(<GovernanceOverviewPanel dataset={null} />);
    expect(html).toContain('govern');
    expect(html).toContain('indispon');
  });

  it('renders governance scores per region', () => {
    const dataset = {
      rows: [
        { regiaoId: 'r-1', label: 'Região Centro', governanceScore: 78, severity: 'medium' },
      ],
      metrics: [],
    };
    const html = renderToString(<GovernanceOverviewPanel dataset={dataset} />);
    expect(html).toContain('score-bar');
    expect(html).toContain('M');
  });
});
