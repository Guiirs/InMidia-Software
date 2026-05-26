import { memo } from 'react';
import {
  EMPTY_CONTRACTS_SUMMARY,
  EMPTY_FINANCIAL_IMPACT,
} from '../../integration/adapters/contractAdapter.js';

function FinancialBar({ label, value, total, color }) {
  const pct = Math.round((value / total) * 100);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-financial-row" style={{ '--v4p-progress': `${pct}%`, '--v4p-accent-dynamic': color }}>
      <div className="v4p-card-header">
        <span className="v4p-detail-row__label">{label}</span>
        <span className="v4p-detail-row__value">{fmt(value)}</span>
      </div>
      <div className="v4p-progress-track">
        <div className="v4p-progress-fill" />
      </div>
      <div className="v4p-list-item__copy">{pct}% da receita total</div>
    </div>
  );
}

function FinancialImpactPanel({ impact = EMPTY_FINANCIAL_IMPACT, summary = EMPTY_CONTRACTS_SUMMARY }) {
  const { receitaProtegida, receitaEmRisco, potencialExpansao, previsaoProximoMes, crescimentoEsperado } = impact;
  const total = summary.receitaComprometida || 1;
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Impacto financeiro</div>
      </div>

      <FinancialBar label="Receita protegida" value={receitaProtegida} total={total} color="var(--v4p-success)" />
      <FinancialBar label="Receita em risco" value={receitaEmRisco} total={total} color="var(--v4p-danger)" />
      <FinancialBar label="Potencial de expansão" value={potencialExpansao} total={total} color="var(--v4p-accent)" />

      <div className="v4p-accent-card v4p-accent-card--stack" style={{ '--v4p-accent-dynamic': 'var(--v4p-success)' }}>
        <div className="v4p-card-header">
          <span className="v4p-detail-row__label">Previsão próximo mês</span>
          <span className="v4p-value-stack__main">{fmt(previsaoProximoMes)}</span>
        </div>
        <div className="v4p-card-subtitle">
          Crescimento esperado: <strong>+{Math.round(crescimentoEsperado * 100)}%</strong>
        </div>
      </div>
    </div>
  );
}

export default memo(FinancialImpactPanel);
