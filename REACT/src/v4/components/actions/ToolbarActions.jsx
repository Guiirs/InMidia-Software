export default function ToolbarActions({
  primary = null,
  secondary = null,
  menu = null,
  stacked = false,
  className = ''
}) {
  const rootClass = [
    'v4-toolbar-actions',
    stacked ? 'v4-toolbar-actions--stacked' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <div className="v4-toolbar-actions__left">{secondary}</div>
      <div className="v4-toolbar-actions__right">
        {primary}
        {menu}
      </div>
    </div>
  );
}
