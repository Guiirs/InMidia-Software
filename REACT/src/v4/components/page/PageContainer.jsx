export default function PageContainer({ children, maxWidth = 'xl', padding = true, className = '' }) {
  const containerClass = `v4-page-container v4-page-container--${maxWidth}${padding ? ' v4-page-container--padded' : ''}${className ? ' ' + className : ''}`;
  return (
    <div className={containerClass}>
      {children}
    </div>
  );
}
