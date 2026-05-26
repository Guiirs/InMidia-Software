import { memo } from 'react';

function V4SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  className = '',
  ...props
}) {
  const classes = ['v4-ui-section-header', className].filter(Boolean).join(' ');

  return (
    <header className={classes} {...props}>
      <div className="v4-ui-section-header__content">
        {eyebrow && <span className="v4-ui-section-header__eyebrow">{eyebrow}</span>}
        {title && <h2 className="v4-ui-section-header__title">{title}</h2>}
        {description && <p className="v4-ui-section-header__description">{description}</p>}
      </div>
      {actions && <div className="v4-ui-section-header__actions">{actions}</div>}
    </header>
  );
}

export default memo(V4SectionHeader);
