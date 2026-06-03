import { memo } from 'react';
import BoardStatusBadge    from './BoardStatusBadge.jsx';
import { getStateMeta }    from '../../foundation/operationalStates.js';
import { getPriorityMeta } from '../../foundation/priorities.js';
import PlateImagePreview   from '../media/PlateImagePreview.jsx';
import PlateTimeline       from './PlateTimeline.jsx';
import PlateHealthRow      from './PlateHealthRow.jsx';
import PlateTerritoryChip  from './PlateTerritoryChip.jsx';
import PlateAlertDot       from './PlateAlertDot.jsx';
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
    primaryAction:   { label: 'Ver contrato',    icon: 'description'  },
    secondaryAction: { label: 'Ver no mapa',      icon: 'map'          },
  },
  available: {
    color: '#06b6d4',
    barClass: 'v4p-board-card__status-bar--pulse-slow',
    revenueColor: 'var(--v4p-text-3)',
    primaryAction:   { label: 'Criar PI',         icon: 'add_circle'   },
    secondaryAction: { label: 'Ver no mapa',      icon: 'map'          },
  },
  reserved: {
    color: '#8b5cf6',
    barClass: 'v4p-board-card__status-bar--glow',
    revenueColor: '#8b5cf6',
    primaryAction:   { label: 'Ver reserva',      icon: 'bookmark'     },
    secondaryAction: { label: 'Ver no mapa',      icon: 'map'          },
  },
  maintenance: {
    color: '#f59e0b',
    barClass: '',
    revenueColor: 'var(--v4p-text-4)',
    primaryAction:   { label: 'Histórico',        icon: 'history'      },
    secondaryAction: { label: 'Ver no mapa',      icon: 'map'          },
  },
  critical: {
    color: '#ef4444',
    barClass: 'v4p-board-card__status-bar--pulse-fast',
    revenueColor: '#ef4444',
    primaryAction:   { label: 'Acionar operação', icon: 'crisis_alert' },
    secondaryAction: { label: 'Ver histórico',    icon: 'history'      },
  },
  idle: {
    color: 'rgba(100,116,139,0.45)',
    barClass: 'v4p-board-card__status-bar--idle',
    revenueColor: 'var(--v4p-text-4)',
    primaryAction:   { label: 'Ver detalhes',     icon: 'open_in_new'  },
    secondaryAction: { label: 'Ver no mapa',      icon: 'map'          },
  },
  unknown: {
    color: 'rgba(100,116,139,0.35)',
    barClass: 'v4p-board-card__status-bar--idle',
    revenueColor: 'var(--v4p-text-4)',
    primaryAction:   { label: 'Ver detalhes',     icon: 'open_in_new'  },
    secondaryAction: { label: 'Ver no mapa',      icon: 'map'          },
  },
};

const DEFAULT_CONFIG = STATUS_CONFIG.available;

function BoardOperationalCard({ board, onSelect, onEdit, onDelete }) {
  const card = normalizePlateCardData(board ?? {});

  if (import.meta.env.DEV) {
    console.debug('[PLATE_CARD_DATA]', {
      id:           card.id,
      codigo:       card.codigo,
      imageUrl:     card.imageUrl,
      mainImageUrl: board?.mainImageUrl,
      mediaMainUrl: board?.media?.mainUrl,
      hasImage:     card.hasImage,
      keys:         Object.keys(board ?? {}),
    });
  }

  const stateMeta     = getStateMeta(card.estado);
  const priorityMeta  = getPriorityMeta(card.prioridade);
  const vencFormatted = formatVencimento(card.vencimento);
  const statusCfg     = STATUS_CONFIG[card.status] ?? DEFAULT_CONFIG;

  // charCodeAt is safe: card.id is always a non-empty string after normalization
  const fallbackStyle = {
    background: `linear-gradient(${card.id.charCodeAt(0) * 37 % 360}deg, ${stateMeta.colorSoft}, rgba(0,0,0,0.32))`,
  };

  function emitHover() {
    mapBus.emit('map:board:hover', {
      boardId: card.id,
      lat: card.lat,
      lng: card.lng,
    });
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
      {/* Semantic status bar — 4px top */}
      <div
        className={`v4p-board-card__status-bar ${statusCfg.barClass}`}
        aria-hidden="true"
      />

      {/* Zone 1 — image / preview */}
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

        {/* Zone 2 — status overlay */}
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

        <div className="v4p-board-card__img-footer">
          <span className="v4p-board-card__code">{card.codigo}</span>
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
        </div>
      </div>

      {/* Body */}
      <div className="v4p-board-card__body">

        {/* Zone 2 — territory / alert */}
        <div className="v4p-board-card__meta">
          <PlateTerritoryChip board={card} />
          <span className="v4p-chip v4p-chip--sm v4p-chip--neutral" style={{ fontSize: 11 }}>
            {card.categoria}
          </span>
          <PlateAlertDot board={card} />
        </div>

        {/* Zone 3 + 4 — identity / location */}
        <div>
          <div className="v4p-board-card__name" title={card.nome}>{card.nome}</div>
          <div className="v4p-board-card__loc"  title={card.localizacao}>{card.localizacao}</div>
        </div>

        {/* Zone 5 — current context */}
        <div className="v4p-board-card__client">
          <span className="material-symbols-rounded" style={{ fontSize: 12, color: 'var(--v4p-text-4)', flexShrink: 0 }}>
            {card.cliente ? 'person' : 'person_off'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.cliente ?? 'Sem cliente ativo'}
          </span>
        </div>

        {card.campanha && (
          <div className="v4p-board-card__campaign">
            <span className="material-symbols-rounded" style={{ fontSize: 11, flexShrink: 0 }}>campaign</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.campanha}</span>
          </div>
        )}

        {/* Zone 6 — timeline */}
        <PlateTimeline board={card} />

        {/* Zone 7 — health / revenue */}
        <PlateHealthRow
          board={card}
          vencFormatted={vencFormatted}
          revenueColor={statusCfg.revenueColor}
        />

        {card.recomendacao && (
          <p className="v4p-board-card__rec">{card.recomendacao}</p>
        )}
      </div>

      {/* Zone 8 — contextual actions */}
      <div className="v4p-board-card__actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="v4p-board-card__action v4p-board-card__action--primary"
          onClick={() => onSelect?.(board)}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{statusCfg.primaryAction.icon}</span>
          {statusCfg.primaryAction.label}
        </button>
        <button
          type="button"
          className="v4p-board-card__action"
          onClick={() => {
            mapBus.emit('map:board:select', {
              boardId: card.id,
              lat: card.lat,
              lng: card.lng,
            });
            onEdit?.(board);
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 13 }}>{statusCfg.secondaryAction.icon}</span>
          {statusCfg.secondaryAction.label}
        </button>
      </div>
    </article>
  );
}

export default memo(BoardOperationalCard);
