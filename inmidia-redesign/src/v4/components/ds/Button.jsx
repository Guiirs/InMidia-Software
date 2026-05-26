// v4 Design System - Button
import React from 'react';
import './Button.css';

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button className={`v4-btn v4-btn--${variant} v4-btn--${size} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
