import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  getOperationLinkResolutionQueue,
  refreshOperationCanonicalizationDiagnostics,
} from '../../../services/operationAdminService.js';
import { V4Badge, V4Button, V4Card, V4EmptyState, V4SectionHeader, V4Skeleton } from '../ui/index.js';
import { OperationLinkResolutionModal } from './OperationCanonicalizationCard.jsx';

function formatCount(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR');
}

function reasonVariant(reason) {
  return reason === 'AMBIGUOUS' ? 'warning' : 'danger';
}

function priorityVariant(priority) {
  if (priority === 'CRITICAL') return 'danger';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'MEDIUM') return 'info';
  return 'neutral';
}

function normalizeQueueItem(item) {
  return {
    operationId: item.operationId,
    id: item.operationId,
    title: item.safeSummary?.title ?? item.operationId,
    operationType: item.operationType,
    type: item.operationType,
    status: item.operationStatus,
    legacyPlateNumber: item.legacyHints?.legacyPlateNumber ?? null,
    legacyBoardId: item.legacyHints?.legacyBoardId ?? null,
    addressHint: item.legacyHints?.addressHint ?? null,
    reason: item.reason,
    currentReason: item.reason,
  };
}

function SummaryPills({ summary }) {
  return (
    <div className="v4p-ops-link-queue__summary" aria-label="Resumo da fila">
      <span><strong>{formatCount(summary?.total)}</strong> pendentes</span>
      <span><strong>{formatCount(summary?.unresolved)}</strong> unresolved</span>
      <span><strong>{formatCount(summary?.ambiguous)}</strong> ambiguous</span>
      <span><strong>{formatCount(summary?.olderThan7Days)}</strong> +7 dias</span>
      <span><strong>{formatCount(summary?.criticalPriority)}</strong> criticas</span>
    </div>
  );
}

function QueueItem({ item, onResolve }) {
  const hints = [
    item.legacyHints?.legacyPlateNumber ? `Placa: ${item.legacyHints.legacyPlateNumber}` : null,
    item.legacyHints?.legacyBoardId ? `ID legado: ${item.legacyHints.legacyBoardId}` : null,
    item.legacyHints?.addressHint ? `Endereco: ${item.legacyHints.addressHint}` : null,
  ].filter(Boolean);

  return (
    <article className="v4p-ops-link-queue__item">
      <div className="v4p-ops-link-queue__main">
        <div className="v4p-ops-link-queue__title">
          <strong>{item.safeSummary?.title ?? item.operationId}</strong>
          <span>{item.operationType} - {item.operationStatus}</span>
        </div>
        <div className="v4p-ops-link-queue__badges">
          <V4Badge variant={reasonVariant(item.reason)} size="sm">{item.reason}</V4Badge>
          <V4Badge variant={priorityVariant(item.priority)} size="sm">{item.priority}</V4Badge>
        </div>
        <div className="v4p-ops-link-queue__meta">
          <span>{item.ageDays} dia(s)</span>
          <span>Criada em {formatDate(item.createdAt)}</span>
          <span>{formatCount(item.possibleCandidatesCount)} candidato(s)</span>
          {item.lastAttemptAt && <span>Diagnostico {formatDate(item.lastAttemptAt)}</span>}
        </div>
        {hints.length > 0 && (
          <div className="v4p-ops-link-queue__hints">
            {hints.map((hint) => <span key={hint}>{hint}</span>)}
          </div>
        )}
      </div>
      <V4Button type="button" size="sm" variant="primary" onClick={() => onResolve(normalizeQueueItem(item))}>
        Resolver
      </V4Button>
    </article>
  );
}

function OperationLinkResolutionQueue({ onReportRefresh }) {
  const [queue, setQueue] = useState(null);
  const [filters, setFilters] = useState({ status: 'all', operationType: '', search: '', page: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosticRefreshing, setDiagnosticRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [resolutionSample, setResolutionSample] = useState(null);

  const params = useMemo(() => ({
    status: filters.status,
    page: filters.page,
    limit: filters.limit,
    ...(filters.operationType ? { operationType: filters.operationType } : {}),
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
  }), [filters]);

  const loadQueue = useCallback(async ({ silent = false, forceRefresh = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getOperationLinkResolutionQueue(forceRefresh ? { ...params, forceRefresh: true } : params);
      setQueue(data);
    } catch (err) {
      setError(err?.message || 'Nao foi possivel carregar a fila de resolucao.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const handleResolved = useCallback(async () => {
    await loadQueue({ silent: true });
    await onReportRefresh?.();
  }, [loadQueue, onReportRefresh]);

  const handleRefreshDiagnostics = useCallback(async () => {
    setDiagnosticRefreshing(true);
    setError(null);
    try {
      await refreshOperationCanonicalizationDiagnostics();
      await loadQueue({ silent: true, forceRefresh: true });
      await onReportRefresh?.();
    } catch (err) {
      setError(err?.message || 'Nao foi possivel atualizar o diagnostico.');
    } finally {
      setDiagnosticRefreshing(false);
    }
  }, [loadQueue, onReportRefresh]);

  const items = queue?.items ?? [];
  const pagination = queue?.pagination ?? { page: 1, pages: 1, hasNextPage: false, hasPreviousPage: false };

  return (
    <V4Card className="v4p-ops-panel v4p-ops-link-queue">
      <V4SectionHeader
        eyebrow="Admin"
        title="Resolucao de vinculos pendentes"
        description="Fila de operacoes unresolved e ambiguous que exigem escolha explicita de placa."
        actions={<V4Badge variant="warning" size="sm">{formatCount(queue?.summary?.total)} pendentes</V4Badge>}
      />

      <SummaryPills summary={queue?.summary} />

      <div className="v4p-ops-link-queue__filters">
        <label>
          Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="all">Todos</option>
            <option value="unresolved">Unresolved</option>
            <option value="ambiguous">Ambiguous</option>
          </select>
        </label>
        <label>
          Tipo
          <select value={filters.operationType} onChange={(event) => updateFilter('operationType', event.target.value)}>
            <option value="">Todos</option>
            <option value="INSTALLATION">Instalacao</option>
            <option value="SCRAPING">Raspagem</option>
            <option value="MAINTENANCE">Manutencao</option>
            <option value="BLOCK">Bloqueio</option>
            <option value="INSPECTION">Inspecao</option>
            <option value="OTHER">Outras</option>
          </select>
        </label>
        <label>
          Busca
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Placa, endereco ou titulo" />
        </label>
        <V4Button type="button" size="sm" variant="secondary" loading={refreshing} onClick={() => loadQueue({ silent: true })}>
          Atualizar fila
        </V4Button>
        <V4Button type="button" size="sm" variant="secondary" loading={diagnosticRefreshing} onClick={handleRefreshDiagnostics}>
          Atualizar diagnostico
        </V4Button>
      </div>

      {error && <div className="v4p-ops-canon__error" role="alert">{error}</div>}

      {loading ? (
        <V4Skeleton variant="table" rows={4} />
      ) : items.length === 0 ? (
        <V4EmptyState title="Nenhuma resolucao pendente" description="Operacoes unresolved e ambiguous aparecem aqui quando exigirem correcao manual." compact />
      ) : (
        <div className="v4p-ops-link-queue__list">
          {items.map((item) => (
            <QueueItem key={item.operationId} item={item} onResolve={setResolutionSample} />
          ))}
        </div>
      )}

      <div className="v4p-ops-link-queue__pagination">
        <V4Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!pagination.hasPreviousPage}
          onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
        >
          Anterior
        </V4Button>
        <span>Pagina {pagination.page} de {pagination.pages}</span>
        <V4Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!pagination.hasNextPage}
          onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
        >
          Proxima
        </V4Button>
      </div>

      {resolutionSample && (
        <OperationLinkResolutionModal
          sample={resolutionSample}
          onClose={() => setResolutionSample(null)}
          onResolved={handleResolved}
        />
      )}
    </V4Card>
  );
}

export default memo(OperationLinkResolutionQueue);
