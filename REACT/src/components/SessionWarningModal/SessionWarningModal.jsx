// src/components/SessionWarningModal.jsx
import React from 'react';
import './SessionWarningModal.css';
import './SessionWarningModal.css';

function SessionWarningModal({ onRenew, onDismiss }) {
  return (
    <div className="session-warning-modal-overlay">
      <div className="session-warning-modal">
        <div className="session-warning-modal-header">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Sessão Expirando</h3>
        </div>
        <div className="session-warning-modal-body">
          <p>Sua sessão irá expirar em breve. Deseja renovar sua sessão?</p>
        </div>
        <div className="session-warning-modal-footer">
          <button className="btn btn-secondary" onClick={onDismiss}>
            Ignorar
          </button>
          <button className="btn btn-primary" onClick={onRenew}>
            Renovar Sessão
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionWarningModal;