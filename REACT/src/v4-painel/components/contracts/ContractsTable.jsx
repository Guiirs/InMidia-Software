import { memo, useState } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';
import { getSeverityMeta } from '../../foundation/severityLevels.js';
import './ContractsTable.css';

const CONTRACT_STATUS = {
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  RENEWED: 'renewed',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  DRAFT: 'draft',
};

const STATUS_META = {
  [CONTRACT_STATUS.ACTIVE]: { label: 'Ativo', color: 'var(--v4p-success)' },
  [CONTRACT_STATUS.EXPIRING]: { label: 'Vencendo', color: 'var(--v4p-warning)' },
  [CONTRACT_STATUS.RENEWED]: { label: 'Renovado', color: 'var(--v4p-accent)' },
  [CONTRACT_STATUS.PAUSED]: { label: 'Pausado', color: 'var(--v4p-text-4)' },
  [CONTRACT_STATUS.EXPIRED]: { label: 'Encerrado', color: 'var(--v4p-danger)' },
  [CONTRACT_STATUS.DRAFT]: { label: 'Rascunho', color: 'var(--v4p-text-4)' },
};

function UrgencyBadge({ dias }) {
  const color = dias <= 10
    ? 'var(--v4p-danger)'
    : dias <= 20
      ? 'var(--v4p-warning)'
      : dias <= 45
        ? 'var(--v4p-accent)'
        : 'var(--v4p-text-4)';

  return (
    <span
      className="v4p-chip v4p-chip--sm v4p-contracts-table__urgency"
      style={{ '--v4p-pill-color': color }}
    >
      {dias <= 20 && <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">schedule</span>}
      {dias}d
    </span>
  );
}

function ContractsTable({ contracts = [], onSelect }) {
  const [sortCol, setSortCol] = useState('diasRestantes');
  const [sortAsc, setSortAsc] = useState(true);
  const rows = contracts;

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortCol];
    const vb = b[sortCol];
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const th = (col, label) => (
    <th
      onClick={() => { sortAsc && sortCol === col ? setSortAsc(false) : setSortAsc(true); setSortCol(col); }}
      className={sortCol === col ? 'is-sorted' : undefined}
      scope="col"
    >
      <span>{label}</span>
      {sortCol === col && (
        <span aria-hidden="true" className="v4p-contracts-table__sort">
          {sortAsc ? 'arrow_upward' : 'arrow_downward'}
        </span>
      )}
    </th>
  );

  const fmt = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <div className="v4p-contracts-table">
      <table>
        <thead>
          <tr>
            {th('id', 'ID')}
            {th('cliente', 'Cliente')}
            {th('regiao', 'Regiao')}
            <th scope="col">Status</th>
            <th scope="col">Risco</th>
            {th('diasRestantes', 'Vencimento')}
            {th('receita', 'Receita')}
            <th scope="col">Renovacao</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="v4p-contracts-table__empty">
                Nenhum contrato encontrado.
              </td>
            </tr>
          )}
          {sorted.map((contract) => {
            const statusMeta = STATUS_META[contract.status] ?? { label: contract.status, color: 'var(--v4p-text-4)' };
            const riskMeta = getSeverityMeta(contract.risco);
            const stateMeta = getStateMeta(contract.estado);
            const renewalColor = contract.probabilidadeRenovacao >= 0.8 ? 'var(--v4p-success)' : 'var(--v4p-warning)';

            return (
              <tr
                key={contract.id}
                onClick={() => onSelect?.(contract)}
                className={onSelect ? 'is-clickable' : undefined}
                style={{ '--v4p-row-accent': stateMeta.color }}
              >
                <td className="v4p-contracts-table__id">
                  <span className="v4p-mono">{contract.id}</span>
                </td>
                <td>
                  <div className="v4p-contracts-table__client">{contract.cliente}</div>
                  <div className="v4p-contracts-table__meta">{contract.placas} placa{contract.placas !== 1 ? 's' : ''}</div>
                </td>
                <td className="v4p-contracts-table__region">
                  <span>{contract.regiao.split(' ')[0]}</span>
                </td>
                <td>
                  <span
                    className="v4p-status-pill v4p-status-pill--sm v4p-contracts-table__status"
                    style={{ '--v4p-pill-color': statusMeta.color }}
                  >
                    {statusMeta.label}
                  </span>
                </td>
                <td>
                  <span
                    className="v4p-chip v4p-chip--sm v4p-contracts-table__risk"
                    style={{ '--v4p-pill-color': riskMeta.color }}
                  >
                    {riskMeta.short}
                  </span>
                </td>
                <td>
                  {contract.diasRestantes != null
                    ? <UrgencyBadge dias={contract.diasRestantes} />
                    : <span className="v4p-contracts-table__empty">-</span>}
                </td>
                <td className="v4p-contracts-table__revenue">
                  <span>{fmt(contract.receita)}/mes</span>
                </td>
                <td>
                  <div className="v4p-contracts-table__renewal">
                    <div
                      className="v4p-contracts-table__renewal-track"
                      style={{
                        '--v4p-progress': `${contract.probabilidadeRenovacao * 100}%`,
                        '--v4p-renewal-color': renewalColor,
                      }}
                    >
                      <div />
                    </div>
                    <span
                      className="v4p-chip v4p-chip--sm v4p-contracts-table__renewal-chip"
                      style={{ '--v4p-pill-color': renewalColor }}
                    >
                      {Math.round(contract.probabilidadeRenovacao * 100)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(ContractsTable);
