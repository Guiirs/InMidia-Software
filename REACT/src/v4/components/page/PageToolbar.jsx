export default function PageToolbar({
  children,
  variant = 'horizontal',
  alignment = 'space-between',
  sticky = false,
  className = ''
}) {
  const stickyClass = sticky ? ' v4-page-toolbar--sticky' : '';
  return (
    <div
      className={`v4-page-toolbar v4-page-toolbar--${variant} v4-page-toolbar--${alignment}${stickyClass}${className ? ' ' + className : ''}`}
    >
      {children}
    </div>
  );
}
