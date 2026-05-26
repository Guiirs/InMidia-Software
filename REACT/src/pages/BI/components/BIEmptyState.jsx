import React from 'react';

export default function BIEmptyState() {
  return (
    <div className="bi-empty-state" data-testid="bi-empty-state">
      <div className="bi-empty-state__icon" aria-hidden="true">📊</div>
      <h3 className="bi-empty-state__title">Dados BI ainda não disponíveis</h3>
      <p className="bi-empty-state__description">
        Nenhum snapshot analítico foi gerado ainda. O sistema cria snapshots automaticamente
        durante o ciclo de análise operacional.
      </p>
      <p className="bi-empty-state__hint">
        Se você acabou de configurar a empresa, aguarde o próximo ciclo de análise.
      </p>
    </div>
  );
}
