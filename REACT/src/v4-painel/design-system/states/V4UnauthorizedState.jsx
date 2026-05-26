import { memo } from 'react';

function V4UnauthorizedState({
  title = 'Acesso restrito',
  message = 'Você não tem permissão para visualizar esta seção.',
  compact = false,
}) {
  return (
    <div className={`v4p-state-block v4p-state-block--unauthorized${compact ? ' v4p-state-block--compact' : ''}`}>
      <span aria-hidden="true" className="material-symbols-rounded v4p-state-block__icon">
        lock
      </span>
      <div className="v4p-state-block__body">
        <div className="v4p-state-block__title">{title}</div>
        {message && <p className="v4p-state-block__message">{message}</p>}
      </div>
    </div>
  );
}

export default memo(V4UnauthorizedState);
