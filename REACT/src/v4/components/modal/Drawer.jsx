import React, { useEffect } from 'react';

/**
 * Drawer — Slide-in modal from side.
 *
 * Props:
 * - children (required): Drawer content
 * - isOpen (boolean, default false): Controls visibility
 * - onClose (function, optional): Called to close drawer
 * - side ('left'|'right', default 'right'): Slide direction
 * - title (string, optional): Drawer title
 * - width (string, default '400px'): Drawer width
 * - closeOnOverlay (boolean, default false): Close on overlay click
 * - className (string, optional): Additional CSS class
 *
 * Accessibility:
 * - role="dialog"
 * - aria-modal="true"
 * - Escape key closes if onClose provided
 */
export default function Drawer({
  children,
  isOpen = false,
  onClose = null,
  side = 'right',
  title = null,
  width = '400px',
  closeOnOverlay = false,
  className = ''
}) {
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const titleId = title ? 'v4-drawer-title' : undefined;

  return (
    <div
      className={`v4-drawer-overlay${isOpen ? ' v4-drawer-overlay--open' : ''}`}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={`v4-drawer v4-drawer--${side}${className ? ' ' + className : ''}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
