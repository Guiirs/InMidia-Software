import { memo } from 'react';
import { EMPTY_CONTRACTS_SUMMARY } from '../../integration/adapters/contractAdapter.js';

function ContractStatusCard({ summary = EMPTY_CONTRACTS_SUMMARY }) {
  const { total, ativos, vencendoEm30Dias, renovadosEsteMes, receitaComprometida, ticketMedio } = summary;
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-contract-status-grid">
      {[
        { l: 'Contratos ativos', v: ativos, c: 'var(--v4p-success)', icon: 'description', sub: `de ${total} totais` },
        { l: 'Vencendo em 30 dias', v: vencendoEm30Dias, c: 'var(--v4p-warning)', icon: 'event_busy', sub: 'requerem ação' },
        { l: 'Renovados este mês', v: renovadosEsteMes, c: 'var(--v4p-accent)', icon: 'autorenew', sub: 'renovações concluídas' },
        { l: 'Receita comprometida', v: fmt(receitaComprometida), c: 'var(--v4p-text-1)', icon: 'attach_money', sub: `ticket médio ${fmt(ticketMedio)}` },
      ].map(s => (
        <div key={s.l} className="v4p-surface-card v4p-card-compact v4p-contract-status-card" style={{ '--v4p-card-accent': s.c }}>
          <div className="v4p-card-header v4p-metric-card__header">
            <span className="v4p-card-title">{s.l}</span>
            <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">{s.icon}</span>
          </div>
          <div className="v4p-card-title v4p-contract-status-card__value">{s.v}</div>
          <div className="v4p-card-subtitle">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

export default memo(ContractStatusCard);
