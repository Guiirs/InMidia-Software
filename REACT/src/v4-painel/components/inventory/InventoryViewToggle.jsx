import { memo } from 'react';

const VIEWS = [
  { id: 'cards', icon: 'grid_view',  label: 'Cards'  },
  { id: 'table', icon: 'table_rows', label: 'Tabela' },
];

function InventoryViewToggle({ view, onChange }) {
  return (
    <div className="inv-view-toggle" role="group" aria-label="Modo de visualização">
      {VIEWS.map(({ id, icon, label }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            aria-label={label}
            className={`inv-view-toggle__btn${active ? ' inv-view-toggle__btn--active' : ''}`}
          >
            <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default memo(InventoryViewToggle);
