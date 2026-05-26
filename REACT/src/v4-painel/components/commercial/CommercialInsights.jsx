import { memo } from 'react';

function InsightCard({ insight }) {
  return (
    <div className="v4p-accent-card" style={{ '--v4p-accent-dynamic': insight.cor }}>
      <div className="v4p-icon-tile">
        <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">{insight.icone}</span>
      </div>
      <div className="v4p-list-item__content">
        <div className="v4p-card-header">
          <span className="v4p-list-item__title">{insight.titulo}</span>
          <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': insight.cor, '--v4p-pill-border': `color-mix(in srgb, ${insight.cor} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${insight.cor} 12%, transparent)` }}>
            {insight.tipo}
          </span>
        </div>
        <p className="v4p-list-item__copy">{insight.descricao}</p>
        <span className="v4p-value-stack__main">{insight.impacto}</span>
      </div>
    </div>
  );
}

function CommercialInsights({ insights = [] }) {
  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-medium-panel__title-row">
          <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded" style={{ color: 'var(--v4p-intelligence)' }}>auto_awesome</span>
          <div>
            <div className="v4p-card-title">Inteligencia comercial</div>
            <div className="v4p-card-subtitle">Analise automatica · {insights.length} insights ativos</div>
          </div>
        </div>
        <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-bg': 'var(--v4p-intelligence-soft)', '--v4p-pill-color': 'var(--v4p-intelligence)', '--v4p-pill-border': 'rgba(139,92,246,0.25)' }}>
          IA ATIVA
        </span>
      </div>
      <div className="v4p-medium-grid v4p-medium-grid--2">
        {insights.length === 0 && (
          <div className="v4p-list-item__copy">Nenhuma atividade ou insight comercial encontrado.</div>
        )}
        {insights.map(insight => <InsightCard key={insight.id} insight={insight} />)}
      </div>
    </div>
  );
}

export default memo(CommercialInsights);
