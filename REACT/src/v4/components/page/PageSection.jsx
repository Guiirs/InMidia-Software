export default function PageSection({
  title = null,
  subtitle = null,
  children,
  variant = 'default',
  spacing = 'md',
  className = ''
}) {
  return (
    <section className={`v4-page-section v4-page-section--${variant} v4-page-section--spacing-${spacing}${className ? ' ' + className : ''}`}>
      {(title || subtitle) && (
        <div className="v4-page-section__header">
          {title && <h2 className="v4-page-section__title">{title}</h2>}
          {subtitle && <p className="v4-page-section__subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="v4-page-section__content">
        {children}
      </div>
    </section>
  );
}
