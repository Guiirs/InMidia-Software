export default function StatusBadge({ status = 'default', label, className = '' }) {
  return (
    <span className={`v4-status-badge v4-status-badge--${status}${className ? ` ${className}` : ''}`}>
      {label}
    </span>
  );
}
