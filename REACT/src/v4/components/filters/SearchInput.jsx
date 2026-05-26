export default function SearchInput({
  value = '',
  placeholder = 'Buscar',
  disabled = false,
  busy = false,
  className = '',
  onChange = null,
  onClear = null
}) {
  const rootClass = [
    'v4-search-input',
    busy ? 'v4-search-input--busy' : '',
    disabled ? 'v4-search-input--disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <label className={rootClass}>
      <span className="v4-search-input__icon" aria-hidden="true">::</span>
      <input
        className="v4-search-input__field"
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange && onChange(event.target.value)}
      />
      {value && (
        <button
          className="v4-search-input__clear"
          type="button"
          disabled={disabled}
          onClick={onClear}
          aria-label="Limpar busca"
        >
          x
        </button>
      )}
    </label>
  );
}
