import TableEmptyState from './TableEmptyState';
import TableLoadingState from './TableLoadingState';

export default function DataTable({
  children,
  className = '',
  density = 'default',
  state = 'default',
  loading = false,
  empty = false,
  stale = false,
  degraded = false,
  stickyHeader = true,
  responsive = true,
  staleMessage = 'Dados podem estar desatualizados.',
  degradedMessage = 'Modo degradado ativo. Alguns dados podem estar incompletos.'
}) {
  const visualState = state !== 'default'
    ? state
    : loading
      ? 'loading'
      : empty
        ? 'empty'
        : degraded
          ? 'degraded'
          : stale
            ? 'stale'
            : 'default';

  const rootClass = [
    'v4-data-table',
    `v4-data-table--density-${density}`,
    `v4-data-table--state-${visualState}`,
    stickyHeader ? 'v4-data-table--sticky-header' : '',
    responsive ? 'v4-data-table--responsive' : '',
    className
  ].filter(Boolean).join(' ');

  const showTable = visualState !== 'loading' && visualState !== 'empty';

  return (
    <section className={rootClass}>
      {visualState === 'stale' && (
        <div className="v4-data-table__state-banner v4-data-table__state-banner--stale" role="status">
          {staleMessage}
        </div>
      )}

      {visualState === 'degraded' && (
        <div className="v4-data-table__state-banner v4-data-table__state-banner--degraded" role="status">
          {degradedMessage}
        </div>
      )}

      {showTable && (
        <div className="v4-data-table__scroll">
          <table className="v4-data-table__table">
            {children}
          </table>
        </div>
      )}

      {visualState === 'loading' && <TableLoadingState density={density} />}
      {visualState === 'empty' && <TableEmptyState />}
    </section>
  );
}
