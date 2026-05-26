import React from 'react';
import { formatScore, severityLabel, severityColor, scoreClass } from '../utils/biFormatters';

function ScoreBar({ score }) {
  const cls = scoreClass(score);
  const width = score != null ? `${Math.min(100, Math.max(0, score))}%` : '0%';
  return (
    <div className="bi-score-bar" data-testid="score-bar">
      <div
        className={`bi-score-bar__fill bi-score-bar__fill--${cls}`}
        style={{ width }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export default function GovernanceOverviewPanel({ dataset }) {
  if (!dataset) {
    return (
      <div className="bi-governance-panel bi-panel--empty" data-testid="governance-overview-panel">
        <p className="bi-panel__empty">Dados de governança indisponíveis.</p>
      </div>
    );
  }

  const rows = dataset.rows ?? [];

  if (rows.length === 0) {
    return (
      <div className="bi-governance-panel bi-panel--empty" data-testid="governance-overview-panel">
        <p className="bi-panel__empty">Nenhuma região com dados de governança.</p>
      </div>
    );
  }

  return (
    <div className="bi-governance-panel" data-testid="governance-overview-panel">
      {rows.map((row) => (
        <div key={row.regiaoId ?? row.label} className="bi-governance-row">
          <div className="bi-governance-row__header">
            <span className="bi-governance-row__label">{row.label}</span>
            <span
              className="bi-badge"
              style={{ color: severityColor(row.severity) }}
            >
              {severityLabel(row.severity)}
            </span>
          </div>
          <div className="bi-governance-row__score-line">
            <ScoreBar score={row.governanceScore} />
            <span className="bi-governance-row__score-value">{formatScore(row.governanceScore)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
