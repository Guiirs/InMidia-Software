export default function ActionMenuDivider({ className = '' }) {
  return <div className={`v4-action-menu-divider${className ? ` ${className}` : ''}`} role="separator" />;
}
