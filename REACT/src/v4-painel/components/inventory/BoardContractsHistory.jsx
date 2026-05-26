import { memo } from 'react';

const STATUS_META = {
  active:   { label: 'Ativo',     color: 'var(--v4p-success)' },
  closed:   { label: 'Encerrado', color: 'var(--v4p-text-4)'  },
  pending:  { label: 'Pendente',  color: 'var(--v4p-warning)'  },
  canceled: { label: 'Cancelado', color: 'var(--v4p-danger)'   },
};

function fmtDate(s) {
  if (!s || s === '—') return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function fmtMoney(v) {
  if (!v) return '—';
  return `R$ ${v.toLocaleString('pt-BR')}/mês`;
}

function ContractRow({ contract }) {
  const meta = STATUS_META[contract.status] ?? STATUS_META.closed;
  return (
    <div className="v4p-contracts__row">
      <div className="v4p-contracts__row-main">
        <div className="v4p-contracts__client">{contract.cliente}</div>
        <div className="v4p-contracts__campaign">{contract.campanha}</div>
      </div>
      <div className="v4p-contracts__row-meta">
        <span className="v4p-contracts__period">
          {fmtDate(contract.inicio)} → {fmtDate(contract.fim)}
        </span>
        <span className="v4p-contracts__value">{fmtMoney(contract.valorMensal)}</span>
      </div>
      <div className="v4p-contracts__row-end">
        <span className="v4p-contracts__status" style={{ color: meta.color }}>
          {meta.label}
        </span>
        {contract.renovacao && (
          <span className="v4p-contracts__renewal">
            <span className="material-symbols-rounded" style={{ fontSize: 10 }}>autorenew</span>
            Renovado
          </span>
        )}
        <span className="v4p-contracts__resp">{contract.responsavelComercial}</span>
      </div>
    </div>
  );
}

function BoardContractsHistory({ contracts }) {
  if (!contracts?.length) {
    return (
      <section className="v4p-contracts">
        <header className="v4p-contracts__header">
          <span className="material-symbols-rounded v4p-contracts__header-icon">contract</span>
          <div>
            <h3>Contratos recentes</h3>
            <p>Histórico de contratos da placa</p>
          </div>
        </header>
        <div className="v4p-contracts__empty">Nenhum contrato registrado.</div>
      </section>
    );
  }

  const active = contracts.filter((c) => c.status === 'active').length;

  return (
    <section className="v4p-contracts">
      <header className="v4p-contracts__header">
        <span className="material-symbols-rounded v4p-contracts__header-icon" aria-hidden="true">contract</span>
        <div>
          <h3>Contratos recentes</h3>
          <p>{contracts.length} contratos · {active > 0 ? `${active} ativo` : 'nenhum ativo'}</p>
        </div>
      </header>

      <div className="v4p-contracts__head-row">
        <span>Cliente / Campanha</span>
        <span>Período / Valor</span>
        <span>Status / Responsável</span>
      </div>

      <div className="v4p-contracts__list">
        {contracts.map((c) => (
          <ContractRow key={c.id} contract={c} />
        ))}
      </div>
    </section>
  );
}

export default memo(BoardContractsHistory);
