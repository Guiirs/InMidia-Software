import React from 'react';
import Dialog from './Dialog';

/**
 * ConfirmDialog — Pre-built confirmation modal.
 *
 * Props:
 * - isOpen (boolean, default false): Controls visibility
 * - onClose (function, required): Called to close dialog
 * - onConfirm (function, required): Called when user confirms
 * - title (string): Dialog title
 * - message (string): Confirmation message
 * - confirmText (string, default 'Confirmar'): Confirm button label
 * - cancelText (string, default 'Cancelar'): Cancel button label
 * - isPending (boolean, default false): Disable actions during processing
 * - variant ('default'|'destructive', default 'default'): Visual variant
 *
 * Accessibility:
 * - Inherits from Dialog (role="dialog", aria-modal="true")
 * - Buttons are semantic <button> elements
 */
export default function ConfirmDialog({
  isOpen = false,
  onClose,
  onConfirm,
  title = 'Confirmação',
  message = 'Tem certeza?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isPending = false,
  variant = 'default'
}) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} closeOnOverlay={!isPending}>
      <div className="v4-confirm-dialog">
        {title && (
          <div className="v4-confirm-dialog__header">
            <h2 className="v4-confirm-dialog__title" id="v4-dialog-title">
              {title}
            </h2>
          </div>
        )}

        <div className="v4-confirm-dialog__body">
          <p className="v4-confirm-dialog__message">{message}</p>
        </div>

        <div className="v4-confirm-dialog__footer">
          <button
            className="v4-confirm-dialog__btn v4-confirm-dialog__btn--cancel"
            type="button"
            onClick={onClose}
            disabled={isPending}
          >
            {cancelText}
          </button>
          <button
            className={`v4-confirm-dialog__btn v4-confirm-dialog__btn--confirm v4-confirm-dialog__btn--${variant}`}
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
