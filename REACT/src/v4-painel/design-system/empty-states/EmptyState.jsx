/* Estado vazio para listas, tabelas e seções sem dados */
import { memo } from 'react';
import ActionButton from '../buttons/ActionButton.jsx';

function EmptyState({
  icon = 'inbox',
  title = 'Sem dados disponíveis',
  description,
  action,
  actionLabel = 'Atualizar',
  onAction,
  compact = false,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 8 : 12,
        padding: compact ? '24px 16px' : '48px 24px',
        textAlign: 'center',
      }}
      role="status"
      aria-label={title}
    >
      <span
        aria-hidden="true"
        className="material-symbols-rounded"
        style={{
          fontSize: compact ? 32 : 44,
          color: 'var(--v4p-text-4)',
          opacity: 0.4,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: compact ? 13 : 14,
            fontWeight: 600,
            color: 'var(--v4p-text-3)',
          }}
        >
          {title}
        </p>
        {description && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: compact ? 11 : 12,
              color: 'var(--v4p-text-4)',
              maxWidth: 280,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {(action || onAction) && (
        <ActionButton
          variant="secondary"
          size={compact ? 'sm' : 'md'}
          icon="refresh"
          onClick={onAction}
        >
          {actionLabel}
        </ActionButton>
      )}
    </div>
  );
}

export default memo(EmptyState);
