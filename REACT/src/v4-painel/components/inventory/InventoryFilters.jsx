import { memo } from 'react';

const DEFAULT_FILTER_OPTIONS = {
  regiao:     ['Todas'],
  status:     ['Todos', 'Ocupado', 'Disponivel', 'Manutencao', 'Reservado', 'Critico'],
  categoria:  ['Todas'],
  prioridade: ['Todas', 'Urgente', 'Alta', 'Normal', 'Baixa'],
};

const EMPTY_SUMMARY = { total: 0, ocupadas: 0, disponiveis: 0, manutencao: 0 };

function formatMetric(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toLocaleString('pt-BR') : '0';
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <div className="v4p-inventory-filters__field">
      <label className="v4p-inventory-filters__label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="v4p-inventory-filters__select"
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function InventoryFilters({
  filters,
  onFilterChange,
  onClear,
  onSearch,
  searchValue,
  options         = DEFAULT_FILTER_OPTIONS,
  summary         = EMPTY_SUMMARY,
  hideStatusField  = false,
  hideSummaryStrip = false,
}) {
  const filterOptions = { ...DEFAULT_FILTER_OPTIONS, ...options };
  const compact       = { ...EMPTY_SUMMARY, ...summary };

  return (
    <div className={`v4p-surface-card v4p-inventory-filters${hideStatusField ? ' v4p-inventory-filters--compact' : ''}`}>
      <div className="v4p-inventory-filters__layout">
        <div className="v4p-inventory-filters__controls">
          <div className="v4p-inventory-filters__field v4p-inventory-filters__field--search">
            <label className="v4p-inventory-filters__label">Buscar</label>
            <div className="v4p-inventory-filters__search">
              <span className="v4p-inventory-filters__search-icon material-symbols-rounded" aria-hidden="true">search</span>
              <input
                className="v4p-inventory-filters__search-input"
                type="text"
                placeholder="Código ou localização…"
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          </div>

          <FilterSelect
            label="Região"
            options={filterOptions.regiao}
            value={filters.regiao}
            onChange={(v) => onFilterChange('regiao', v)}
          />
          {!hideStatusField && (
            <FilterSelect
              label="Status"
              options={filterOptions.status}
              value={filters.status}
              onChange={(v) => onFilterChange('status', v)}
            />
          )}
          <FilterSelect
            label="Categoria"
            options={filterOptions.categoria}
            value={filters.categoria}
            onChange={(v) => onFilterChange('categoria', v)}
          />
          <FilterSelect
            label="Prioridade"
            options={filterOptions.prioridade}
            value={filters.prioridade}
            onChange={(v) => onFilterChange('prioridade', v)}
          />

          <button
            type="button"
            onClick={onClear}
            className="v4p-inventory-filters__clear"
          >
            Limpar filtros
          </button>
        </div>

        {!hideSummaryStrip && (
          <div className="v4p-inventory-filters__summary" aria-label="Resumo de ocupação">
            {[
              { l: 'Ocupadas',    v: compact.ocupadas,    c: 'var(--v4p-success)' },
              { l: 'Disponíveis', v: compact.disponiveis, c: 'var(--v4p-accent)'  },
              { l: 'Manutenção',  v: compact.manutencao,  c: 'var(--v4p-warning)' },
            ].map((s) => (
              <div key={s.l} className="v4p-inventory-filters__metric">
                <div className="v4p-inventory-filters__metric-value" style={{ color: s.c }}>{formatMetric(s.v)}</div>
                <div className="v4p-inventory-filters__metric-label">{s.l}</div>
              </div>
            ))}
            <div className="v4p-inventory-filters__divider" aria-hidden="true" />
            <div className="v4p-inventory-filters__metric v4p-inventory-filters__metric--total">
              <div className="v4p-inventory-filters__metric-value">{formatMetric(compact.total)}</div>
              <div className="v4p-inventory-filters__metric-label">Total</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(InventoryFilters);
