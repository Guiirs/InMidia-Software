import React from 'react';

/**
 * ModalFooter — Footer section for Dialog/Drawer with action buttons.
 *
 * Props:
 * - children (required): Footer content (typically buttons)
 * - align ('flex-start'|'center'|'flex-end'|'space-between', default 'flex-end'): Button alignment
 * - divider (boolean, default true): Show top border divider
 * - className (string, optional): Additional CSS class
 */
export default function ModalFooter({
  children,
  align = 'flex-end',
  divider = true,
  className = ''
}) {
  return (
    <div
      className={`v4-modal-footer v4-modal-footer--align-${align}${divider ? ' v4-modal-footer--divider' : ''}${className ? ' ' + className : ''}`}
    >
      {children}
    </div>
  );
}
