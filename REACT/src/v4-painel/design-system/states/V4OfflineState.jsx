import { memo } from 'react';

function V4OfflineState({
  title = 'Sem conexão',
  message = 'Verifique sua conexão com a internet e tente novamente.',
  compact = false,
}) {
  return (
    <div className={`v4p-state-block v4p-state-block--offline${compact ? ' v4p-state-block--compact' : ''}`}>
      <span aria-hidden="true" className="material-symbols-rounded v4p-state-block__icon">
        cloud_off
      </span>
      <div className="v4p-state-block__body">
        <div className="v4p-state-block__title">{title}</div>
        {message && <p className="v4p-state-block__message">{message}</p>}
      </div>
    </div>
  );
}

export default memo(V4OfflineState);
