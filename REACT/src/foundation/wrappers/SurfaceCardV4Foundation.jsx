import React from 'react';

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function SurfaceCardV4Foundation({
  children,
  variant = 'default',
  interactive = false,
  className = '',
  as: Component = 'article',
  ...props
}) {
  return (
    <Component
      className={joinClasses(
        'fdn-surface-card',
        `fdn-surface-card--${variant}`,
        interactive && 'fdn-surface-card--interactive',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
