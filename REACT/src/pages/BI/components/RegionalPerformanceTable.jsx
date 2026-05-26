import React from 'react';
import { formatPercent, formatScore, availabilityLabel, severityLabel, severityColor } from '../utils/biFormatters';

function StatusBadge({ severity }) {
  return (
    <span
      className="bi-badge"
      style={{ color: severityColor(severity) }}
      title={severityLabel(severity)}
    >
      {severityLabel(severity)}
    </span>
  );
}

export default function RegionalPerformanceTable({ dataset }) {
  if (!dataset) {
    return (
      <div className="bi-regional-table bi-panel--empty" data-testid="regional-performance-table">
        <p className="bi-panel__empty">Dados regionais indisponíveis.</p>
      </div>
    );
  }

  const rows = dataset.rows ?? [];

  if (rows.length === 0) {
    return (
      <div className="bi-regional-table bi-panel--empty" data-testid="regional-performance-table">
        <p className="bi-panel__empty">Nenhuma região disponível no snapshot atual.</p>
      </div>
    );
  }

  return (
    <div className="bi-regional-table" data-testid="regional-performance-table">
      <table className="bi-table">
        <thead>
          <tr>
            <th>Região</th>
            <th>Disponibilidade</th>
            <th>Ocupação</th>
            <th>Qualidade</th>
            <th>Governança</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.regiaoId ?? row.label}>
              <td>{row.label}</td>
              <td>{availabilityLabel(row.availability)}</td>
              <td>{formatPercent(row.occupancyRate)}</td>
              <td>{formatScore(row.qualityScore)}</td>
              <td>{formatScore(row.governanceScore)}</td>
              <td><StatusBadge severity={row.severity} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
