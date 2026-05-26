import { memo } from 'react';

const VIEWS = [
  { id: 'cards', icon: 'grid_view',   label: 'Cards'  },
  { id: 'table', icon: 'table_rows',  label: 'Tabela' },
];

function InventoryViewToggle({ view, onChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      borderRadius: 'var(--v4p-r-md)',
      border: '1px solid var(--v4p-border)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {VIEWS.map(({ id, icon, label }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={label}
            aria-pressed={active}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 28,
              padding: '0 10px',
              border: 0,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--v4p-font)',
              transition: 'background 0.14s, color 0.14s',
              background: active ? 'var(--v4p-accent)' : 'transparent',
              color: active ? '#fff' : 'var(--v4p-text-3)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default memo(InventoryViewToggle);
