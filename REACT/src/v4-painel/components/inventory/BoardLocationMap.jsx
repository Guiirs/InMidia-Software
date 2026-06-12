import { memo, useEffect, useState } from 'react';
import { normalizeBoardCoordinates } from '../../integration/adapters/boardCoordinates.js';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';

function BoardLocationMap({ board, codigo, accentColor = '#22d3ee' }) {
  const coords = normalizeBoardCoordinates(board);
  const [leaflet, setLeaflet] = useState(null);

  /* Leaflet acessa `window` no carregamento do módulo — importar só no
     cliente, dentro do efeito, evita quebrar SSR/testes em ambiente node. */
  useEffect(() => {
    if (!coords.hasCoordinates) return undefined;
    let alive = true;

    Promise.all([
      import('leaflet'),
      import('react-leaflet'),
      import('leaflet/dist/leaflet.css'),
    ]).then(([L, reactLeaflet]) => {
      if (alive) setLeaflet({ L: L.default ?? L, ...reactLeaflet });
    });

    return () => { alive = false; };
  }, [coords.hasCoordinates]);

  if (!coords.hasCoordinates) {
    return (
      <div className="v4p-locmap v4p-locmap--empty">
        <span className="material-symbols-rounded v4p-locmap__empty-icon" aria-hidden="true">location_off</span>
        <p>Sem coordenadas cadastradas</p>
      </div>
    );
  }

  if (!leaflet) {
    return <div className="v4p-locmap v4p-locmap--loading" aria-hidden="true" />;
  }

  const { L, MapContainer, TileLayer, Marker } = leaflet;
  const position = [coords.latitude, coords.longitude];
  const icon = L.divIcon({
    className: '',
    html: `<span class="v4p-locmap__pin" style="--pin-color:${accentColor}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  return (
    <div className="v4p-locmap">
      <MapContainer
        key={`${position[0]},${position[1]}`}
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        attributionControl={false}
        className="v4p-locmap__map"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={20} />
        <Marker position={position} icon={icon} aria-label={`Localização da placa ${codigo}`} />
      </MapContainer>
    </div>
  );
}

export default memo(BoardLocationMap);
