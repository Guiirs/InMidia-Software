export default function PageHeader({
  title,
  subtitle = null,
  description = null,
  breadcrumb = null,
  actions = null,
  metrics = null,
  variant = 'default'
}) {
  return (
    <div className={`v4-page-header v4-page-header--${variant}`}>
      {breadcrumb && (
        <div className="v4-page-header__breadcrumb">
          {breadcrumb}
        </div>
      )}
      
      <div className="v4-page-header__top">
        <div className="v4-page-header__title-area">
          <h1 className="v4-page-header__title">{title}</h1>
          {subtitle && <p className="v4-page-header__subtitle">{subtitle}</p>}
          {description && <p className="v4-page-header__description">{description}</p>}
        </div>
        
        {actions && (
          <div className="v4-page-header__actions">
            {actions}
          </div>
        )}
      </div>

      {metrics && (
        <div className="v4-page-header__metrics">
          {metrics}
        </div>
      )}
    </div>
  );
}
