import { memo } from 'react';
import { normalizeBoardCoordinates } from '../../integration/adapters/boardCoordinates.js';

function GeoRow({ label, value, icon }) {
  return (
    <div className="v4p-geo__row">
      {icon && (
        <span className="material-symbols-rounded v4p-geo__row-icon" aria-hidden="true">{icon}</span>
      )}
      <span className="v4p-geo__row-label">{label}</span>
      <span className="v4p-geo__row-value">{value ?? '-'}</span>
    </div>
  );
}

function MiniMapPreview({ lat, lng, codigo, city }) {
  const hasCoordinates = lat != null && lng != null;
  const dotX = hasCoordinates ? 50 + (lng * 0.12) % 30 : null;
  const dotY = hasCoordinates ? 50 + (lat * 0.12) % 20 : null;

  return (
    <div className="v4p-geo__map">
      <svg viewBox="0 0 280 140" className="v4p-geo__map-svg" aria-label={`Mapa da placa ${codigo}`}>
        <defs>
          <radialGradient id={`grd-${codigo}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.08)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
        </defs>

        {[20, 40, 60, 80, 100, 120].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="280" y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
        ))}
        {[35, 70, 105, 140, 175, 210, 245].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="140" stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
        ))}

        <path d="M0 70 Q70 65 140 72 Q210 79 280 68" stroke="rgba(148,163,184,0.18)" strokeWidth="2" fill="none" />
        <path d="M70 0 Q80 50 72 140" stroke="rgba(148,163,184,0.12)" strokeWidth="1.5" fill="none" />
        <path d="M180 10 Q175 70 185 140" stroke="rgba(148,163,184,0.10)" strokeWidth="1.5" fill="none" />
        {hasCoordinates ? (
          <>
            <ellipse cx={dotX * 2.8} cy={dotY * 1.4} rx="55" ry="35" fill={`url(#grd-${codigo})`} />
            <circle cx={dotX * 2.8} cy={dotY * 1.4} r="16" fill="none" stroke="rgba(34,211,238,0.18)" strokeWidth="1" />
            <circle cx={dotX * 2.8} cy={dotY * 1.4} r="10" fill="none" stroke="rgba(34,211,238,0.30)" strokeWidth="1" />
            <circle cx={dotX * 2.8} cy={dotY * 1.4} r="5" fill="var(--v4p-accent, #22d3ee)" opacity="0.90" />
            <circle cx={dotX * 2.8} cy={dotY * 1.4} r="2.5" fill="#fff" opacity="0.95" />
          </>
        ) : (
          <text x="140" y="74" textAnchor="middle" fill="rgba(148,163,184,0.72)" fontSize="12">Sem coordenadas</text>
        )}
      </svg>

      <div className="v4p-geo__map-footer">
        <span className="material-symbols-rounded" style={{ fontSize: 11 }}>location_on</span>
        <span>{city ?? '-'}</span>
        <span className="v4p-geo__coords">
          {hasCoordinates ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Sem coordenadas'}
        </span>
      </div>
    </div>
  );
}

function BoardGeoPanel({ board }) {
  const coords = normalizeBoardCoordinates(board);
  return (
    <section className="v4p-geo">
      <header className="v4p-geo__header">
        <span className="material-symbols-rounded v4p-geo__header-icon" aria-hidden="true">map</span>
        <div>
          <h3>Geolocalizacao</h3>
          <p>Posicao e contexto geografico</p>
        </div>
      </header>

      <MiniMapPreview lat={coords.latitude} lng={coords.longitude} codigo={board.codigo} city={board.city} />

      <div className="v4p-geo__grid">
        <GeoRow icon="location_on" label="Endereco" value={board.address ?? board.endereco ?? board.localizacao} />
        <GeoRow icon="location_city" label="Cidade" value={board.city} />
        <GeoRow icon="flag" label="Estado" value={board.uf} />
        <GeoRow icon="corporate_fare" label="Regiao operacional" value={board.operationalRegion} />
        <GeoRow icon="domain" label="Zona" value={board.zone} />
        <GeoRow icon="place" label="Referencia" value={board.referencePoint} />
        <GeoRow icon="directions_car" label="Fluxo estimado" value={board.estimatedFlow} />
        <GeoRow icon="visibility" label="Visibilidade" value={`${board.visibilityScore ?? '-'}/10`} />
        <GeoRow icon="light_mode" label="Iluminacao" value={board.lighting} />
        <GeoRow icon="turn_right" label="Sentido da via" value={board.roadDirection} />
      </div>
    </section>
  );
}

export default memo(BoardGeoPanel);
