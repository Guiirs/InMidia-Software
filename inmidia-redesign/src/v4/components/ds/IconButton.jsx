// v4 Design System - IconButton
import React from 'react';
import './IconButton.css';

export function IconButton({ icon, label, className = '', ...props }) {
  return (
    <button className={`v4-icon-btn ${className}`.trim()} aria-label={label} {...props}>
      {icon}
    </button>
  );
}
