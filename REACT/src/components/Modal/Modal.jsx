// src/components/Modal/Modal.jsx
import React, { useEffect } from 'react';
import './Modal.css';

function Modal({ title, children, isOpen, onClose }) {
  // Efeito para lidar com cliques fora do modal e tecla ESC
  useEffect(() => {
    const handleOutsideClick = (event) => {
      // Fecha se clicar diretamente no fundo (.modal)
      if (isOpen && event.target.classList.contains('modal')) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (isOpen && event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    }

    // Cleanup: remove listeners quando o componente desmonta ou isOpen muda
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]); // Depende de isOpen e onClose

  // Não renderiza nada se não estiver aberto
  if (!isOpen) {
    return null;
  }

  return (
    <div className={`modal ${isOpen ? 'modal--visible' : ''}`} id="app-modal"> {/* Mantém ID se necessário */}
      <div className="modal__content">
        <div className="modal__header">
          <h3 className="modal__title">{title}</h3>
          {/* O botão de fechar agora chama diretamente onClose */}
          <button className="modal__close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal__body">
          {/* O conteúdo do modal (ex: formulário) é passado como children */}
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;