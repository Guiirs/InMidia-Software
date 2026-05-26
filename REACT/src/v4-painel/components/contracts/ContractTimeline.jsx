import { memo } from 'react';

const CAT_COLOR = {
  success: 'var(--v4p-success)',
  warning: 'var(--v4p-warning)',
  danger: 'var(--v4p-danger)',
  info: 'var(--v4p-accent)',
};

function ContractTimeline({ timeline = [] }) {
  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Timeline de contratos</div>
      </div>
      <div className="v4p-timeline">
        {timeline.length === 0 && (
          <div className="v4p-list-item__copy">Nenhum evento de contrato encontrado.</div>
        )}
        {timeline.map(item => {
          const color = CAT_COLOR[item.cat] ?? 'var(--v4p-text-4)';
          return (
            <div key={item.id} className="v4p-timeline-item" style={{ '--v4p-accent-dynamic': color }}>
              <div className="v4p-timeline-dot">
                <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">{item.icone}</span>
              </div>
              <div className="v4p-timeline-content">
                <div className="v4p-timeline-row">
                  <span className="v4p-timeline-title">{item.label}</span>
                  <span className="v4p-timeline-time">{item.tempo}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ContractTimeline);
