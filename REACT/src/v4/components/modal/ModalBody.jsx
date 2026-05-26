import React from 'react';

/**
 * ModalBody — Content section for Dialog/Drawer.
 *
 * Props:
 * - children (required): Modal content
 * - padding ('sm'|'md'|'lg', default 'md'): Padding level
 * - className (string, optional): Additional CSS class
 */
export default function ModalBody({
  children,
  padding = 'md',
  className = ''
}) {
  return (
    <div className={`v4-modal-body v4-modal-body--padding-${padding}${className ? ' ' + className : ''}`}>
      {children}
    </div>
  );
}
