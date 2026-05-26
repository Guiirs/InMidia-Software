// src/components/ConfirmationModal/ConfirmationModal.jsx
import React, { useEffect } from 'react';
import './ConfirmationModal.css'; // Importa o CSS

function ConfirmationModal({
  isOpen,
  onClose, // Função para cancelar/fechar
  onConfirm, // Função a ser executada ao confirmar
  title = "Confirmar Ação",
  message = "Tem a certeza?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmButtonType = "red", // 'red' (padrão) ou 'green'
  isConfirming = false // Para mostrar estado de loading no botão Confirmar
}) {

  // Efeito para tecla ESC (similar ao Modal genérico)
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (isOpen && event.key === 'Escape') {
        onClose(); // Chama a função de fechar/cancelar
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  // Evita fechar ao clicar dentro do conteúdo
  const handleContentClick = (e) => e.stopPropagation();

  // Determina a classe do botão de confirmação
  const confirmButtonClass = confirmButtonType === 'green'
    ? 'confirmation-modal-button--confirm-green'
    : 'confirmation-modal-button--confirm'; // Padrão vermelho

  return (
    // Usamos onClick no overlay para fechar ao clicar fora
    <div className={`confirmation-modal-overlay ${isOpen ? 'confirmation-modal-overlay--visible' : ''}`} onClick={onClose}>
      <div className="confirmation-modal-content" onClick={handleContentClick}>
        {/* Título opcional */}
        {title && <h3 className="confirmation-modal-title">{title}</h3>}

        <p className="confirmation-modal-message">{message}</p>

        <div className="confirmation-modal-actions">
          <button
            type="button"
            className="confirmation-modal-button confirmation-modal-button--cancel"
            onClick={onClose}
            disabled={isConfirming} // Desabilita enquanto confirma
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirmation-modal-button ${confirmButtonClass}`}
            onClick={onConfirm}
            disabled={isConfirming} // Desabilita enquanto confirma
          >
            {isConfirming ? 'A confirmar...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;