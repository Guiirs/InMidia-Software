import React, { useEffect } from 'react';

/**
 * Dialog — Base modal component with overlay and backdrop.
 *
 * Props:
 * - children (required): Modal content
 * - isOpen (boolean, default false): Controls visibility
 * - onClose (function, optional): Called when modal should close (Escape or overlay click)
 * - title (string, optional): Modal title for aria-labelledby
 * - closeOnOverlay (boolean, default false): Close when clicking overlay
 * - maxWidth (string, default '500px'): Modal max-width
 * - className (string, optional): Additional CSS class
 *
 * Accessibility:
 * - role="dialog"
 * - aria-modal="true"
 * - aria-labelledby if title provided
 * - Escape key closes if onClose provided
 * - Backdrop dismissal only if closeOnOverlay enabled
 */
export default function Dialog({
  children,
  isOpen = false,
  onClose = null,
  title = null,
  closeOnOverlay = false,
  maxWidth = '500px',
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

  const titleId = title ? 'v4-dialog-title' : undefined;

  return (
    <div className="v4-dialog-overlay" onClick={closeOnOverlay ? onClose : undefined}>
      <div
        className={`v4-dialog${className ? ' ' + className : ''}`}
        style={{ maxWidth }}
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
