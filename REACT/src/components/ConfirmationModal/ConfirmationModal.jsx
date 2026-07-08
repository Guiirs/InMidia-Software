// src/components/ConfirmationModal/ConfirmationModal.jsx
import React, { useEffect } from 'react';
import './ConfirmationModal.css';

function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar Ação",
  message = "Tem a certeza?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmButtonType = "red",
  isConfirming = false,
  closeOnBackdrop = true,
}) {

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (closeOnBackdrop) onClose();
  };

  const confirmButtonClass = confirmButtonType === 'green'
    ? 'confirmation-modal-button--confirm-green'
    : 'confirmation-modal-button--confirm';

  return (
    <div
      className={`confirmation-modal-overlay ${isOpen ? 'confirmation-modal-overlay--visible' : ''}`}
      onClick={handleBackdropClick}
      data-testid="confirmation-modal-overlay"
    >
      <div
        className="confirmation-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'confirmation-modal-title' : undefined}
      >
        <div className="confirmation-modal-header">
          {title && <h3 id="confirmation-modal-title" className="confirmation-modal-title">{title}</h3>}
        </div>

        <div className="confirmation-modal-body">
          <p className="confirmation-modal-message">{message}</p>
        </div>

        <div className="confirmation-modal-actions">
          <button
            type="button"
            className="confirmation-modal-button confirmation-modal-button--cancel"
            onClick={onClose}
            disabled={isConfirming}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirmation-modal-button ${confirmButtonClass}`}
            onClick={onConfirm}
            disabled={isConfirming}
            data-testid="confirmation-modal-confirm"
          >
            {isConfirming ? 'A confirmar...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
