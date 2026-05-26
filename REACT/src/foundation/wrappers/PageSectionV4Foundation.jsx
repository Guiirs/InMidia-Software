import React from 'react';

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function PageContainerV4Foundation({
  children,
  maxWidth = 'xl',
  padded = true,
  className = '',
  as: Component = 'div',
  ...props
}) {
  return (
    <Component
      className={joinClasses('fdn-page-container', `fdn-page-container--${maxWidth}`, padded && 'fdn-page-container--padded', className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function PageSectionV4Foundation({
  children,
  className = '',
  as: Component = 'section',
  ...props
}) {
  return (
    <Component className={joinClasses('fdn-page-section', className)} {...props}>
      {children}
    </Component>
  );
}
