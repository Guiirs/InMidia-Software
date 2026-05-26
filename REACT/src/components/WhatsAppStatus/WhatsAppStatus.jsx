// src/components/WhatsAppStatus/WhatsAppStatus.jsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import Spinner from '../Spinner/Spinner';

function WhatsAppStatus() {
  const {
    qrCode,
    connectionStatus,
    isLoadingStatus,
    isConnecting,
    handleReconnect,
    sseConnected
  } = useWhatsApp();

  const getStatusInfo = () => {
    if (connectionStatus.conectado) {
      return {
        color: 'success',
        icon: 'fas fa-check-circle',
        text: `Conectado${connectionStatus.numero_conectado ? ` (${connectionStatus.numero_conectado})` : ''}`
      };
    }
    if (isConnecting) {
      return {
        color: 'warning',
        icon: 'fas fa-spinner fa-spin',
        text: 'Conectando...'
      };
    }
    return {
      color: 'error',
      icon: 'fas fa-times-circle',
      text: 'Desconectado'
    };
  };

  const statusInfo = getStatusInfo();

  if (isLoadingStatus) {
    return (
      <div className="text-center">
        <Spinner message="Carregando status do WhatsApp..." />
      </div>
    );
  }

  return (
    <div className="whatsapp-status">
      {/* Status Principal */}
      <div className="empresa-settings-card__section">
        <div className="status-display">
          <div className={`empresa-settings-card__status empresa-settings-card__status--${statusInfo.color === 'success' ? 'active' : 'inactive'}`}>
            <i className={statusInfo.icon}></i>
            <span>{statusInfo.text}</span>
          </div>
        </div>
      </div>

      {/* QR Code */}
      {qrCode && (
        <div className="empresa-settings-card__section">
          <h4 className="empresa-settings-card__subtitle">
            <i className="fas fa-qrcode"></i>
            Código QR para Autenticação
          </h4>
          <p className="text-muted">
            Abra o WhatsApp no seu telefone e escaneie o código abaixo:
          </p>
          <div className="qr-code-container">
            <QRCodeSVG
              value={qrCode}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>
          <p className="text-sm text-muted">
            O código expira em alguns minutos. Se não conseguir escanear,
            clique em "Reconectar" para gerar um novo.
          </p>
        </div>
      )}

      {/* Informações de Conexão */}
      <div className="empresa-settings-card__section">
        <h4 className="empresa-settings-card__subtitle">
          <i className="fas fa-info-circle"></i>
          Informações da Conexão
        </h4>
        <div className="info-grid">
          <div className="empresa-settings-card__info-group">
            <span className="empresa-settings-card__info-label">Status SSE:</span>
            <span className={`empresa-settings-card__info-value ${sseConnected ? 'text-success' : 'text-error'}`}>
              {sseConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          {connectionStatus.numero_conectado && (
            <div className="empresa-settings-card__info-group">
              <span className="empresa-settings-card__info-label">Número Conectado:</span>
              <span className="empresa-settings-card__info-value">{connectionStatus.numero_conectado}</span>
            </div>
          )}
          {connectionStatus.grupo_configurado && (
            <div className="empresa-settings-card__info-group">
              <span className="empresa-settings-card__info-label">Grupo Configurado:</span>
              <span className="empresa-settings-card__info-value">{connectionStatus.grupo_id}</span>
            </div>
          )}
          <div className="empresa-settings-card__info-group">
            <span className="empresa-settings-card__info-label">Tentativas de Reconexão:</span>
            <span className="empresa-settings-card__info-value">
              {connectionStatus.tentativas_reconexao || 0}/{connectionStatus.max_tentativas_reconexao || 5}
            </span>
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="empresa-settings-card__actions">
        <button
          type="button"
          onClick={handleReconnect}
          disabled={isConnecting}
          className="empresa-settings-card__button--regenerate"
        >
          {isConnecting ? (
            <>
              <Spinner size="small" />
              Reconectando...
            </>
          ) : (
            <>
              <i className="fas fa-sync-alt"></i>
              Reconectar WhatsApp
            </>
          )}
        </button>
      </div>

      {/* Mensagens de Status */}
      {isConnecting && (
        <div className="alert alert-warning">
          <i className="fas fa-exclamation-triangle"></i>
          Tentando reconectar automaticamente...
          {connectionStatus.tentativas_reconexao > 0 &&
            ` (Tentativa ${connectionStatus.tentativas_reconexao}/${connectionStatus.max_tentativas_reconexao})`
          }
        </div>
      )}

      {!connectionStatus.conectado && !isConnecting && !qrCode && (
        <div className="alert alert-error">
          <i className="fas fa-exclamation-circle"></i>
          WhatsApp desconectado. Clique em "Reconectar" para tentar novamente.
        </div>
      )}
    </div>
  );
}

export default WhatsAppStatus;