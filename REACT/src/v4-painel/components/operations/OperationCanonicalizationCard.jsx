import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { listBoards } from '../../../services/inventoryV4Service.js';
import {
  getCanonicalizationReport,
  getOperationLinkResolutionContext,
  resolveOperationPlateLink,
  runOperationPlateBackfill,
} from '../../../services/operationAdminService.js';
import { V4Badge, V4Button, V4Card, V4SectionHeader, V4Skeleton } from '../ui/index.js';

function formatCount(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatRate(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

export function getCanonicalizationStatus(rate) {
  const value = Number(rate || 0);
  if (value >= 95) return { label: 'Saudável', variant: 'success', className: 'is-healthy' };
  if (value >= 75) return { label: 'Atenção', variant: 'warning', className: 'is-warning' };
  return { label: 'Crítico', variant: 'danger', className: 'is-critical' };
}

function Metric({ label, value }) {
  return (
    <div className="v4p-ops-canon__metric">
      <strong>{formatCount(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

function RateMetric({ label, value }) {
  return (
    <div className="v4p-ops-canon__metric">
      <strong>{formatRate(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

function Breakdown({ title, data = {} }) {
  const rows = Object.entries(data).slice(0, 6);
  if (rows.length === 0) return null;

  return (
    <details className="v4p-ops-canon__details">
      <summary>{title}</summary>
      <div className="v4p-ops-canon__breakdown">
        {rows.map(([key, value]) => (
          <div key={key}>
            <strong>{key}</strong>
            <span>{formatCount(value.total)} total</span>
            <span>{formatCount(value.canonical)} canonicas</span>
            <span>{formatCount(value.legacyOnly)} legado</span>
            <span>{formatCount(value.unresolved)} unresolved</span>
            {Number(value.ambiguous ?? 0) > 0 && <span>{formatCount(value.ambiguous)} ambiguous</span>}
          </div>
        ))}
      </div>
    </details>
  );
}

function Samples({ title, items = [], onResolve }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <details className="v4p-ops-canon__details">
      <summary>{title}</summary>
      <div className="v4p-ops-canon__samples">
        {items.slice(0, 5).map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.title || item.operationId || item.id}</strong>
              <span>{item.operationType ?? item.type} - {item.status}</span>
              {item.legacyPlateNumber && <span>Placa legado: {item.legacyPlateNumber}</span>}
              {item.addressHint && <span>Endereco: {item.addressHint}</span>}
            </div>
            {item.reason && <em>{item.reason}</em>}
            {onResolve && (
              <button type="button" onClick={() => onResolve(item)}>
                Resolver
              </button>
            )}
          </article>
        ))}
      </div>
    </details>
  );
}

export function OperationLinkResolutionModal({ sample, onClose, onResolved }) {
  const operationId = sample?.operationId ?? sample?.id;
  const [context, setContext] = useState(null);
  const [query, setQuery] = useState('');
  const [boards, setBoards] = useState([]);
  const [selectedPlateId, setSelectedPlateId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!operationId) return;
    setLoading(true);
    setError(null);
    getOperationLinkResolutionContext(operationId)
      .then((data) => {
        setContext(data);
        if (Array.isArray(data?.candidates) && data.candidates.length === 1) {
          setSelectedPlateId(data.candidates[0].plateId);
        }
      })
      .catch((err) => setError(err?.message || 'Nao foi possivel carregar o contexto.'))
      .finally(() => setLoading(false));
  }, [operationId]);

  const searchBoards = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      const result = await listBoards({ search: query, limit: 20 });
      setBoards(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.message || 'Nao foi possivel buscar placas.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedPlateId) {
      setError('Selecione uma placa.');
      return;
    }
    if (!reason.trim()) {
      setError('Informe o motivo da correcao.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resolveOperationPlateLink(operationId, { plateId: selectedPlateId, reason: reason.trim() });
      await onResolved?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Nao foi possivel vincular a placa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!sample) return null;
  const candidates = context?.candidates ?? [];
  const safeOperation = context?.operation ?? sample;
  const options = [
    ...candidates.map((candidate) => ({
      id: candidate.plateId,
      label: `${candidate.plateNumber ?? candidate.plateId} - ${candidate.address ?? 'sem endereco'}`,
    })),
    ...boards.map((board) => ({
      id: board.id,
      label: `${board.codigo ?? board.numero_placa ?? board.id} - ${board.localizacao ?? board.nomeDaRua ?? 'sem endereco'}`,
    })),
  ].filter((item, index, arr) => item.id && arr.findIndex((candidate) => candidate.id === item.id) === index);

  return (
    <div className="v4p-ops-link-modal" role="dialog" aria-modal="true" aria-label="Resolver vinculo de placa">
        <form className="v4p-ops-link-modal__panel" onSubmit={submit} noValidate>
        <header>
          <div>
            <span>Resolucao manual</span>
            <h3>Vincular operacao a placa</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">x</button>
        </header>

        {loading ? (
          <V4Skeleton variant="card" />
        ) : (
          <>
            <section className="v4p-ops-link-modal__context">
              <strong>{safeOperation.title || safeOperation.operationId}</strong>
              <span>{safeOperation.operationType ?? safeOperation.type} - {safeOperation.status}</span>
              {safeOperation.legacyPlateNumber && <span>Placa legado: {safeOperation.legacyPlateNumber}</span>}
              {safeOperation.legacyBoardId && <span>ID legado: {safeOperation.legacyBoardId}</span>}
              {safeOperation.addressHint && <span>Endereco: {safeOperation.addressHint}</span>}
              {context?.reason && <em>{context.reason}</em>}
            </section>

            <label>
              Buscar placa
              <div className="v4p-ops-link-modal__search">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Codigo ou localizacao" />
                <button type="button" onClick={searchBoards} disabled={searching}>
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </label>

            <label>
              Placa
              <select value={selectedPlateId} onChange={(event) => setSelectedPlateId(event.target.value)}>
                <option value="">Selecione uma placa</option>
                {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>

            <label>
              Motivo da correcao
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={3} />
            </label>

            <p className="v4p-ops-link-modal__notice">Esta acao sera auditada e nao remove os campos legados.</p>
          </>
        )}

        {error && <div className="v4p-ops-canon__error" role="alert">{error}</div>}

        <footer>
          <V4Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</V4Button>
          <V4Button type="submit" variant="primary" size="sm" loading={submitting}>Vincular placa</V4Button>
        </footer>
      </form>
    </div>
  );
}

function BackfillResult({ result }) {
  if (!result) return null;
  return (
    <div className="v4p-ops-canon__result" role="status">
      <strong>Backfill concluído</strong>
      <div>
        <span>{formatCount(result.totalAnalyzed)} analisadas</span>
        <span>{formatCount(result.updated)} atualizadas</span>
        <span>{formatCount(result.skippedAlreadyCanonical)} canônicas</span>
        <span>{formatCount(result.unresolved)} unresolved</span>
        <span>{formatCount(result.ambiguous)} ambiguous</span>
        <span>{formatCount(result.matchedByLegacyId)} por ID legado</span>
        <span>{formatCount(result.matchedByPlateNumber)} por numero</span>
      </div>
      {Array.isArray(result.errors) && result.errors.length > 0 && (
        <p>{formatCount(result.errors.length)} erro(s) exigem revisão.</p>
      )}
    </div>
  );
}

function OperationCanonicalizationCard({ canRunBackfill = false, refreshSignal = 0 }) {
  const [report, setReport] = useState(null);
  const [backfillResult, setBackfillResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState(null);
  const [resolutionSample, setResolutionSample] = useState(null);

  const status = useMemo(
    () => getCanonicalizationStatus(report?.canonicalizationRate),
    [report?.canonicalizationRate],
  );

  const loadReport = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getCanonicalizationReport();
      setReport(data);
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar o relatório.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport, refreshSignal]);

  const handleBackfill = useCallback(async () => {
    setBackfilling(true);
    setError(null);
    try {
      const result = await runOperationPlateBackfill();
      setBackfillResult(result);
      await loadReport({ silent: true });
    } catch (err) {
      setError(err?.message || 'Não foi possível executar o backfill.');
    } finally {
      setBackfilling(false);
    }
  }, [loadReport]);

  const handleResolved = useCallback(async () => {
    setBackfillResult(null);
    await loadReport({ silent: true });
  }, [loadReport]);

  const rate = Number(report?.canonicalizationRate || 0);

  return (
    <V4Card className={`v4p-ops-panel v4p-ops-canon ${status.className}`}>
      <V4SectionHeader
        eyebrow="Admin"
        title="Saúde operacional"
        description="Operações canônicas são aquelas vinculadas diretamente a uma placa pelo campo plateId."
        actions={<V4Badge variant={status.variant} size="sm">{status.label}</V4Badge>}
      />

      {loading ? (
        <V4Skeleton variant="card" />
      ) : (
        <>
          {error && <div className="v4p-ops-canon__error" role="alert">{error}</div>}

          <div className="v4p-ops-canon__hero">
            <strong>{formatRate(rate)}</strong>
            <span>canonicalização</span>
          </div>

          <div className="v4p-ops-canon__bar" style={{ '--canon-rate': `${Math.max(0, Math.min(100, rate))}%` }}>
            <span />
          </div>

          <div className="v4p-ops-canon__metrics">
            <Metric label="Total" value={report?.totalOperations} />
            <Metric label="Canônicas" value={report?.canonicalOperations} />
            <Metric label="Legado-only" value={report?.legacyOnlyOperations} />
            <Metric label="Unresolved" value={report?.unresolvedOperations} />
            <Metric label="Ambiguous" value={report?.ambiguousOperations} />
            <RateMetric label="Taxa legado" value={report?.legacyRate} />
            <RateMetric label="Taxa unresolved" value={report?.unresolvedRate} />
          </div>

          {Number(report?.ambiguousOperations ?? 0) > 0 && (
            <div className="v4p-ops-canon__warning">
              Ambiguous precisa de correcao manual: o backfill encontrou mais de uma placa possivel.
            </div>
          )}

          <Breakdown title="Breakdown por tipo" data={report?.byOperationType} />
          <Breakdown title="Breakdown por status" data={report?.byOperationStatus} />
          <Samples title="Exemplos unresolved" items={report?.samples?.unresolved} onResolve={setResolutionSample} />
          <Samples title="Exemplos ambiguous" items={report?.samples?.ambiguous} onResolve={setResolutionSample} />

          <BackfillResult result={backfillResult} />

          <div className="v4p-ops-canon__actions">
            <V4Button type="button" size="sm" variant="secondary" loading={refreshing} onClick={() => loadReport({ silent: true })}>
              Atualizar relatório
            </V4Button>
            {canRunBackfill && (
              <V4Button type="button" size="sm" variant="primary" loading={backfilling} onClick={handleBackfill}>
                Rodar backfill
              </V4Button>
            )}
          </div>
        </>
      )}
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

export default memo(OperationCanonicalizationCard);
