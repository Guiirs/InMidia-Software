import { memo } from 'react';

const DEFAULT_FILTER_OPTIONS = {
  regiao:     ['Todas'],
  status:     ['Todos', 'Ocupado', 'Disponivel', 'Manutencao', 'Reservado', 'Critico'],
  categoria:  ['Todas'],
  prioridade: ['Todas', 'Urgente', 'Alta', 'Normal', 'Baixa'],
};

const DEFAULT_FILTERS = { regiao: 'Todas', status: 'Todos', categoria: 'Todas', prioridade: 'Todas' };

function FilterSelect({ ariaLabel, options, value, onChange }) {
  return (
    <div className="inv-toolbar__select-wrap">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="inv-toolbar__select"
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
  options          = DEFAULT_FILTER_OPTIONS,
  summary,         // kept for API compat (not displayed)
  hideStatusField  = false,
  hideSummaryStrip = false, // kept for API compat
}) {
  const filterOptions = { ...DEFAULT_FILTER_OPTIONS, ...options };

  const activeFilterCount = [
    !!searchValue,
    filters.regiao    !== (DEFAULT_FILTERS.regiao),
    filters.status    !== (DEFAULT_FILTERS.status),
    filters.categoria !== (DEFAULT_FILTERS.categoria),
    filters.prioridade !== (DEFAULT_FILTERS.prioridade),
  ].filter(Boolean).length;

  return (
    <div className="inv-toolbar" role="search" aria-label="Filtros de inventário">
      <div className="inv-toolbar__search-wrap">
        <span className="material-symbols-rounded inv-toolbar__search-icon" aria-hidden="true">search</span>
        <input
          className="inv-toolbar__search-input"
          type="search"
          placeholder="Buscar código ou localização…"
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Buscar placas por código ou localização"
        />
        {searchValue && (
          <button
            type="button"
            className="inv-toolbar__search-clear material-symbols-rounded"
            onClick={() => onSearch('')}
            aria-label="Limpar busca"
          >
            close
          </button>
        )}
      </div>

      <div className="inv-toolbar__divider" aria-hidden="true" />

      <div className="inv-toolbar__filters">
        <FilterSelect
          ariaLabel="Filtrar por região"
          options={filterOptions.regiao}
          value={filters.regiao}
          onChange={(v) => onFilterChange('regiao', v)}
        />
        {!hideStatusField && (
          <FilterSelect
            ariaLabel="Filtrar por status"
            options={filterOptions.status}
            value={filters.status}
            onChange={(v) => onFilterChange('status', v)}
          />
        )}
        <FilterSelect
          ariaLabel="Filtrar por categoria"
          options={filterOptions.categoria}
          value={filters.categoria}
          onChange={(v) => onFilterChange('categoria', v)}
        />
        <FilterSelect
          ariaLabel="Filtrar por prioridade"
          options={filterOptions.prioridade}
          value={filters.prioridade}
          onChange={(v) => onFilterChange('prioridade', v)}
        />

        <button
          type="button"
          onClick={onClear}
          className={`inv-toolbar__clear${activeFilterCount > 0 ? ' inv-toolbar__clear--active' : ''}`}
          aria-label={`Limpar filtros${activeFilterCount > 0 ? ` (${activeFilterCount} ativos)` : ''}`}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {activeFilterCount > 0 ? 'filter_alt_off' : 'filter_alt'}
          </span>
          Limpar
          {activeFilterCount > 0 && (
            <span className="inv-toolbar__clear-badge" aria-hidden="true">{activeFilterCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(InventoryFilters);
