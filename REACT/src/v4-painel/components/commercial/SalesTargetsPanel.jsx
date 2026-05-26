import { memo } from 'react';

const EMPTY_TARGETS = {
  metaMensal: 0,
  realizado: 0,
  percentual: 0,
  faltaParaMeta: 0,
  diasRestantes: 0,
  projecaoFinal: 0,
};

const EMPTY_PIPELINE_SUMMARY = {
  taxaConversaoGlobal: 0,
};

function SalesTargetsPanel({ targets = EMPTY_TARGETS, pipelineSummary = EMPTY_PIPELINE_SUMMARY }) {
  const { metaMensal, realizado, percentual, faltaParaMeta, diasRestantes, projecaoFinal } = targets;
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  const pct = Math.round(percentual * 100);
  const color = pct >= 90 ? 'var(--v4p-success)' : pct >= 70 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';
  const projOk = projecaoFinal >= metaMensal * 0.95;

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Metas do mês</div>
      </div>

      <div className="v4p-target-summary">
        <div className="v4p-target-ring" style={{ '--v4p-accent-dynamic': color }}>
          <svg width={72} height={72} viewBox="0 0 80 80" aria-hidden="true">
            <circle cx={40} cy={40} r={33} fill="none" stroke="var(--v4p-border)" strokeWidth={7} />
            <circle
              cx={40}
              cy={40}
              r={33}
              fill="none"
              stroke={color}
              strokeWidth={7}
              strokeDasharray={`${2 * Math.PI * 33 * percentual} ${2 * Math.PI * 33 * (1 - percentual)}`}
              strokeDashoffset={2 * Math.PI * 33 * 0.25}
              strokeLinecap="round"
              className="v4p-target-ring__meter"
            />
          </svg>
          <div className="v4p-target-ring__content">
            <span className="v4p-target-ring__value">{pct}%</span>
            <span className="v4p-target-ring__label">da meta</span>
          </div>
        </div>
        <div className="v4p-list-item__content">
          <div className="v4p-metric">{fmt(realizado)}</div>
          <div className="v4p-card-subtitle">de {fmt(metaMensal)} meta</div>
          <div className="v4p-list-item__note">Faltam {fmt(faltaParaMeta)} em {diasRestantes} dias</div>
        </div>
      </div>

      <div className="v4p-compact-list">
        {[
          { l: 'Projeção final do mês', v: fmt(projecaoFinal), c: projOk ? 'var(--v4p-success)' : 'var(--v4p-warning)' },
          { l: 'Dias restantes', v: `${diasRestantes} dias`, c: 'var(--v4p-text-2)' },
          { l: 'Ritmo diário necessário', v: `${fmt(diasRestantes > 0 ? Math.ceil(faltaParaMeta / diasRestantes) : 0)}/dia`, c: 'var(--v4p-accent)' },
          { l: 'Conversão atual', v: `${(pipelineSummary.taxaConversaoGlobal * 100).toFixed(1)}%`, c: 'var(--v4p-text-2)' },
        ].map(s => (
          <div key={s.l} className="v4p-detail-row">
            <span className="v4p-detail-row__label">{s.l}</span>
            <span className="v4p-detail-row__value" style={{ '--v4p-accent-dynamic': s.c }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(SalesTargetsPanel);
