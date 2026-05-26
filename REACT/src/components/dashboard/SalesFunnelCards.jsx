import React from 'react';

const STEPS = [
  { key: 'propostasCriadas', label: 'Propostas criadas' },
  { key: 'propostasEmNegociacao', label: 'Em negociação' },
  { key: 'propostasAprovadas', label: 'Aprovadas' },
  { key: 'propostasRecusadas', label: 'Recusadas' },
  { key: 'contratosGerados', label: 'Contratos gerados' },
];

function SalesFunnelCards({ data, loading }) {
  const safe = data || {};
  const withoutOpenProposals =
    !loading &&
    Number(safe.propostasCriadas || 0) === 0 &&
    Number(safe.propostasEmNegociacao || 0) === 0;

  return (
    <section className="dashboard-section dashboard-card">
      <h3 className="dashboard-section__title">Funil comercial</h3>
      <div className="funnel-grid">
        {STEPS.map((step) => (
          <article key={step.key} className="funnel-card">
            <p className="funnel-card__label">{step.label}</p>
            <p className="funnel-card__value">{loading ? '...' : Number(safe[step.key] || 0)}</p>
          </article>
        ))}
        <article className="funnel-card funnel-card--highlight">
          <p className="funnel-card__label">Taxa de conversão</p>
          <p className="funnel-card__value">{loading ? '...' : `${Number(safe.taxaConversao || 0).toFixed(2)}%`}</p>
        </article>
      </div>
      {withoutOpenProposals && (
        <p className="dashboard-list__hint">Sem propostas abertas no momento.</p>
      )}
    </section>
  );
}

export default SalesFunnelCards;
