export default function SectionCard({ title, subtitle = null, children, actions = null }) {
  return (
    <div className="v4-section-card">
      <div className="v4-section-card__header">
        <div className="v4-section-card__title-group">
          <h3 className="v4-section-card__title">{title}</h3>
          {subtitle && <p className="v4-section-card__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="v4-section-card__actions">{actions}</div>}
      </div>
      <div className="v4-section-card__body">{children}</div>
    </div>
  );
}
