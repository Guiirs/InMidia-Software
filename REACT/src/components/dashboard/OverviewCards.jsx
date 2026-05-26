import React from 'react';

const CARD_META = [
  { key: 'totalPlacas', label: 'Total de placas', icon: 'fa-th-large' },
  { key: 'placasDisponiveis', label: 'Placas disponíveis', icon: 'fa-check-circle' },
  { key: 'placasAlugadasOcupadas', label: 'Placas alugadas/ocupadas', icon: 'fa-building' },
  { key: 'taxaOcupacao', label: 'Taxa de ocupação', icon: 'fa-percent', suffix: '%' },
  { key: 'propostasEmAberto', label: 'Propostas em aberto', icon: 'fa-file-signature' },
  { key: 'contratosAtivos', label: 'Contratos ativos', icon: 'fa-file-contract' },
  { key: 'receitaEstimadaMensal', label: 'Receita estimada mensal', icon: 'fa-dollar-sign', money: true },
  { key: 'regioesAtivas', label: 'Regiões ativas', icon: 'fa-map-marked-alt' },
];

function formatValue(key, value, { suffix, money }) {
  if (value == null) return '-';
  if (money) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  }
  if (key === 'taxaOcupacao') {
    return `${Number(value || 0).toFixed(2)}${suffix || ''}`;
  }
  return `${value}${suffix || ''}`;
}

function OverviewCards({ data, loading }) {
  const safe = data || {};

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section__title">Visão geral</h2>
      <div className="dashboard-page__summary">
        {CARD_META.map((card) => (
          <article key={card.key} className="dashboard-summary-card fdn-surface-card fdn-surface-card--default fdn-surface-card--interactive">
            <div className="dashboard-summary-card__icon" aria-hidden="true">
              <i className={`fas ${card.icon}`}></i>
            </div>
            <div className="dashboard-summary-card__info">
              <p className="dashboard-summary-card__value">
                {loading ? '...' : formatValue(card.key, safe[card.key], card)}
              </p>
              <span className="dashboard-summary-card__label">{card.label}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default OverviewCards;
