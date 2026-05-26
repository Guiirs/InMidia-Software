/* Cabeçalho de seção com título, subtítulo e ação opcional */
import { memo } from 'react';

function SectionHeader({ title, subtitle, action, divider = true }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        paddingBottom: divider ? 12 : 0,
        marginBottom: divider ? 16 : 8,
        borderBottom: divider ? '1px solid var(--v4p-border-soft)' : 'none',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2 className="v4p-card-title" style={{ letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        {subtitle && (
          <p className="v4p-card-subtitle" style={{ margin: '3px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export default memo(SectionHeader);
