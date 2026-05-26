import { memo, useState } from 'react';
import { getStateMeta, OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { getPriorityMeta } from '../../foundation/priorities.js';
import './BoardMapMarker.css';

function getTooltipPlacement(marker) {
  const horizontal = marker.x >= 74 ? 'is-near-right' : marker.x <= 26 ? 'is-near-left' : '';
  const vertical = marker.y <= 28 ? 'is-near-top' : marker.y >= 78 ? 'is-near-bottom' : '';
  return `${horizontal} ${vertical}`.trim();
}

function BoardMapMarker({ marker, onClick, selected = false, compact = false }) {
  const [hovered, setHovered] = useState(false);
  const meta = getStateMeta(marker.estado);
  const priorityMeta = getPriorityMeta(marker.prioridade);
  const isCritical = marker.estado === OPERATIONAL_STATE.CRITICAL;
  const isWarning = marker.estado === OPERATIONAL_STATE.WARNING || marker.estado === OPERATIONAL_STATE.DEGRADED;
  const revenue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(marker.receita);

  return (
    <div
      className={[
        'v4p-map-marker',
        isCritical ? 'is-critical' : '',
        isWarning ? 'is-warning' : '',
        selected ? 'is-selected' : '',
        compact ? 'is-compact' : '',
        getTooltipPlacement(marker),
      ].filter(Boolean).join(' ')}
      style={{
        '--marker-x': `${marker.x}%`,
        '--marker-y': `${marker.y}%`,
        '--v4p-marker-color': meta.color,
        '--v4p-marker-priority': priorityMeta.color,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(isCritical || isWarning) && <span aria-hidden="true" className="v4p-map-marker__pulse" />}

      <button
        type="button"
        className="v4p-map-marker__pin"
        onClick={() => onClick?.(marker)}
        title={`${marker.id} - ${meta.label}`}
        aria-label={`Placa ${marker.id}`}
      >
        {isCritical && <span aria-hidden="true" className="material-symbols-rounded">priority_high</span>}
      </button>

      {hovered && (
        <div className="v4p-map-marker__tooltip">
          <div className="v4p-map-marker__tooltip-top">
            <strong className="v4p-mono">{marker.id}</strong>
            <span>{meta.label}</span>
          </div>
          {!compact && (
            <>
              <div className="v4p-map-marker__tooltip-row">
                <span>Prioridade</span>
                <strong style={{ color: priorityMeta.color }}>{priorityMeta.label}</strong>
              </div>
              <div className="v4p-map-marker__tooltip-row">
                <span>Receita</span>
                <strong>{revenue}/mês</strong>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(BoardMapMarker);
