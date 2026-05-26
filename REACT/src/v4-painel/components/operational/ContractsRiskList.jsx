import { memo } from 'react';
import { getSeverityMeta } from '../../foundation/severityLevels.js';
import { getStateMeta } from '../../foundation/operationalStates.js';

function DaysUrgencyBar({ dias }) {
  const max = 30;
  const pct = Math.max(0, Math.min(100, (1 - dias / max) * 100));
  const color = dias <= 7 ? 'var(--v4p-danger)' : dias <= 15 ? 'var(--v4p-warning)' : 'var(--v4p-accent)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: 'var(--v4p-border)', borderRadius: 'var(--v4p-r-full)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 'var(--v4p-r-full)', transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{dias}d</span>
    </div>
  );
}

function ContractRow({ contract, isLast }) {
  const severityMeta = getSeverityMeta(contract.risco);
  const stateMeta    = getStateMeta(contract.estado);

  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--v4p-border-soft)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span className="v4p-mono" style={{ fontSize: 11, color: stateMeta.color }}>{contract.id}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
            {contract.cliente}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--v4p-text-4)', marginBottom: 3 }}>
          {contract.regiao} · {contract.valor}
        </div>
        <div style={{ fontSize: 11, color: 'var(--v4p-text-3)', fontStyle: 'italic' }}>
          {contract.recomendacao}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <DaysUrgencyBar dias={contract.diasRestantes} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v4p-text-1)' }}>{contract.impacto}</span>
        <span style={{ fontSize: 10, color: severityMeta.color, fontWeight: 600 }}>{contract.probabilidade}</span>
      </div>
    </div>
  );
}

function ContractsRiskList({ contracts = [] }) {
  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--v4p-warning)' }}>event_busy</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Contratos em risco</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{contracts.length} contratos — vencendo em menos de 30 dias</div>
        </div>
      </div>
      {contracts.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '12px 0' }}>Nenhum contrato em risco iminente.</div>
      ) : (
        contracts.map((c, i) => (
          <ContractRow key={c.id} contract={c} isLast={i === contracts.length - 1} />
        ))
      )}
    </div>
  );
}

export default memo(ContractsRiskList);
