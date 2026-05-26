// v4 Layout - PageContainer
import React from 'react';
import './PageContainer.css';

export function PageContainer({ children, className = '', ...props }) {
  return (
    <div className={`v4-page-container ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
