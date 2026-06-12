import { memo } from 'react';
import { normalizeBoardCoordinates } from '../../integration/adapters/boardCoordinates.js';

function GeoRow({ label, value, icon }) {
  if (value == null || value === '') return null;
  return (
    <div className="v4p-geo__row">
      {icon && (
        <span className="material-symbols-rounded v4p-geo__row-icon" aria-hidden="true">{icon}</span>
      )}
      <span className="v4p-geo__row-label">{label}</span>
      <span className="v4p-geo__row-value">{value}</span>
    </div>
  );
}

function BoardGeoPanel({ board }) {
  const coords = normalizeBoardCoordinates(board);
  const coordenadas = coords.hasCoordinates
    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
    : null;

  return (
    <div className="v4p-geo__grid">
      <GeoRow icon="location_on"   label="Endereço"  value={board.address ?? board.endereco ?? board.localizacao} />
      <GeoRow icon="signpost"      label="Bairro/Região" value={board.regiao} />
      <GeoRow icon="flag"          label="UF"        value={board.siglaRegiao} />
      <GeoRow icon="my_location"   label="Coordenadas" value={coordenadas} />
    </div>
  );
}

export default memo(BoardGeoPanel);
