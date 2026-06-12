import { memo } from 'react';
import BoardStatusBadge    from './BoardStatusBadge.jsx';
import { getPriorityMeta } from '../../foundation/priorities.js';
import PlateImagePreview   from '../media/PlateImagePreview.jsx';
import PlateTerritoryChip  from './PlateTerritoryChip.jsx';
import { mapBus }          from '../../modules/map/mapBus.js';
import { normalizePlateCardData } from './normalizePlateCardData.js';
import './BoardOperationalCard.css';

function formatVencimento(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${String(year).slice(2)}`;
}

const STATUS_CONFIG = {
  occupied: {
    color: '#10b981',
    barClass: '',
    revenueColor: '#10b981',
    revLabel: 'Faturamento',
    primaryAction: { label: 'Ver contrato',     icon: 'description',  ariaLabel: 'Ver contrato'              },
  },
  available: {
    color: '#06b6d4',
    barClass: 'v4p-board-card__status-bar--pulse-slow',
    revenueColor: 'var(--v4p-text-3)',
    revLabel: 'Potencial',
    primaryAction: { label: 'Criar PI',         icon: 'add_circle',   ariaLabel: 'Criar proposta de inserção' },
  },
  reserved: {
    color: '#8b5cf6',
    barClass: 'v4p-board-card__status-bar--glow',
    revenueColor: '#8b5cf6',
    revLabel: null,
    primaryAction: { label: 'Ver reserva',      icon: 'bookmark',     ariaLabel: 'Ver reserva'               },
  },
  maintenance: {
    color: '#f59e0b',
    barClass: '',
    revenueColor: 'var(--v4p-text-4)',
    revLabel: null,
    primaryAction: { label: 'Histórico',        icon: 'history',      ariaLabel: 'Ver histórico'             },
  },
  critical: {
    color: '#ef4444',
    barClass: 'v4p-board-card__status-bar--pulse-fast',
    revenueColor: '#ef4444',
    revLabel: 'Faturamento',
    primaryAction: { label: 'Acionar operação', icon: 'crisis_alert', ariaLabel: 'Acionar operação urgente'  },
  },
  idle: {
    color: 'rgba(100,116,139,0.45)',
    barClass: 'v4p-board-card__status-bar--idle',
    revenueColor: 'var(--v4p-text-4)',
    revLabel: null,
    primaryAction: { label: 'Ver detalhes',     icon: 'open_in_new',  ariaLabel: 'Ver detalhes'              },
  },
  unknown: {
    color: 'rgba(100,116,139,0.35)',
    barClass: 'v4p-board-card__status-bar--idle',
    revenueColor: 'var(--v4p-text-4)',
    revLabel: null,
    primaryAction: { label: 'Ver detalhes',     icon: 'open_in_new',  ariaLabel: 'Ver detalhes'              },
  },
};

const DEFAULT_CONFIG = STATUS_CONFIG.available;

function BoardOperationalCard({ board, onSelect, onEdit, onDelete }) {
  const card          = normalizePlateCardData(board ?? {});
  const priorityMeta  = getPriorityMeta(card.prioridade);
  const vencFormatted = formatVencimento(card.vencimento);
  const statusCfg     = STATUS_CONFIG[card.status] ?? DEFAULT_CONFIG;

  const fallbackStyle = {
    background: `linear-gradient(${card.id.charCodeAt(0) * 37 % 360}deg, rgba(15,23,42,0.95), rgba(5,10,20,0.98))`,
  };

  // Número da placa em destaque: codigo tem prioridade sobre nome genérico
  const plateTitle = card.codigo !== '—'    ? card.codigo
    : card.nome !== 'Sem nome'              ? card.nome
    : 'Sem identificação';

  const hasRealRevenue = Boolean(
    card.receitaFormatada &&
    card.receitaFormatada !== 'A negociar' &&
    card.receitaFormatada.trim() !== '',
  );

  const showCommercialBlock = (
    card.status === 'occupied' ||
    card.status === 'reserved' ||
    (card.status === 'available' && hasRealRevenue)
  );

  function handleMapClick(e) {
    e.stopPropagation();
    mapBus.emit('map:board:select', { boardId: card.id, lat: card.lat, lng: card.lng });
  }

  function handlePrimaryClick(e) {
    e.stopPropagation();
    onSelect?.(board);
  }

  function handleEditClick(e) {
    e.stopPropagation();
    onEdit?.(board);
  }

  function emitHover() {
    mapBus.emit('map:board:hover', { boardId: card.id, lat: card.lat, lng: card.lng });
  }

  function emitLeave() {
    mapBus.emit('map:board:leave', { boardId: card.id });
  }

  return (
    <article
      className="v4p-board-card"
      style={{
        '--v4p-card-accent':  `${statusCfg.color}44`,
        '--v4p-status-color': statusCfg.color,
      }}
      onClick={() => onSelect?.(board)}
      onMouseEnter={emitHover}
      onMouseLeave={emitLeave}
    >
      {/* Semantic status accent bar */}
      <div
        className={`v4p-board-card__status-bar ${statusCfg.barClass}`}
        aria-hidden="true"
      />

      {/* ── Image zone ─────────────────────────────────────────── */}
      <div className="v4p-board-card__img-wrap">
        <PlateImagePreview
          imageUrl={card.imageUrl}
          codigo={card.codigo}
          className="v4p-board-card__img"
          fallbackClassName="v4p-board-card__img-fallback"
          fallbackStyle={fallbackStyle}
        >
          <span style={{
            fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.55)',
            fontFamily: 'var(--v4p-mono, monospace)', letterSpacing: '0.05em',
          }}>
            {card.codigo}
          </span>
        </PlateImagePreview>
        <div className="v4p-board-card__img-overlay" />

        <div className="v4p-board-card__status-overlay">
          <BoardStatusBadge status={card.status} size="sm" />
        </div>

        {onDelete && (
          <button
            type="button"
            className="v4p-board-card__delete-btn"
            onClick={(e) => { e.stopPropagation(); onDelete(board); }}
            title="Remover placa"
            aria-label="Remover placa"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span>
          </button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="v4p-board-card__body">

        {/* A. Identity — título principal + endereço + região */}
        <div className="v4p-board-card__identity">
          <div
            className="v4p-board-card__title"
            title={plateTitle}
            data-testid="plate-title"
          >
            {plateTitle}
          </div>
          <div className="v4p-board-card__loc" title={card.localizacao}>{card.localizacao}</div>
          <div className="v4p-board-card__meta">
            <PlateTerritoryChip board={card} />
            {card.prioridade !== 'normal' && (
              <span className="v4p-chip v4p-chip--sm" style={{
                '--v4p-pill-color':  priorityMeta.color,
                '--v4p-pill-border': `color-mix(in srgb, ${priorityMeta.color} 34%, transparent)`,
                '--v4p-pill-bg':     `color-mix(in srgb, ${priorityMeta.color} 14%, transparent)`,
                fontSize: 10, pointerEvents: 'none',
              }}>
                {priorityMeta.label}
              </span>
            )}
            {card.medidas && (
              <span className="v4p-chip v4p-chip--sm v4p-chip--neutral" style={{ fontSize: 10 }}>
                {card.medidas}
              </span>
            )}
          </div>
        </div>

        {/* B. Commercial — só exibe quando há contexto comercial real */}
        {showCommercialBlock && (
          <div className="v4p-board-card__commercial">
            <div className="v4p-board-card__client-row">
              {card.cliente ? (
                <>
                  <span className="v4p-board-card__data-label">Cliente atual</span>
                  <span className="v4p-board-card__client-name">{card.cliente}</span>
                </>
              ) : (
                <span className="v4p-board-card__data-empty">
                  {card.status === 'reserved' ? 'Aguardando contrato' : 'Sem cliente ativo'}
                </span>
              )}
            </div>

            <div className="v4p-board-card__revenue-row">
              {hasRealRevenue ? (
                <span className="v4p-board-card__revenue" style={{ color: statusCfg.revenueColor }}>
                  {statusCfg.revLabel && (
                    <span className="v4p-board-card__rev-label">{statusCfg.revLabel} · </span>
                  )}
                  {card.receitaFormatada}
                </span>
              ) : (
                <span className="v4p-board-card__data-empty">A negociar</span>
              )}
              {vencFormatted && (
                <span className="v4p-board-card__expiry">
                  <span className="material-symbols-rounded" style={{ fontSize: 10 }} aria-hidden="true">event</span>
                  {vencFormatted}
                </span>
              )}
            </div>
          </div>
        )}

        {/* B2. Bloqueio operacional — instalação/raspagem/manutenção/bloqueio manual */}
        {card.operationalBlock && (
          <div className="v4p-board-card__op-block" data-testid="operational-block">
            <div className="v4p-board-card__op-block-row">
              <span className="material-symbols-rounded" style={{ fontSize: 13 }} aria-hidden="true">block</span>
              <span className="v4p-board-card__op-block-label">{card.operationalBlock.label}</span>
            </div>
            <span className="v4p-board-card__op-block-badge">Alocação bloqueada</span>
            {card.operationalBlock.teamSnapshot ? (
              <div className="v4p-board-card__op-block-team">
                <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">groups</span>
                Equipe: {card.operationalBlock.teamSnapshot.name} · {card.operationalBlock.teamSnapshot.memberCount} {card.operationalBlock.teamSnapshot.memberCount === 1 ? 'integrante' : 'integrantes'}
              </div>
            ) : card.operationalBlock.assignedTo && (
              <div className="v4p-board-card__op-block-team">
                <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">groups</span>
                {card.operationalBlock.assignedTo}
              </div>
            )}
            {card.operationalBlock.notes && (
              <div className="v4p-board-card__op-block-notes">{card.operationalBlock.notes}</div>
            )}
          </div>
        )}

        {/* C. GPS — compacto, empurrado ao fundo do body */}
        <div
          className={`v4p-board-card__gps${card.hasCoordinates ? '' : ' v4p-board-card__gps--empty'}`}
          title={card.hasCoordinates
            ? `Latitude: ${card.latitude}\nLongitude: ${card.longitude}`
            : 'Sem coordenadas cadastradas'}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: 11, flexShrink: 0 }}
            aria-hidden="true"
          >
            {card.hasCoordinates ? 'location_on' : 'location_off'}
          </span>
          {card.hasCoordinates ? (
            <span className="v4p-board-card__gps-val">
              {card.latitude.toFixed(6)},&nbsp;{card.longitude.toFixed(6)}
            </span>
          ) : (
            <span>Sem GPS</span>
          )}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────── */}
      <div className="v4p-board-card__actions" onClick={(e) => e.stopPropagation()}>
        {onEdit && (
          <button
            type="button"
            className="v4p-board-card__action-btn"
            onClick={handleEditClick}
            title="Editar placa"
            aria-label="Editar placa"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>edit</span>
          </button>
        )}
        <button
          type="button"
          className="v4p-board-card__action-btn"
          onClick={handleMapClick}
          title="Ver no mapa"
          aria-label="Ver no mapa"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>map</span>
        </button>
        <button
          type="button"
          className="v4p-board-card__action-btn v4p-board-card__action-btn--primary"
          onClick={handlePrimaryClick}
          title={statusCfg.primaryAction.label}
          aria-label={statusCfg.primaryAction.ariaLabel}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{statusCfg.primaryAction.icon}</span>
          <span className="v4p-board-card__action-label">{statusCfg.primaryAction.label}</span>
        </button>
      </div>
    </article>
  );
}

export default memo(BoardOperationalCard);
