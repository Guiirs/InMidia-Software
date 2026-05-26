import { memo } from 'react';

function AlertRecommendations({ recommendations = [] }) {
  const safeRecs = Array.isArray(recommendations) ? recommendations : [];

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-medium-panel__title-row">
          <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded" style={{ color: 'var(--v4p-intelligence)' }}>auto_awesome</span>
          <div>
            <div className="v4p-card-title">Recomendações de mitigação</div>
            <div className="v4p-card-subtitle">{safeRecs.length} ações prioritárias identificadas</div>
          </div>
        </div>
        <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-bg': 'var(--v4p-intelligence-soft)', '--v4p-pill-color': 'var(--v4p-intelligence)', '--v4p-pill-border': 'rgba(139,92,246,0.25)' }}>IA ATIVA</span>
      </div>

      {safeRecs.length === 0 ? (
        <div style={{ padding: '16px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Nenhuma recomendação disponível no momento.
        </div>
      ) : (
        <div className="v4p-compact-list v4p-gap-2">
          {safeRecs.map((rec, i) => (
            <div key={rec.id ?? i} className="v4p-accent-card v4p-recommendation-card" style={{ '--v4p-accent-dynamic': rec.cor }}>
              <div className="v4p-icon-tile" style={{ '--v4p-icon-tile-size': '30px' }}>
                <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">{rec.icone}</span>
              </div>
              <div className="v4p-list-item__content">
                <div className="v4p-card-header">
                  <span className="v4p-list-item__title">{rec.titulo}</span>
                  <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': rec.cor, '--v4p-pill-border': `color-mix(in srgb, ${rec.cor} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${rec.cor} 12%, transparent)` }}>{rec.prazo}</span>
                </div>
                <p className="v4p-list-item__copy">{rec.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(AlertRecommendations);
