// src/components/PlacaMap/PlacaMap.jsx
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Corrigir ícones Leaflet (pode ser repetido ou movido para um helper global se preferir)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Componente para invalidar tamanho do mapa
function InvalidateMapSize() {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
             if(map) map.invalidateSize();
        }, 100); // Pequeno delay para garantir que o layout estabilizou
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

function toFiniteCoordinate(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMapPosition(mapPosition) {
    if (!Array.isArray(mapPosition) || mapPosition.length !== 2) return null;
    const lat = toFiniteCoordinate(mapPosition[0]);
    const lng = toFiniteCoordinate(mapPosition[1]);
    if (lat === null || lng === null) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
}

// Componente do Mapa
function PlacaMap({ mapPosition, numeroPlaca }) {
    const normalizedPosition = normalizeMapPosition(mapPosition);

    // Renderiza o mapa apenas se a posição for válida
    if (normalizedPosition) {
        return (
            <MapContainer
                center={normalizedPosition}
                zoom={15}
                style={{ height: '100%', width: '100%' }} // Ocupa o container pai
            >
                <InvalidateMapSize /> {/* Garante o tamanho correto */}
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={normalizedPosition}>
                    <Popup>{numeroPlaca || 'Localização'}</Popup>
                </Marker>
            </MapContainer>
        );
    }

    // Renderiza uma mensagem se as coordenadas forem inválidas
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-color-light)' }}>
            <p>Mapa indisponível (coordenadas inválidas).</p>
        </div>
    );
}

PlacaMap.propTypes = {
    // Array de números [latitude, longitude] ou null/undefined
    mapPosition: PropTypes.arrayOf(PropTypes.number),
    numeroPlaca: PropTypes.string
};

export default PlacaMap;