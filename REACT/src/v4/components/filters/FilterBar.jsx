export default function FilterBar({
  children,
  chips = null,
  search = null,
  actions = null,
  className = ''
}) {
  return (
    <section className={`v4-filter-bar${className ? ` ${className}` : ''}`}>
      <div className="v4-filter-bar__top">
        <div className="v4-filter-bar__search">{search}</div>
        <div className="v4-filter-bar__actions">{actions}</div>
      </div>

      <div className="v4-filter-bar__scroll" role="region" aria-label="Filtros ativos e grupos de filtro">
        <div className="v4-filter-bar__content">
          {children}
        </div>
      </div>

      {chips && <div className="v4-filter-bar__chips">{chips}</div>}
    </section>
  );
}
