import React from 'react';

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function PageShellV4Foundation({
  children,
  className = '',
  fullHeight = false,
  as: Component = 'section',
  ...props
}) {
  return (
    <Component
      className={joinClasses('fdn-root', 'fdn-page-shell', fullHeight && 'fdn-page-shell--full-height', className)}
      {...props}
    >
      {children}
    </Component>
  );
}
