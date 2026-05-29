import React from 'react';
import { SEVERIDADE } from '../../utils/statusMap';

function SmartAlerts({ data = [], loading }) {
  return (
    <section className="dashboard-section dashboard-card">
      <h3 className="dashboard-section__title">Exceções operacionais</h3>
      {loading ? (
        <p className="dashboard-state dashboard-state--loading">A carregar alertas...</p>
      ) : data.length === 0 ? (
        <p className="dashboard-state dashboard-state--empty">Sem alertas ativos.</p>
      ) : (
        <ul className="dashboard-list">
          {data.slice(0, 6).map((alerta) => {
            const sev = SEVERIDADE[alerta.severidade];
            const sevLabel = sev?.label ?? '—';
            const sevTone  = sev?.tone  ?? 'info';
            return (
              <li key={alerta.id} className="dashboard-list__item">
                <div>
                  <span className={`status-pill status-pill--${sevTone}`}>{sevLabel}</span>
                  <strong> {alerta.titulo}</strong>
                  <p>{alerta.descricao}</p>
                </div>
                <p className="dashboard-list__hint">Ação: {alerta.acaoSugerida}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default SmartAlerts;
