import { memo, useEffect, useState } from 'react';
import { getOperationsByPlate } from '../../../services/operationsV4Service.js';

const STATUS_ICON = {
  DONE:        'check_circle',
  CANCELLED:   'cancel',
  IN_PROGRESS: 'pending',
  PENDING:     'schedule',
  SCHEDULED:   'event',
};

const STATUS_COLOR = {
  DONE:        'var(--v4p-success, #10b981)',
  CANCELLED:   'var(--v4p-danger, #ef4444)',
  IN_PROGRESS: 'var(--v4p-warning, #f59e0b)',
  PENDING:     'var(--v4p-text-3, #94a3b8)',
  SCHEDULED:   'var(--v4p-accent, #06b6d4)',
};

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function TeamChip({ teamSnapshot }) {
  if (!teamSnapshot?.name) return null;
  const count = teamSnapshot.memberCount ?? 0;
  return (
    <div className="v4p-plate-history__team" data-testid="history-team">
      <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">groups</span>
      {teamSnapshot.name}
      {count > 0 && (
        <span className="v4p-plate-history__team-count">
          · {count} {count === 1 ? 'integrante' : 'integrantes'}
        </span>
      )}
    </div>
  );
}

function EvidenceList({ evidences }) {
  if (!Array.isArray(evidences) || evidences.length === 0) return null;
  return (
    <div className="v4p-plate-history__evidences" data-testid="history-evidences">
      {evidences.map((ev, index) => {
        const key = ev.id ?? ev.url ?? index;
        const hasUrl = ev.url && ev.url.startsWith('http');
        return (
          <span key={key} className="v4p-plate-history__evidence-chip" title={ev.caption || ev.url || ''}>
            <span className="material-symbols-rounded" style={{ fontSize: 11 }} aria-hidden="true">
              {ev.type === 'FILE' ? 'attach_file' : 'image'}
            </span>
            {hasUrl ? (
              <a href={ev.url} target="_blank" rel="noreferrer noopener" className="v4p-plate-history__evidence-link">
                {ev.caption || `Anexo ${index + 1}`}
              </a>
            ) : (
              <span>{ev.caption || `Anexo ${index + 1}`}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function HistoryItem({ item }) {
  const status = item.operationStatus ?? 'PENDING';
  const icon   = STATUS_ICON[status] ?? 'circle';
  const color  = STATUS_COLOR[status] ?? STATUS_COLOR.PENDING;
  const typeLabel   = item.operationTypeLabel   ?? item.operationType   ?? '—';
  const statusLabel = item.statusLabel          ?? status;

  const activeDate = item.completedAt ?? item.cancelledAt ?? item.startedAt ?? item.scheduledAt ?? item.createdAt;

  return (
    <li
      className="v4p-plate-history__item"
      data-testid="history-item"
      data-status={status}
    >
      <div className="v4p-plate-history__dot" style={{ color }} aria-hidden="true">
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{icon}</span>
      </div>

      <div className="v4p-plate-history__content">
        <div className="v4p-plate-history__row">
          <span className="v4p-plate-history__type" data-testid="history-type">{typeLabel}</span>
          <span
            className="v4p-plate-history__status"
            data-testid="history-status"
            style={{ color }}
          >
            {statusLabel}
          </span>
        </div>

        <TeamChip teamSnapshot={item.teamSnapshot} />

        {activeDate && (
          <div className="v4p-plate-history__date" data-testid="history-date">
            {status === 'DONE' && 'Concluída em: '}
            {status === 'CANCELLED' && 'Cancelada em: '}
            {status === 'IN_PROGRESS' && 'Iniciada em: '}
            {(status === 'PENDING' || status === 'SCHEDULED') && 'Agendada em: '}
            {formatDate(activeDate)}
          </div>
        )}

        {item.finalReport && (
          <div className="v4p-plate-history__report" data-testid="history-report">
            <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">description</span>
            {item.finalReport}
          </div>
        )}

        {item.completionNotes && (
          <div className="v4p-plate-history__notes" data-testid="history-notes">
            {item.completionNotes}
          </div>
        )}

        <EvidenceList evidences={item.evidences} />

        {status === 'CANCELLED' && item.payload?.cancellationReason && (
          <div className="v4p-plate-history__cancel-reason" data-testid="history-cancel-reason">
            Motivo: {item.payload.cancellationReason}
          </div>
        )}
      </div>
    </li>
  );
}

function PlateOperationHistory({ plateId, refreshKey = 0, className = '' }) {
  const [state, setState] = useState({ status: 'idle', items: [], total: 0 });

  useEffect(() => {
    if (!plateId) return;
    let cancelled = false;
    setState({ status: 'loading', items: [], total: 0 });
    getOperationsByPlate(plateId)
      .then((payload) => {
        if (cancelled) return;
        const items = Array.isArray(payload?.items) ? payload.items
          : Array.isArray(payload?.tasks) ? payload.tasks
          : [];
        setState({ status: 'success', items, total: payload?.total ?? items.length });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', items: [], total: 0 });
      });
    return () => { cancelled = true; };
  }, [plateId, refreshKey]);

  if (!plateId) return null;

  if (state.status === 'loading') {
    return (
      <section className={`v4p-plate-history ${className}`} data-testid="plate-operation-history">
        <h4 className="v4p-plate-history__title">Histórico operacional</h4>
        <p className="v4p-plate-history__empty">Carregando histórico…</p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className={`v4p-plate-history ${className}`} data-testid="plate-operation-history">
        <h4 className="v4p-plate-history__title">Histórico operacional</h4>
        <p className="v4p-plate-history__empty v4p-plate-history__empty--error">
          Não foi possível carregar o histórico.
        </p>
      </section>
    );
  }

  return (
    <section className={`v4p-plate-history ${className}`} data-testid="plate-operation-history">
      <h4 className="v4p-plate-history__title">
        Histórico operacional
        {state.total > 0 && (
          <span className="v4p-plate-history__count" data-testid="history-count">
            {state.total}
          </span>
        )}
      </h4>

      {state.items.length === 0 ? (
        <p className="v4p-plate-history__empty" data-testid="history-empty">
          Nenhuma operação registrada para esta placa.
        </p>
      ) : (
        <ol className="v4p-plate-history__list" aria-label="Histórico de operações" data-testid="history-list">
          {state.items.map((item) => (
            <HistoryItem key={item.id ?? item.realId} item={item} />
          ))}
        </ol>
      )}
    </section>
  );
}

export default memo(PlateOperationHistory);
