export default function PageActions({
  children,
  justify = 'flex-end',
  gap = 8,
  sticky = false,
  className = ''
}) {
  const style = { gap: `${gap}px`, justifyContent: justify };
  const stickyClass = sticky ? ' v4-page-actions--sticky' : '';
  return (
    <div
      className={`v4-page-actions${stickyClass}${className ? ' ' + className : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}
