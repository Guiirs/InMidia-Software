import BoardCard from './BoardCard';

export default function BoardCardGrid({
  items = [],
  compact = false,
  state = 'default',
  className = ''
}) {
  const rootClass = [
    'v4-board-card-grid',
    `v4-board-card-grid--state-${state}`,
    compact ? 'v4-board-card-grid--compact' : '',
    className
  ].filter(Boolean).join(' ');

  if (state === 'loading') {
    return (
      <div className={rootClass}>
        {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
          <article key={index} className="v4-board-card-grid__skeleton" aria-hidden="true">
            <div className="v4-board-card-grid__skeleton-media" />
            <div className="v4-board-card-grid__skeleton-line v4-board-card-grid__skeleton-line--lg" />
            <div className="v4-board-card-grid__skeleton-line" />
            <div className="v4-board-card-grid__skeleton-line v4-board-card-grid__skeleton-line--sm" />
          </article>
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={rootClass}>
        <div className="v4-board-card-grid__feedback v4-board-card-grid__feedback--error">
          Falha ao carregar o inventario visual de placas. Revise a simulacao e tente novamente.
        </div>
      </div>
    );
  }

  if (state === 'empty' || items.length === 0) {
    return (
      <div className={rootClass}>
        <div className="v4-board-card-grid__feedback">
          Nenhuma placa encontrada para os filtros visuais selecionados.
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {items.map((board) => (
        <BoardCard key={board.id} board={board} compact={compact} />
      ))}
    </div>
  );
}
