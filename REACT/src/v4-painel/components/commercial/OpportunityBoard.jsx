import { memo, useState } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';
import { getPriorityMeta } from '../../foundation/priorities.js';

const STATUS_ORDER = ['Lead', 'Proposta', 'Negociação', 'Fechamento'];
const STATUS_COLOR = {
  Lead: 'var(--v4p-text-4)',
  Proposta: 'var(--v4p-accent)',
  Negociação: 'var(--v4p-intelligence)',
  Fechamento: 'var(--v4p-warning)',
};

function ChanceBar({ chance }) {
  const color = chance >= 0.75 ? 'var(--v4p-success)' : chance >= 0.5 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';

  return (
    <div className="v4p-progress-row" style={{ '--v4p-progress': `${chance * 100}%`, '--v4p-accent-dynamic': color, '--v4p-progress-h': '3px' }}>
      <div className="v4p-progress-row__track">
        <div className="v4p-progress-row__fill" />
      </div>
      <span className="v4p-progress-row__value">{Math.round(chance * 100)}%</span>
    </div>
  );
}

function OppCard({ opp }) {
  const stateMeta = getStateMeta(opp.estado);
  const priorityMeta = getPriorityMeta(opp.prioridade);
  const statusColor = STATUS_COLOR[opp.status] ?? 'var(--v4p-text-4)';

  return (
    <div
      className="v4p-surface-card v4p-accent-card v4p-accent-card--stack v4p-accent-card--left"
      style={{ '--v4p-accent-dynamic': stateMeta.color }}
    >
      <div className="v4p-card-header">
        <div className="v4p-card-header__body">
          <div className="v4p-list-item__title">{opp.cliente}</div>
          <div className="v4p-list-item__copy">{opp.regiao}</div>
        </div>
        <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': priorityMeta.color, '--v4p-pill-border': `color-mix(in srgb, ${priorityMeta.color} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${priorityMeta.color} 12%, transparent)` }}>
          {priorityMeta.label}
        </span>
      </div>

      <div className="v4p-card-header">
        <span className="v4p-status-pill v4p-status-pill--sm" style={{ '--v4p-pill-color': statusColor, '--v4p-pill-border': `color-mix(in srgb, ${statusColor} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${statusColor} 12%, transparent)` }}>
          {opp.status}
        </span>
        <span className="v4p-value-stack__main">{opp.potencialFmt}</span>
      </div>

      <ChanceBar chance={opp.chance} />

      <div className="v4p-chip-row">
        {opp.tags.map(tag => (
          <span key={tag} className="v4p-chip v4p-chip--sm v4p-chip--neutral">{tag}</span>
        ))}
      </div>

      <div className="v4p-list-item__note">→ {opp.recomendacao}</div>
    </div>
  );
}

function OpportunityBoard({ opportunities = [], onSelect }) {
  const [filterStatus, setFilterStatus] = useState('Todos');
  const statuses = ['Todos', ...STATUS_ORDER];
  const filtered = filterStatus === 'Todos'
    ? opportunities
    : opportunities.filter(o => o.status === filterStatus);
  const totalPotencial = opportunities.reduce((s, o) => s + o.potencial, 0);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div>
          <div className="v4p-card-title">Quadro de oportunidades</div>
          <div className="v4p-card-subtitle">{opportunities.length} oportunidades · potencial {fmt(totalPotencial)}/mes</div>
        </div>
        <div className="v4p-segmented">
          {statuses.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`v4p-segmented__button${filterStatus === status ? ' v4p-segmented__button--active' : ''}`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="v4p-medium-grid" style={{ '--v4p-grid-min': '210px' }}>
        {filtered.length === 0 && (
          <div className="v4p-list-item__copy">Nenhuma oportunidade encontrada.</div>
        )}
        {filtered.map(opp => (
          <button key={opp.id} type="button" className="v4p-comm-card-button" onClick={() => onSelect?.(opp)}>
            <OppCard opp={opp} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(OpportunityBoard);
