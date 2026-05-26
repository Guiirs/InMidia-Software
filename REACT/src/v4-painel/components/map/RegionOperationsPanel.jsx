import { memo } from 'react';

const TYPE_LABEL = {
  INSTALLATION: 'Instalacao',
  SCRAPING: 'Raspagem',
  MAINTENANCE: 'Manutencao',
  BLOCK: 'Bloqueio',
  OTHER: 'Operacao',
};

const STATUS_LABEL = {
  PENDING: 'Pendente',
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluida',
  CANCELLED: 'Cancelada',
};

const PRIORITY_LABEL = {
  CRITICAL: 'Critica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baixa',
};

const SLA_LABEL = {
  ON_TRACK: 'No prazo',
  DUE_SOON: 'Próximo do vencimento',
  OVERDUE: 'Atrasada',
  RESOLVED: 'Resolvida',
  CANCELLED: 'Cancelada',
  UNKNOWN: 'Sem prazo',
};

function formatDate(value) {
  if (!value) return 'Sem prazo';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function OperationCard({ operation }) {
  const priority = operation.priority ?? 'LOW';
  const status = operation.status ?? 'PENDING';
  const slaStatus = operation.slaStatus ?? (operation.overdue ? 'OVERDUE' : 'UNKNOWN');
  const slaPriority = operation.slaPriority ?? priority;

  return (
    <article className={`v4p-region-op-card is-sla-${String(slaStatus).toLowerCase()}`}>
      <div className="v4p-region-op-card__top">
        <span className="v4p-region-op-card__type">{TYPE_LABEL[operation.type] ?? TYPE_LABEL.OTHER}</span>
        <span className={`v4p-region-op-card__priority is-${String(slaPriority).toLowerCase()}`}>
          {PRIORITY_LABEL[slaPriority] ?? slaPriority}
        </span>
      </div>
      <div className="v4p-region-op-card__body">
        <strong>{operation.plateNumber ?? 'Placa nao identificada'}</strong>
        {operation.address && <span>{operation.address}</span>}
      </div>
      <div className="v4p-region-op-card__meta">
        <span className={`v4p-region-op-card__status is-${status.toLowerCase()}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
        <span className={`v4p-region-op-card__sla is-${String(slaStatus).toLowerCase()}`}>
          {SLA_LABEL[slaStatus] ?? 'Sem prazo'}
        </span>
        <span>{formatDate(operation.referenceDueAt ?? operation.dueAt ?? operation.scheduledAt)}</span>
        {operation.assignedTo && <span>{operation.assignedTo}</span>}
        {operation.isOverdue && <b>{operation.overdueMinutes ? `${operation.overdueMinutes} min atraso` : 'Atrasada'}</b>}
      </div>
    </article>
  );
}

function RegionOperationsPanel({ operations = [], summary, loading, error }) {
  const counts = summary ?? { total: operations.length, pending: 0, critical: 0, overdue: 0 };

  return (
    <section className="v4p-region-ops" aria-label="Operacoes regionais">
      <header className="v4p-region-panel-header">
        <div>
          <span className="material-symbols-rounded" aria-hidden="true">task_alt</span>
          <h4>Operacoes regionais</h4>
        </div>
        <span>{counts.pending ?? 0} pendentes</span>
      </header>

      <div className="v4p-region-ops__metrics">
        <div><strong>{counts.total ?? 0}</strong><span>Total</span></div>
        <div><strong>{counts.pending ?? 0}</strong><span>Pendentes</span></div>
        <div><strong>{counts.critical ?? 0}</strong><span>Criticas</span></div>
        <div><strong>{counts.overdue ?? 0}</strong><span>Atrasadas</span></div>
        <div><strong>{counts.dueSoon ?? 0}</strong><span>Vencendo</span></div>
      </div>

      {loading && <div className="v4p-region-panel-state">Carregando operacoes regionais.</div>}
      {!loading && error && <div className="v4p-region-panel-state is-error">{error}</div>}
      {!loading && !error && operations.length === 0 && (
        <div className="v4p-region-panel-state">Nenhuma operacao regional pendente.</div>
      )}
      {!loading && !error && operations.length > 0 && (
        <div className="v4p-region-ops__list">
          {operations.slice(0, 6).map((operation) => (
            <OperationCard key={operation.id} operation={operation} />
          ))}
        </div>
      )}
    </section>
  );
}

export default memo(RegionOperationsPanel);
