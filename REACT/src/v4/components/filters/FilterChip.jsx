export default function FilterChip({
  label,
  value,
  active = true,
  onClear = null,
  disabled = false,
  className = ''
}) {
  const chipClass = [
    'v4-filter-chip',
    active ? 'v4-filter-chip--active' : '',
    disabled ? 'v4-filter-chip--disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={chipClass}>
      <span className="v4-filter-chip__text">{label}{value ? `: ${value}` : ''}</span>
      <button
        className="v4-filter-chip__clear"
        type="button"
        disabled={disabled}
        onClick={onClear}
        aria-label={`Limpar filtro ${label}`}
      >
        x
      </button>
    </div>
  );
}
