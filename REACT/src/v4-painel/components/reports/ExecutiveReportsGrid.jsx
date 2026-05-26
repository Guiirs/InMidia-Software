import { memo, useState } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';
import ActionButton from '../../design-system/buttons/ActionButton.jsx';

function ReportCard({ report, onExport }) {
  const [generating, setGenerating] = useState(false);
  const meta = getStateMeta(report.estado ?? 'healthy');

  const handleExport = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      if (typeof onExport === 'function') {
        await onExport({ type: report.id, format: 'json', filters: {} });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className="v4p-surface-card v4p-report-card"
      style={{
        '--v4p-pill-color': meta.color,
        '--v4p-pill-bg': `color-mix(in srgb, ${meta.color} 12%, transparent)`,
        '--v4p-pill-border': `color-mix(in srgb, ${meta.color} 34%, transparent)`,
      }}
    >
      <div className="v4p-card-header">
        <div className="v4p-card-icon-tile">
          <span aria-hidden="true" className="v4p-icon material-symbols-rounded">{report.icone ?? 'article'}</span>
        </div>
        <div className="v4p-card-header__body">
          <div className="v4p-card-title">{report.label}</div>
          <div className="v4p-card-subtitle">{report.periodo} · {report.ultimaGeracao}</div>
        </div>
        <span className="v4p-status-pill v4p-status-pill--sm v4p-status-pill--table">{meta.label}</span>
      </div>

      <div className="v4p-report-card__insights">
        {(report.insights ?? []).map((ins, i) => (
          <div key={i} className="v4p-report-card__insight">
            <span className="v4p-status-pill__dot v4p-report-card__dot" />
            <span className="v4p-card-subtitle">{ins}</span>
          </div>
        ))}
      </div>

      <div className="v4p-report-card__footer">
        <span className="v4p-card-subtitle">{report.tamanho ?? '—'}</span>
        <ActionButton
          variant="subtle"
          size="sm"
          icon={generating ? 'sync' : 'download'}
          onClick={handleExport}
          loading={generating}
        >
          {generating ? 'Gerando...' : 'Exportar'}
        </ActionButton>
      </div>
    </div>
  );
}

function ExecutiveReportsGrid({ reports = [], onExport }) {
  return (
    <div className="v4p-surface-card v4p-card-compact">
      <div className="v4p-card-title v4p-card-header--divider">
        Relatórios executivos disponíveis
      </div>
      {reports.length === 0 ? (
        <div style={{ padding: '20px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Nenhum relatório executivo disponível. Crie exportações para gerar entradas.
        </div>
      ) : (
        <div className="v4p-report-grid">
          {reports.map((r) => <ReportCard key={r.id} report={r} onExport={onExport} />)}
        </div>
      )}
    </div>
  );
}

export default memo(ExecutiveReportsGrid);
