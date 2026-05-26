export default function PageShell({ children, fullHeight = false, className = '' }) {
  return (
    <div className={`v4-page-shell${fullHeight ? ' v4-page-shell--full-height' : ''}${className ? ' ' + className : ''}`}>
      {children}
    </div>
  );
}
