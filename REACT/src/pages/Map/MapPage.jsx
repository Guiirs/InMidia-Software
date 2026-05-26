// src/pages/Map/MapPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchPlacaLocations } from '../../services';
import Spinner from '../../components/Spinner/Spinner';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import './Map.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function ChangeView({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.1));
    } else if (!bounds) {
      map.setView([-14.235, -51.925], 4);
    }
  }, [map, bounds]);

  return null;
}

const locationsQueryKey = ['placaLocations'];

const getLocationId = (loc) => loc?.id || loc?._id;

const parseLocationCoordinates = (loc) => {
  if (!loc?.coordenadas || !loc.coordenadas.includes(',')) return null;

  const [lat, lng] = loc.coordenadas.split(',').map(coord => parseFloat(coord.trim()));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return [lat, lng];
};

const isValidMapLocation = (loc) => Boolean(getLocationId(loc) && parseLocationCoordinates(loc));

function MapPage() {
  const navigate = useNavigate();
  const [mapBounds, setMapBounds] = useState(null);
  const showToast = useToast();

  const {
    data: locationsData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: locationsQueryKey,
    queryFn: fetchPlacaLocations,
    staleTime: 1000 * 60 * 5,
    placeholderData: [],
  });

  const locations = useMemo(
    () => Array.isArray(locationsData) ? locationsData : [],
    [locationsData]
  );

  const validLocationsToRender = useMemo(
    () => locations.filter(isValidMapLocation),
    [locations]
  );

  useEffect(() => {
    if (validLocationsToRender.length > 0) {
      setMapBounds(L.latLngBounds(validLocationsToRender.map(parseLocationCoordinates)));
      return;
    }

    if (!isLoading) {
      setMapBounds(null);

      if (locations.length > 0) {
        showToast('Nenhuma localizacao valida encontrada para exibir.', 'info');
      }
    }
  }, [validLocationsToRender, locations.length, isLoading, showToast]);

  if (isLoading && locations.length === 0) {
    return (
      <div className="map-page">
        <Spinner message="A carregar mapa..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="map-page">
        <div className="map-page__error">
          Erro ao carregar localizacoes: {error?.message || 'tente novamente mais tarde.'}
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      <MapContainer center={[-14.235, -51.925]} zoom={4} className="map-page__container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validLocationsToRender.map(loc => {
          const [lat, lng] = parseLocationCoordinates(loc);
          const placaId = getLocationId(loc);

          return (
            <Marker key={placaId} position={[lat, lng]}>
              <Popup>
                <h4>Placa: {loc.numero_placa || 'N/A'}</h4>
                <p>{loc.nomeDaRua || loc.localizacao || 'Endereco nao informado'}</p>
                <a
                  href={`/placas/${placaId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/placas/${placaId}`);
                  }}
                  style={{ fontWeight: 500 }}
                >
                  Ver Detalhes
                </a>
              </Popup>
            </Marker>
          );
        })}
        <ChangeView bounds={mapBounds} />
      </MapContainer>
    </div>
  );
}

export default MapPage;
