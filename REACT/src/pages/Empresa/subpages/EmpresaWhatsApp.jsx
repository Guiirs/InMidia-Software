// src/pages/Empresa/subpages/EmpresaWhatsApp.jsx
import React from 'react';
import WhatsAppStatus from '../../../components/WhatsAppStatus/WhatsAppStatus';
import '../EmpresaSettings.css';

function EmpresaWhatsApp() {
    return (
        <div className="empresa-settings-card">
            <div className="empresa-settings-card__header">
                <i className="fab fa-whatsapp empresa-settings-card__icon" style={{ color: 'var(--accent-green)' }}></i>
                <h3 className="empresa-settings-card__title">WhatsApp Business</h3>
            </div>

            <p className="empresa-settings-card__info-label" style={{ fontSize: '1.4rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Configure e monitore a conexão do WhatsApp para envio automático de relatórios
                de disponibilidade de placas para o grupo configurado.
            </p>

            <div className="empresa-settings-card__content">
                <WhatsAppStatus />
            </div>
        </div>
    );
}

export default EmpresaWhatsApp;