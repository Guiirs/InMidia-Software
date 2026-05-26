import React from 'react';

/**
 * ModalHeader — Header section for Dialog/Drawer.
 *
 * Props:
 * - children (required): Header content (typically title text)
 * - title (string, optional): Alternative to children (rendered as h2)
 * - onClose (function, optional): Close button handler; if not provided, no close button rendered
 * - className (string, optional): Additional CSS class
 *
 * Accessibility:
 * - Semantic <h2> for title
 * - Close button has aria-label
 */
export default function ModalHeader({
  children,
  title = null,
  onClose = null,
  className = ''
}) {
  return (
    <div className={`v4-modal-header${className ? ' ' + className : ''}`}>
      <div className="v4-modal-header__title-area">
        {title ? (
          <h2 className="v4-modal-header__title" id="v4-dialog-title">
            {title}
          </h2>
        ) : (
          children
        )}
      </div>
      {onClose && (
        <button
          className="v4-modal-header__close"
          type="button"
          onClick={onClose}
          aria-label="Fechar diálogo"
          title="Fechar (Esc)"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
