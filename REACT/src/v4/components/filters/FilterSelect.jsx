export default function FilterSelect({
  label,
  options = [],
  value = '',
  placeholder = 'Selecionar',
  disabled = false,
  open = false,
  className = '',
  onChange = null
}) {
  const selectClass = [
    'v4-filter-select',
    open ? 'v4-filter-select--open' : '',
    disabled ? 'v4-filter-select--disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <label className={selectClass}>
      {label && <span className="v4-filter-select__label">{label}</span>}
      <span className="v4-filter-select__field-wrap">
        <select
          className="v4-filter-select__field"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange && onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </span>
    </label>
  );
}
