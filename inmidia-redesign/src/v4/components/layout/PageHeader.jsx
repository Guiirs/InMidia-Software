// v4 Layout - PageHeader
import React from 'react';
import './PageHeader.css';

export function PageHeader({ title, subtitle, actions, className = '', ...props }) {
  return (
    <header className={`v4-page-header ${className}`.trim()} {...props}>
      <div className="v4-page-header__main">
        <h1 className="v4-page-header__title">{title}</h1>
        {subtitle && <div className="v4-page-header__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="v4-page-header__actions">{actions}</div>}
    </header>
  );
}
