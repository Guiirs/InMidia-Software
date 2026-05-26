import { memo } from 'react';
import { getSeverityMeta, SEVERITY } from '../../foundation/severityLevels.js';
import { getStateMeta } from '../../foundation/operationalStates.js';

const CONTRACT_STATUS = {
  EXPIRING: 'expiring',
};

function RiskRow({ contract }) {
  const rMeta = getSeverityMeta(contract.risco);
  const sMeta = getStateMeta(contract.estado);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-list-item v4p-list-item--grid">
      <div className="v4p-list-item__content">
        <div className="v4p-risk-row__heading">
          <span className="v4p-mono v4p-risk-row__id" style={{ color: sMeta.color }}>{contract.id}</span>
          <span className="v4p-list-item__title">{contract.cliente}</span>
        </div>
        <div className="v4p-list-item__copy">{contract.regiao} · vence em {contract.diasRestantes} dias</div>
        <div className="v4p-list-item__note">→ {contract.acaoRecomendada}</div>
      </div>
      <div className="v4p-value-stack">
        <div className="v4p-value-stack__main" style={{ '--v4p-accent-dynamic': rMeta.color }}>{fmt(contract.receita)}/mês</div>
        <div className="v4p-value-stack__sub">{fmt(contract.impactoAnual)}/ano</div>
        <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': rMeta.color, '--v4p-pill-border': `color-mix(in srgb, ${rMeta.color} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${rMeta.color} 12%, transparent)` }}>{rMeta.short}</span>
      </div>
    </div>
  );
}

function ContractRiskPanel({ contracts = [] }) {
  const risky = contracts
    .filter(c => c.status === CONTRACT_STATUS.EXPIRING || c.risco === SEVERITY.CRITICAL || c.risco === SEVERITY.HIGH)
    .sort((a, b) => (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999));

  const totalRisco = risky.reduce((s, c) => s + c.receita, 0);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-medium-panel__title-row">
          <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded" style={{ color: 'var(--v4p-danger)' }}>emergency</span>
          <div>
            <div className="v4p-card-title">Contratos em risco</div>
            <div className="v4p-card-subtitle">{risky.length} contratos · {fmt(totalRisco)}/mês em risco</div>
          </div>
        </div>
      </div>
      <div className="v4p-compact-list">
        {risky.length === 0 && (
          <div className="v4p-list-item__copy">Nenhum contrato em risco encontrado.</div>
        )}
        {risky.map(c => <RiskRow key={c.id} contract={c} />)}
      </div>
    </div>
  );
}

export default memo(ContractRiskPanel);
