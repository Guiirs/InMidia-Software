// src/components/ApiKeyModal.jsx
import React, { useEffect } from 'react';
import { useToast } from '../ToastNotification/ToastNotification'; // Importa o hook do Toast
import './ApiKeyModal.css'; // Criaremos este CSS

function ApiKeyModal({ apiKey, isOpen, onClose }) {
  const showToast = useToast();

  // Efeito para tecla ESC
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (isOpen && event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const handleCopyClick = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey)
      .then(() => {
        showToast('API Key copiada!', 'success');
      })
      .catch(err => {
        console.error('Falha ao copiar API Key:', err);
        showToast('Falha ao copiar a chave.', 'error');
        // Fallback (menos comum ser necessário hoje em dia)
        try {
            const input = document.getElementById('api-key-display-modal'); // Certifica ID único se usar em mais lugares
            if(input) {
                input.select();
                document.execCommand('copy');
                showToast('API Key copiada! (fallback)', 'success');
            }
        } catch (fallbackErr) {
            console.error('Falha no fallback de cópia:', fallbackErr);
        }

      });
  };

  if (!isOpen) {
    return null;
  }

  // Evita fechar ao clicar dentro do conteúdo
  const handleContentClick = (e) => e.stopPropagation();

  // JSX baseado no seu ui.js
  return (
    // Usamos onClick no wrapper para fechar ao clicar fora (simples)
    <div className={`apikey-modal ${isOpen ? 'apikey-modal--visible' : ''}`} onClick={onClose}>
      <div className="apikey-modal__content" onClick={handleContentClick}>
        <i className="fas fa-key apikey-modal__icon"></i>
        <h3 className="apikey-modal__title">API Key Gerada com Sucesso!</h3>
        <p className="apikey-modal__message">
          Guarde esta chave num local seguro.
          <strong>Esta é a única vez que ela será exibida.</strong>
        </p>
        <div className="apikey-modal__key-wrapper">
          <input
            type="text"
            id="api-key-display-modal" // ID único
            className="apikey-modal__key-input"
            value={apiKey || ''}
            readOnly
          />
          <button
            type="button"
            className="apikey-modal__copy-btn"
            title="Copiar"
            onClick={handleCopyClick}
          >
            <i className="fas fa-copy"></i>
          </button>
        </div>
        <button
          type="button"
          className="apikey-modal__close-btn"
          onClick={onClose}
        >
          Percebi, fechar
        </button>
      </div>
    </div>
  );
}

export default ApiKeyModal;