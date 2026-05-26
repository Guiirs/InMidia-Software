import { memo } from 'react';

function RenewalCard({ opp }) {
  const chanceColor = opp.chance >= 0.8 ? 'var(--v4p-success)' : opp.chance >= 0.6 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';
  const isExpansao = opp.crescimento !== '0%';

  return (
    <div className="v4p-surface-card v4p-accent-card v4p-accent-card--stack" style={{ '--v4p-accent-dynamic': chanceColor }}>
      <div className="v4p-card-header">
        <span className="v4p-list-item__title">{opp.cliente}</span>
        {isExpansao && <span className="v4p-chip v4p-chip--sm v4p-chip--success">expansao</span>}
      </div>
      <div className="v4p-card-header">
        <span className="v4p-value-stack__main">{opp.potencial}</span>
        <span className="v4p-progress-row__value" style={{ '--v4p-accent-dynamic': isExpansao ? 'var(--v4p-success)' : 'var(--v4p-text-4)' }}>{opp.crescimento}</span>
      </div>
      <div className="v4p-list-item__note">{opp.expansao}</div>
      <div className="v4p-progress-row" style={{ '--v4p-progress': `${opp.chance * 100}%`, '--v4p-accent-dynamic': chanceColor, '--v4p-progress-h': '3px' }}>
        <div className="v4p-progress-row__track">
          <div className="v4p-progress-row__fill" />
        </div>
        <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': chanceColor, '--v4p-pill-border': `color-mix(in srgb, ${chanceColor} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${chanceColor} 12%, transparent)` }}>{Math.round(opp.chance * 100)}% chance</span>
        <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">em {opp.prazo}</span>
      </div>
    </div>
  );
}

function RenewalOpportunities({ opportunities = [] }) {
  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-medium-panel__title-row">
          <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded" style={{ color: 'var(--v4p-success)' }}>autorenew</span>
          <div>
            <div className="v4p-card-title">Oportunidades de renovacao</div>
            <div className="v4p-card-subtitle">{opportunities.length} contratos com potencial de renovacao</div>
          </div>
        </div>
      </div>
      <div className="v4p-medium-grid" style={{ '--v4p-grid-min': '200px' }}>
        {opportunities.length === 0 && (
          <div className="v4p-list-item__copy">Nenhuma oportunidade de renovacao encontrada.</div>
        )}
        {opportunities.map(opp => <RenewalCard key={opp.cliente} opp={opp} />)}
      </div>
    </div>
  );
}

export default memo(RenewalOpportunities);
