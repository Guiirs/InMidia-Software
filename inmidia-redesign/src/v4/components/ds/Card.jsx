// v4 Design System - Card
import React from 'react';
import './Card.css';

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`v4-card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
