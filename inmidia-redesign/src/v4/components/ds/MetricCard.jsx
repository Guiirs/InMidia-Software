// v4 Design System - MetricCard
import React from 'react';
import './MetricCard.css';

export function MetricCard({ title, value, delta, icon, className = '', ...props }) {
  return (
    <div className={`v4-metric-card ${className}`.trim()} {...props}>
      <div className="v4-metric-card__header">
        {icon && <span className="v4-metric-card__icon">{icon}</span>}
        <span className="v4-metric-card__title">{title}</span>
      </div>
      <div className="v4-metric-card__value">{value}</div>
      {delta && <div className="v4-metric-card__delta">{delta}</div>}
    </div>
  );
}
