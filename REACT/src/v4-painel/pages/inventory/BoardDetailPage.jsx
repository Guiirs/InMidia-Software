import { memo, useCallback, useEffect, useState } from 'react';
import BoardStatusBadge       from '../../components/inventory/BoardStatusBadge.jsx';
import BoardEditPanel         from '../../components/inventory/BoardEditPanel.jsx';
import BoardGeoPanel          from '../../components/inventory/BoardGeoPanel.jsx';
import BoardContractsHistory  from '../../components/inventory/BoardContractsHistory.jsx';
import BoardActivityHistory   from '../../components/inventory/BoardActivityHistory.jsx';
import { getStateMeta }       from '../../foundation/operationalStates.js';
import { getPriorityMeta }    from '../../foundation/priorities.js';
import { getSeverityMeta }    from '../../foundation/severityLevels.js';
import ContractsProvider, { useContracts } from '../../providers/ContractsProvider.jsx';
import './BoardDetailPage.css';

/* ── Priority → semantic chip class ──────────────────────────── */
const PRIORITY_CHIP_CLASS = {
  urgent: 'v4p-chip--danger',
  high:   'v4p-chip--warning',
  normal: 'v4p-chip--neutral',
  low:    'v4p-chip--neutral',
};

/* ── helpers ──────────────────────────────────────────────────── */
function fmtDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${String(y).slice(2)}`;
}
function fmtMoney(v) {
  if (!v) return 'R$ 0';
  return `R$ ${v.toLocaleString('pt-BR')}`;
}
function Section({ children, className = '' }) {
  return <section className={`v4p-bdp__section ${className}`}>{children}</section>;
}
function DataRow({ label, value, mono }) {
  return (
    <div className="v4p-bdp__data-row">
      <span className="v4p-bdp__data-label">{label}</span>
      <span className={`v4p-bdp__data-value${mono ? ' v4p-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}
function Stat({ label, value, color, sub }) {
  return (
    <article className="v4p-bdp__stat">
      <span className="v4p-bdp__stat-label">{label}</span>
      <strong className="v4p-bdp__stat-value" style={{ color }}>{value}</strong>
      {sub && <span className="v4p-bdp__stat-sub">{sub}</span>}
    </article>
  );
}

function buildExtendedBoard(board) {
  return {
    ...board,
    city: board.regiao ?? 'Sem regiao',
    uf: null,
    operationalRegion: board.regiao,
    address: board.localizacao,
    zone: null,
    referencePoint: null,
    estimatedFlow: null,
    visibilityScore: null,
    format: board.categoria,
    dimensions: null,
    face: null,
    material: null,
    lighting: null,
    condition: null,
    lastInspection: null,
    operationalOwner: null,
    performance: {
      taxaOcupacao: board.ocupacao ?? 0,
      receitaAcumulada: board.ocupado ? board.receitaEstimada : 0,
      diasOcupada: null,
      diasDisponivel: board.diasOcioso ?? null,
      potencialMensal: board.receitaEstimada ?? 0,
      mediaRegiao: null,
    },
    recommendations: {
      operacional: board.recomendacao,
    },
    recentContracts: [],
    activityHistory: [],
  };
}
function PerfBar({ label, pct, color }) {
  return (
    <div className="v4p-bdp__perf-bar">
      <div className="v4p-bdp__perf-bar-head">
        <span>{label}</span>
        <span>{Math.round((pct ?? 0) * 100)}%</span>
      </div>
      <div className="v4p-bdp__perf-bar-track">
        <div
          className="v4p-bdp__perf-bar-fill"
          style={{ width: `${Math.round((pct ?? 0) * 100)}%`, background: color ?? 'var(--v4p-accent)' }}
        />
      </div>
    </div>
  );
}
function ImageWithFallback({ src, alt, fallbackStyle, codigo }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className="v4p-bdp__hero-img-fallback" style={fallbackStyle}>
        <span className="v4p-mono" style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
          {codigo}
        </span>
      </div>
    );
  }
  return (
    <img
      className="v4p-bdp__hero-img"
      src={src}
      alt={alt ?? `Placa ${codigo}`}
      onError={() => setFailed(true)}
    />
  );
}

/* ── BoardDetailPage ─────────────────────────────────────────── */
function BoardDetailPageInner({
  board: boardProp,
  onBack,
  onSave,
  onToggleAvailability,
  onNavigateToMap,
  actionLoading,
  actionError,
  onClearActionError,
}) {
  const [editing, setEditing]   = useState(false);
  const [board, setBoard]       = useState(boardProp);
  const [actionToast, setActionToast] = useState(null);
  const [localActionLoading, setLocalActionLoading] = useState(false);
  const [boardContracts, setBoardContracts] = useState([]);
  const contractsApi = useContracts();

  /* Sincroniza board externo quando o provider reconcilia com resposta real */
  useEffect(() => {
    setBoard(boardProp);
  }, [boardProp]);

  const showToast = useCallback((message, icon = 'check_circle') => {
    setActionToast({ message, icon });
    setTimeout(() => setActionToast(null), 3000);
  }, []);

  const ext          = buildExtendedBoard(board);
  const stateMeta    = getStateMeta(board.estado);
  const priorityMeta = getPriorityMeta(board.prioridade);
  const riskMeta     = getSeverityMeta(board.risco);
  const perf         = ext.performance ?? {};
  const rec          = ext.recommendations ?? {};

  useEffect(() => {
    let alive = true;
    const fallback = ext.recentContracts ?? [];
    setBoardContracts(fallback);

    contractsApi.getByBoard(board.id, fallback).then((contracts) => {
      if (alive) setBoardContracts(contracts);
    });

    return () => {
      alive = false;
    };
  }, [board.id, contractsApi]); // eslint-disable-line react-hooks/exhaustive-deps

  const fallbackStyle = {
    background: `linear-gradient(${((String(board?.id ?? board?.codigo ?? 'A').charCodeAt(0) || 65) * 37) % 360}deg, ${stateMeta.colorSoft}, rgba(0,0,0,0.55))`,
  };

  const handleSave = useCallback(async (updated) => {
    setBoard(updated);
    setEditing(false);
    await onSave?.(updated);
    showToast('Alterações salvas', 'check_circle');
  }, [onSave, showToast]);

  /* ── Reservar / Disponibilizar ────────────────────────────── */
  const canToggleAvailability = board.status === 'available' || board.status === 'maintenance';
  const isUnavailable = board.status === 'maintenance';
  const isBusy     = actionLoading || localActionLoading;

  const handleReserve = useCallback(async () => {
    if (isBusy || !onToggleAvailability) return;

    setLocalActionLoading(true);
    try {
      const saved = await onToggleAvailability(board);
      if (saved && saved.id) setBoard(saved);
      showToast(
        saved?.status === 'available' ? 'Placa disponibilizada' : 'Placa indisponibilizada',
        saved?.status === 'available' ? 'lock_open' : 'block',
      );
    } finally {
      setLocalActionLoading(false);
    }
  }, [board, isBusy, onToggleAvailability, showToast]);

  /* ── Ver no mapa ──────────────────────────────────────────── */
  const handleViewOnMap = useCallback(() => {
    if (onNavigateToMap) {
      onNavigateToMap(board);
    } else {
      showToast('Navegação para o mapa não disponível neste contexto.', 'info');
    }
  }, [board, onNavigateToMap, showToast]);

  const occupancyPct = Math.round((board.ocupacao ?? 0) * 100);
  const priorityChipClass = PRIORITY_CHIP_CLASS[board.prioridade] ?? 'v4p-chip--neutral';

  return (
    <div className="v4p-bdp" style={{ '--v4p-bdp-accent': stateMeta.color }}>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <header className="v4p-bdp__header">
        <div className="v4p-bdp__header-left">
          <button type="button" className="v4p-bdp__back" onClick={onBack}>
            <span className="material-symbols-rounded" style={{ fontSize: 17 }}>arrow_back</span>
            Voltar ao inventário
          </button>
          <div className="v4p-bdp__header-title">
            <span className="v4p-bdp__eyebrow">Detalhe da placa</span>
            <h1>
              <span className="v4p-mono v4p-bdp__code">{board.codigo}</span>
              <span className="v4p-bdp__sep">·</span>
              {board.nome}
            </h1>
            <p className="v4p-bdp__subtitle">
              {ext.city ?? board.regiao}
              {ext.uf ? `, ${ext.uf}` : ''}
              {' · '}{board.regiao}
              {ext.operationalRegion ? ` — ${ext.operationalRegion}` : ''}
            </p>
          </div>
        </div>
        <div className="v4p-bdp__header-right">
          <BoardStatusBadge status={board.status} />
          <span className={`v4p-chip v4p-chip--sm ${priorityChipClass}`}>
            {priorityMeta.label}
          </span>
          <div className="v4p-bdp__header-actions">
            <button
              type="button"
              className="v4p-bdp__action-btn v4p-bdp__action-btn--primary"
              onClick={() => setEditing(true)}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 15 }}>edit</span>
              Editar placa
            </button>

            {canToggleAvailability && (
              <button
                type="button"
                className={`v4p-bdp__action-btn${isUnavailable ? ' v4p-bdp__action-btn--reserved' : ' v4p-bdp__action-btn--reserve'}`}
                onClick={handleReserve}
                disabled={isBusy}
                aria-label={isUnavailable ? `Disponibilizar placa ${board.codigo}` : `Indisponibilizar placa ${board.codigo}`}
                style={isBusy ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
                  {isBusy ? 'pending' : (isUnavailable ? 'lock_open' : 'block')}
                </span>
                {isBusy ? '...' : (isUnavailable ? 'Disponibilizar' : 'Indisponibilizar')}
              </button>
            )}

            <button
              type="button"
              className="v4p-bdp__action-btn"
              onClick={handleViewOnMap}
              aria-label={`Ver placa ${board.codigo} no mapa`}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 15 }}>map</span>
              Ver no mapa
            </button>
          </div>
        </div>
      </header>

      {/* ── Action error banner ───────────────────────────────── */}
      {actionError && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 14px', borderRadius: 'var(--v4p-r-md)',
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)',
            color: 'var(--v4p-danger)', fontSize: 12, fontWeight: 500,
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14, flexShrink: 0 }}>sync_problem</span>
          <span>{actionError}</span>
          {onClearActionError && (
            <button
              type="button"
              onClick={onClearActionError}
              style={{
                marginLeft: 'auto', height: 24, padding: '0 9px', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 'var(--v4p-r-sm)', background: 'transparent',
                color: 'var(--v4p-danger)', fontFamily: 'var(--v4p-font)',
                fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Fechar
            </button>
          )}
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────── */}
      <div className="v4p-bdp__hero">
        <div className="v4p-bdp__hero-img-col">
          <div className="v4p-bdp__hero-img-wrap">
            <ImageWithFallback
              src={board.imageUrl}
              alt={board.imageAlt}
              fallbackStyle={fallbackStyle}
              codigo={board.codigo}
            />
            <div className="v4p-bdp__hero-img-overlay" />
            <div className="v4p-bdp__hero-img-badges">
              <BoardStatusBadge status={board.status} />
            </div>
          </div>
        </div>

        <div className="v4p-bdp__hero-summary">
          <div className="v4p-bdp__hero-summary-title">Resumo operacional</div>

          <div className="v4p-bdp__hero-stats">
            <Stat label="Receita/mês"     value={board.receitaFormatada} color="var(--v4p-success)" />
            <Stat label="Disponibilidade" value={board.ocupado ? 'Ocupada' : 'Livre'}
              color={board.ocupado ? 'var(--v4p-success)' : 'var(--v4p-accent)'} />
            <Stat label="Ocupação atual"  value={`${occupancyPct}%`}
              color={occupancyPct > 0 ? 'var(--v4p-success)' : 'var(--v4p-text-3)'} />
            <Stat label="Potencial/mês"   value={fmtMoney(perf.potencialMensal)} color="var(--v4p-text-2)" />
          </div>

          <div className="v4p-bdp__hero-detail">
            {board.campanha ? (
              <>
                <DataRow label="Campanha atual" value={board.campanha} />
                <DataRow label="Cliente" value={board.cliente} />
                <DataRow label="Vencimento" value={fmtDate(board.vencimento) ?? 'Indeterminado'} />
              </>
            ) : (
              <div className="v4p-bdp__available-notice">
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>radio_button_unchecked</span>
                Disponível para nova campanha
              </div>
            )}
            <DataRow label="Categoria"        value={board.categoria} />
            <DataRow label="Visibilidade"     value={board.visibilidade} />
            <DataRow label="Risco"            value={riskMeta.label} />
            <DataRow label="Última atividade" value={board.ultimaAtividade} />
          </div>

          <div className="v4p-bdp__hero-note">{board.statusDetalhe}</div>
        </div>
      </div>

      {/* ── ROW 2: Geo + Técnico ──────────────────────────────── */}
      <div className="v4p-bdp__row2">
        <BoardGeoPanel board={ext} />

        <section className="v4p-bdp__technical">
          <header className="v4p-bdp__section-head">
            <span className="material-symbols-rounded v4p-bdp__section-icon" aria-hidden="true">settings</span>
            <div>
              <h3>Dados operacionais</h3>
              <p>Especificações técnicas da placa</p>
            </div>
          </header>
          <div className="v4p-bdp__data-grid">
            <DataRow label="Formato"         value={ext.format} />
            <DataRow label="Dimensões"        value={ext.dimensions} />
            <DataRow label="Face"             value={ext.face} />
            <DataRow label="Material"         value={ext.material} />
            <DataRow label="Iluminação"       value={ext.lighting} />
            <DataRow label="Condição"         value={ext.condition} />
            <DataRow label="Última vistoria"  value={fmtDate(ext.lastInspection)} />
            <DataRow label="Responsável op."  value={ext.operationalOwner} />
          </div>
          <div className="v4p-bdp__perf-bars">
            <PerfBar label="Taxa de ocupação (período)" pct={perf.taxaOcupacao} color="var(--v4p-success)" />
            {perf.mediaRegiao != null && perf.potencialMensal != null && (
              <PerfBar
                label="Média da região"
                pct={perf.mediaRegiao / perf.potencialMensal}
                color="var(--v4p-info)"
              />
            )}
          </div>
        </section>
      </div>

      {/* ── ROW 3: Contratos + Performance ───────────────────── */}
      <div className="v4p-bdp__row3">
        <BoardContractsHistory contracts={boardContracts} />

        <section className="v4p-bdp__performance">
          <header className="v4p-bdp__section-head">
            <span className="material-symbols-rounded v4p-bdp__section-icon" aria-hidden="true">bar_chart</span>
            <div>
              <h3>Performance da placa</h3>
              <p>Métricas de ocupação e receita</p>
            </div>
          </header>
          <div className="v4p-bdp__perf-stats">
            <Stat label="Receita acumulada" value={fmtMoney(perf.receitaAcumulada)} color="var(--v4p-success)" />
            <Stat label="Dias ocupada"      value={perf.diasOcupada ?? '—'} sub="no período" />
            <Stat label="Dias disponível"   value={perf.diasDisponivel ?? '—'} sub="no período" />
            <Stat label="Potencial mensal"  value={fmtMoney(perf.potencialMensal)} color="var(--v4p-accent)" />
          </div>

          {perf.mediaRegiao != null && perf.potencialMensal != null && (
            <div className="v4p-bdp__perf-compare">
              <div className="v4p-bdp__perf-compare-title">Comparação com a região</div>
              <div className="v4p-bdp__perf-compare-values">
                <div>
                  <span>Esta placa</span>
                  <strong style={{ color: 'var(--v4p-success)' }}>
                    {fmtMoney(perf.potencialMensal)}/mês
                  </strong>
                </div>
                <div className="v4p-bdp__perf-compare-divider" />
                <div>
                  <span>Média regional</span>
                  <strong style={{ color: 'var(--v4p-text-3)' }}>
                    {fmtMoney(perf.mediaRegiao)}/mês
                  </strong>
                </div>
                <div className="v4p-bdp__perf-delta" style={{
                  color: perf.potencialMensal >= perf.mediaRegiao ? 'var(--v4p-success)' : 'var(--v4p-danger)',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
                    {perf.potencialMensal >= perf.mediaRegiao ? 'trending_up' : 'trending_down'}
                  </span>
                  {perf.potencialMensal >= perf.mediaRegiao
                    ? `+${fmtMoney(perf.potencialMensal - perf.mediaRegiao)} acima da média`
                    : `${fmtMoney(perf.mediaRegiao - perf.potencialMensal)} abaixo da média`}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── ROW 4: Timeline + Recomendações ──────────────────── */}
      <div className="v4p-bdp__row4">
        <BoardActivityHistory history={ext.activityHistory} />

        <section className="v4p-bdp__recommendations">
          <header className="v4p-bdp__section-head">
            <span className="material-symbols-rounded v4p-bdp__section-icon" aria-hidden="true">auto_awesome</span>
            <div>
              <h3>Recomendações</h3>
              <p>Inteligência operacional e comercial</p>
            </div>
          </header>
          <div className="v4p-bdp__rec-cards">
            {rec.comercial && (
              <div className="v4p-bdp__rec-card v4p-bdp__rec-card--comercial">
                <div className="v4p-bdp__rec-card-head">
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>storefront</span>
                  Comercial
                </div>
                <p>{rec.comercial}</p>
              </div>
            )}
            {rec.operacional && (
              <div className="v4p-bdp__rec-card v4p-bdp__rec-card--operacional">
                <div className="v4p-bdp__rec-card-head">
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>build</span>
                  Operacional
                </div>
                <p>{rec.operacional}</p>
              </div>
            )}
            {rec.risco && (
              <div className="v4p-bdp__rec-card v4p-bdp__rec-card--risco">
                <div className="v4p-bdp__rec-card-head">
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>warning</span>
                  Risco
                </div>
                <p>{rec.risco}</p>
              </div>
            )}
            {rec.proximaAcao && (
              <div className="v4p-bdp__rec-card v4p-bdp__rec-card--acao">
                <div className="v4p-bdp__rec-card-head">
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>rocket_launch</span>
                  Próxima melhor ação
                </div>
                <p>{rec.proximaAcao}</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── EDIT MODAL ────────────────────────────────────────── */}
      {editing && (
        <BoardEditPanel
          board={board}
          onSave={handleSave}
          onClose={() => setEditing(false)}
          saving={actionLoading}
        />
      )}

      {/* ── ACTION TOAST ──────────────────────────────────────── */}
      {actionToast && (
        <div className="v4p-bdp__action-toast" role="status" aria-live="polite">
          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{actionToast.icon}</span>
          {actionToast.message}
        </div>
      )}
    </div>
  );
}

function BoardDetailPage(props) {
  return (
    <ContractsProvider>
      <BoardDetailPageInner {...props} />
    </ContractsProvider>
  );
}

export default memo(BoardDetailPage);
