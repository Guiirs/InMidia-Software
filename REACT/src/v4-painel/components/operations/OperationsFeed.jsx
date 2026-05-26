import { memo, useState } from 'react';
import ActionButton from '../../design-system/buttons/ActionButton.jsx';

function FeedItem({ item, isFirst }) {
  return (
    <div
      className={`v4p-list-item v4p-feed-item${isFirst ? ' v4p-feed-item--new' : ''}`}
      style={{ '--v4p-accent-dynamic': item.cor }}
    >
      <div className="v4p-timeline-dot">
        <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">{item.icone}</span>
      </div>

      <div className="v4p-list-item__content">
        <div className="v4p-timeline-title">{item.label}</div>
        <div className="v4p-list-item__copy">
          {item.regiao === 'Todos' ? 'Todas as regiões' : item.regiao}
        </div>
      </div>

      <span className="v4p-list-item__meta">{item.tempo}</span>
    </div>
  );
}

function OperationsFeed({ feed = [], maxItems = 10 }) {
  const [expanded, setExpanded] = useState(false);
  const items = expanded ? feed : feed.slice(0, maxItems);

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-medium-panel__title-row">
          <span className="v4p-medium-panel__live-dot" />
          <div>
            <div className="v4p-card-title">Feed operacional</div>
            <div className="v4p-card-subtitle">Movimentações em tempo real</div>
          </div>
        </div>
        <span className="v4p-chip v4p-chip--sm v4p-chip--success">AO VIVO</span>
      </div>

      {items.length === 0 ? (
        <div className="v4p-empty-state" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Nenhum evento operacional registrado.
        </div>
      ) : (
        <div className="v4p-compact-list">
          {items.map((item, i) => <FeedItem key={item.id ?? i} item={item} isFirst={i === 0} />)}
        </div>
      )}

      {feed.length > maxItems && (
        <ActionButton
          variant="ghost"
          size="sm"
          className="v4p-full-action"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Mostrar menos' : `Ver mais ${feed.length - maxItems} eventos`}
        </ActionButton>
      )}
    </div>
  );
}

export default memo(OperationsFeed);
