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

export default function QualityOverviewPanel({ dataset }) {
  if (!dataset) {
    return (
      <div className="bi-quality-panel bi-panel--empty" data-testid="quality-overview-panel">
        <p className="bi-panel__empty">Dados de qualidade indisponíveis.</p>
      </div>
    );
  }

  const rows = dataset.rows ?? [];

  if (rows.length === 0) {
    return (
      <div className="bi-quality-panel bi-panel--empty" data-testid="quality-overview-panel">
        <p className="bi-panel__empty">Nenhuma região com dados de qualidade.</p>
      </div>
    );
  }

  return (
    <div className="bi-quality-panel" data-testid="quality-overview-panel">
      {rows.map((row) => (
        <div key={row.regiaoId ?? row.label} className="bi-quality-row">
          <div className="bi-quality-row__header">
            <span className="bi-quality-row__label">{row.label}</span>
            <span
              className="bi-badge"
              style={{ color: severityColor(row.severity) }}
            >
              {severityLabel(row.severity)}
            </span>
          </div>
          <div className="bi-quality-row__score-line">
            <ScoreBar score={row.qualityScore} />
            <span className="bi-quality-row__score-value">{formatScore(row.qualityScore)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
