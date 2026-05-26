import { memo } from 'react';

function V4ErrorState({
  title = 'Não foi possível carregar',
  message = 'Ocorreu um problema ao buscar os dados. Tente novamente.',
  onRetry,
  compact = false,
}) {
  return (
    <div className={`v4p-state-block v4p-state-block--error${compact ? ' v4p-state-block--compact' : ''}`}>
      <span aria-hidden="true" className="material-symbols-rounded v4p-state-block__icon">
        error_outline
      </span>
      <div className="v4p-state-block__body">
        <div className="v4p-state-block__title">{title}</div>
        {message && <p className="v4p-state-block__message">{message}</p>}
      </div>
      {onRetry && (
        <button className="v4p-action-button v4p-action-button--sm v4p-action-button--secondary" onClick={onRetry}>
          <span aria-hidden="true" className="material-symbols-rounded">refresh</span>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export default memo(V4ErrorState);
