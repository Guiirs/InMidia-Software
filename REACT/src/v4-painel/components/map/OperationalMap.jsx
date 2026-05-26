import { memo, useMemo, useState } from 'react';
import BoardMapMarker from './BoardMapMarker.jsx';
import { getStateMeta } from '../../foundation/operationalStates.js';
import './OperationalMap.css';

const COMPACT_MARKER_IDS = new Set(['SP-2241', 'SP-1089', 'RJ-0412', 'MG-0301']);

function BrazilGrid({ regions = [], compact = false }) {
  return (
    <div className="v4p-operational-map__regions" aria-hidden="true">
      {regions.map((region) => {
        const meta = getStateMeta(region.estado);
        const pct = Math.round(region.ocupacao * 100);
        const hasData = region.placas > 0;

        return (
          <div
            key={region.id}
            className={`v4p-operational-map__region${hasData ? ' has-data' : ''}`}
            style={{
              '--region-left': `${((region.col - 1) / 12) * 100}%`,
              '--region-top': `${((region.row - 1) / 10) * 100}%`,
              '--region-width': `${(region.colSpan / 12) * 100}%`,
              '--region-height': `${(region.rowSpan / 10) * 100}%`,
              '--region-color': meta.color,
              '--region-bg': hasData ? region.cor : 'rgba(13,18,28,0.60)',
            }}
          >
            <strong>{region.sigla}</strong>
            {hasData && !compact && (
              <>
                <span>{pct}%</span>
                {region.placas > 30 && <em>{region.placas}p</em>}
                <i style={{ width: `${pct}%` }} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OperationalMap({ onSelectMarker, variant = 'expanded', regions = [], markers: inputMarkers = [] }) {
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);
  const compact = variant === 'compact';

  const markers = useMemo(() => {
    if (!compact) return inputMarkers;
    const compactMarkers = inputMarkers.filter((marker) => COMPACT_MARKER_IDS.has(marker.id));
    return compactMarkers.length > 0 ? compactMarkers : inputMarkers.slice(0, 4);
  }, [compact, inputMarkers]);

  const handleSelectMarker = (marker) => {
    setSelectedMarkerId(marker.id);
    onSelectMarker?.(marker.board ?? marker);
  };

  const criticalCount = markers.filter((marker) => marker.estado === 'critical').length;
  const warningCount = markers.filter((marker) => marker.estado === 'warning' || marker.estado === 'degraded').length;

  return (
    <div className={`v4p-operational-map-card v4p-operational-map-card--${variant} v4p-surface-card`}>
      <header className="v4p-operational-map__header">
        <div>
          <strong>Mapa operacional</strong>
          <span>{compact ? 'Principais alertas e regioes ativas' : 'Distribuicao geografica do inventario - API V4'}</span>
        </div>
        <div className="v4p-operational-map__badges">
          {criticalCount > 0 && <span data-tone="critical">{criticalCount} critico{criticalCount !== 1 ? 's' : ''}</span>}
          {warningCount > 0 && <span data-tone="warning">{warningCount} atencao</span>}
        </div>
      </header>

      <div className="v4p-operational-map__viewport" aria-label="Mapa operacional do inventario">
        <BrazilGrid regions={regions} compact={compact} />

        <div className="v4p-operational-map__markers">
          {markers.map((marker) => (
            <BoardMapMarker
              key={marker.id}
              marker={marker}
              selected={selectedMarkerId === marker.id}
              compact={compact}
              onClick={handleSelectMarker}
            />
          ))}
        </div>

        {regions.length === 0 && markers.length === 0 && (
          <div className="v4p-operational-map__empty">Nenhuma placa com regiao para exibir.</div>
        )}

        <div className="v4p-operational-map__legend">
          {[
            { label: 'Saudavel', color: 'var(--v4p-success)' },
            { label: 'Atencao', color: 'var(--v4p-warning)' },
            { label: 'Critico', color: 'var(--v4p-danger)' },
            { label: 'Sem dados', color: 'rgba(61,80,112,0.42)' },
          ].map((item) => (
            <span key={item.label}>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(OperationalMap);
