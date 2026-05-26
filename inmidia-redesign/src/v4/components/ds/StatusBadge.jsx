// v4 Design System - StatusBadge
import React from 'react';
import './StatusBadge.css';

export function StatusBadge({ status = 'default', label, className = '', ...props }) {
  return (
    <span className={`v4-status-badge v4-status-badge--${status} ${className}`.trim()} {...props}>
      {label}
    </span>
  );
}
