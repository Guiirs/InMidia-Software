import { memo, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { GeoJSON, MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { V4EmptyState } from '../ui/index.js';
import SafeImage from '../media/SafeImage.jsx';
import { mapBus } from '../../modules/map/mapBus.js';
import './V4OperationalMap.css';

const STATUS_COLORS = {
  occupied:    '#38c78f',
  available:   '#5b78f5',
  reserved:    '#e3b456',
  maintenance: '#f47474',
  critical:    '#ef4444',
};

const STATUS_LABELS = {
  occupied:    'Ocupada',
  available:   'Disponivel',
  reserved:    'Reservada',
  maintenance: 'Manutencao',
  critical:    'Critica',
};

const COMMERCIAL_STATUS_LABELS = {
  CONTRACTED_ACTIVE: 'Contratada ativa',
  FUTURE_RESERVED:   'Reservada futura',
  RESERVED_FUTURE:   'Reservada futura',
  RESERVED:          'Reservada',
  MAINTENANCE:       'Manutencao',
  AVAILABLE:         'Disponivel',
  OCCUPIED:          'Ocupada',
};

const DEFAULT_PIN_COLOR = '#8390a6';
const BRAZIL_CENTER = [-15.793, -47.882];
const BRAZIL_ZOOM   = 5;

function toFiniteCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pinColor(status) {
  return STATUS_COLORS[status] ?? DEFAULT_PIN_COLOR;
}

function createDivIcon(color, selected, dimmed, boardId) {
  const size = selected ? 20 : 14;
  const opacity = dimmed ? 0.28 : 1;
  const idAttr = boardId != null ? ` data-board-id="${boardId}"` : '';
  return L.divIcon({
    className: '',
    html: `<span class="v4-geomap-pin${selected ? ' v4-geomap-pin--selected' : ''}${dimmed ? ' v4-geomap-pin--dimmed' : ''}"${idAttr} style="--pin-color:${color};width:${size}px;height:${size}px;opacity:${opacity}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 6)],
  });
}

function collectGeometryLatLngs(geometry) {
  const latLngs = [];
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      latLngs.push([value[1], value[0]]);
      return;
    }
    value.forEach(walk);
  };
  walk(geometry?.coordinates);
  return latLngs;
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoney(value) {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n <= 0) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function MapFitBounds({ points, regionBoundaries }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    const pointBounds = points.map((p) => [p.latitude, p.longitude]);
    const boundaryBounds = regionBoundaries.flatMap((region) => collectGeometryLatLngs(region.geometry));
    const bounds = [...pointBounds, ...boundaryBounds];
    if (bounds.length === 0) return;
    fitted.current = true;

    if (bounds.length === 1) {
      map.setView(bounds[0], 14, { animate: false });
    } else {
      map.fitBounds(
        bounds,
        { padding: [44, 44], maxZoom: 14, animate: false },
      );
    }
  }, [map, points, regionBoundaries]);

  return null;
}

function MapFlyTo({ flyTo }) {
  const map = useMap();
  const prevKey = useRef(null);

  useEffect(() => {
    const lat = toFiniteCoordinate(flyTo?.lat);
    const lng = toFiniteCoordinate(flyTo?.lng);
    if (lat === null || lng === null) return;
    const key = `${lat},${lng}`;
    if (key === prevKey.current) return;
    prevKey.current = key;
    map.flyTo([lat, lng], flyTo.zoom ?? 12, { animate: true, duration: 1.2 });
  }, [map, flyTo]);

  return null;
}

function MapStatusLegend({ compact }) {
  return (
    <div
      className={`v4-geomap-legend${compact ? ' v4-geomap-legend--compact' : ''}`}
      aria-label="Legenda de status"
    >
      {Object.entries(STATUS_LABELS).map(([key, label]) => (
        <span key={key} className="v4-geomap-legend__item">
          <span
            className="v4-geomap-legend__dot"
            style={{ background: STATUS_COLORS[key] }}
            aria-hidden="true"
          />
          {!compact && (
            <span className="v4-geomap-legend__label">{label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function BoardPopupContent({ point }) {
  const m = point.metadata ?? {};
  const clientName     = m.activeContract?.clientName ?? m.cliente_nome ?? null;
  const contractValue  = m.commercialProjection?.pricing?.contractValue ?? m.valorMensal ?? m.valor_mensal ?? null;
  const startDate      = m.activeContract?.startDate ?? null;
  const endDate        = m.activeContract?.endDate   ?? null;
  const hasReservation = Boolean(m.reservation);
  const commStatus     = m.commercialStatus ?? null;

  const hasCommercial = clientName || contractValue || commStatus || hasReservation || startDate || endDate;

  return (
    <div className="v4-geomap-popup">
      <SafeImage
        src={point.mainImageUrl}
        alt={`Imagem da placa ${point.title}`}
        className="v4-geomap-popup__image"
        fallbackClassName="v4-geomap-popup__image-empty"
        fallbackLabel="Sem imagem"
      />
      <strong className="v4-geomap-popup__title">{point.title}</strong>
      {point.subtitle && (
        <span className="v4-geomap-popup__sub">{point.subtitle}</span>
      )}
      {point.address && (
        <span className="v4-geomap-popup__addr">{point.address}</span>
      )}
      {point.status && (
        <span className="v4-geomap-popup__status" style={{ color: pinColor(point.status) }}>
          {STATUS_LABELS[point.status] ?? point.status}
        </span>
      )}
      {point.region && (
        <span className="v4-geomap-popup__region">{point.region}</span>
      )}

      {hasCommercial && (
        <div className="v4-geomap-popup__commercial">
          {commStatus && (
            <span className="v4-geomap-popup__comm-status">
              {COMMERCIAL_STATUS_LABELS[commStatus] ?? commStatus}
            </span>
          )}
          {clientName && (
            <span className="v4-geomap-popup__row">
              <span className="v4-geomap-popup__label">Cliente</span>
              <span className="v4-geomap-popup__value">{clientName}</span>
            </span>
          )}
          {contractValue && fmtMoney(contractValue) && (
            <span className="v4-geomap-popup__row">
              <span className="v4-geomap-popup__label">Valor</span>
              <span className="v4-geomap-popup__value">{fmtMoney(contractValue)}</span>
            </span>
          )}
          {(startDate || endDate) && (
            <span className="v4-geomap-popup__row">
              <span className="v4-geomap-popup__label">Contrato</span>
              <span className="v4-geomap-popup__value">
                {fmtDate(startDate) ?? '?'} – {fmtDate(endDate) ?? '...'}
              </span>
            </span>
          )}
          {hasReservation && (
            <span className="v4-geomap-popup__reservation">
              <span className="material-symbols-rounded" aria-hidden="true">event_available</span>
              Reserva ativa
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MissingBoardsPanel({ missingPoints, onClose }) {
  return (
    <div className="v4-geomap-missing" role="dialog" aria-modal="true" aria-label="Placas sem coordenadas">
      <div className="v4-geomap-missing__header">
        <span className="v4-geomap-missing__title">
          <span className="material-symbols-rounded" aria-hidden="true">location_off</span>
          {missingPoints.length} placa{missingPoints.length !== 1 ? 's' : ''} sem coordenadas
        </span>
        <button
          type="button"
          className="v4-geomap-missing__close"
          onClick={onClose}
          aria-label="Fechar lista"
        >
          <span className="material-symbols-rounded">close</span>
        </button>
      </div>
      <ul className="v4-geomap-missing__list">
        {missingPoints.map((point) => (
          <li key={point.id} className="v4-geomap-missing__item">
            <strong className="v4-geomap-missing__code">{point.title}</strong>
            {point.address && (
              <span className="v4-geomap-missing__addr">{point.address}</span>
            )}
            {point.region && (
              <span className="v4-geomap-missing__region">{point.region}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Mapa geográfico operacional com ruas (OpenStreetMap via Leaflet).
 *
 * Props:
 *   points          — array de { id, title, subtitle, latitude, longitude, status, region, address, metadata }
 *   loading         — boolean
 *   error           — string | null
 *   emptyMessage    — string
 *   selectedPointId — id do ponto selecionado
 *   onSelectPoint   — (point) => void
 *   height          — number (px)
 *   compact         — boolean
 *   flyTo           — { lat, lng, zoom? } | null — centraliza o mapa na região selecionada
 *   selectedRegionId — string | null — destaca pins da região, dimi os demais
 *   regionColorMap   — { [regionId]: string } — cor territorial por região
 *   regionBoundaries — array de limites GeoJSON somente leitura por região
 */
function V4OperationalMap({
  points = [],
  loading = false,
  error = null,
  emptyMessage = 'Nenhuma placa com coordenadas disponivel.',
  selectedPointId = null,
  onSelectPoint,
  height,
  compact = false,
  flyTo = null,
  selectedRegionId = null,
  regionColorMap = {},
  regionBoundaries = [],
}) {
  const mapContainerRef = useRef(null);
  const prevHoveredId   = useRef(null);
  const [showMissingList, setShowMissingList] = useState(false);

  useEffect(() => {
    function handleHover(e) {
      const container = mapContainerRef.current;
      if (!container) return;
      const { boardId } = e.detail ?? {};
      if (!boardId) return;
      if (prevHoveredId.current && prevHoveredId.current !== boardId) {
        container.querySelector(`[data-board-id="${prevHoveredId.current}"]`)?.classList.remove('v4-geomap-pin--hovered');
      }
      const pin = container.querySelector(`[data-board-id="${boardId}"]`);
      if (pin) {
        pin.classList.add('v4-geomap-pin--hovered');
        prevHoveredId.current = boardId;
      }
    }

    function handleLeave(e) {
      const container = mapContainerRef.current;
      if (!container) return;
      const { boardId } = e.detail ?? {};
      if (!boardId) return;
      container.querySelector(`[data-board-id="${boardId}"]`)?.classList.remove('v4-geomap-pin--hovered');
      if (prevHoveredId.current === boardId) prevHoveredId.current = null;
    }

    mapBus.on('map:board:hover', handleHover);
    mapBus.on('map:board:leave', handleLeave);
    return () => {
      mapBus.off('map:board:hover', handleHover);
      mapBus.off('map:board:leave', handleLeave);
    };
  }, []);

  const validPoints = useMemo(() => {
    return points.reduce((acc, point) => {
      const latitude = toFiniteCoordinate(point?.latitude);
      const longitude = toFiniteCoordinate(point?.longitude);
      if (latitude === null || longitude === null) return acc;
      acc.push({ ...point, latitude, longitude });
      return acc;
    }, []);
  }, [points]);

  const missingPoints = useMemo(
    () => points.filter((p) => {
      const lat = toFiniteCoordinate(p?.latitude);
      const lng = toFiniteCoordinate(p?.longitude);
      return lat === null || lng === null;
    }),
    [points],
  );

  const validBoundaries = useMemo(
    () => regionBoundaries.filter((region) => region.id && region.geometry?.coordinates),
    [regionBoundaries],
  );
  const missingCount = missingPoints.length;
  const mapHeight = height ?? (compact ? 280 : 480);
  const hasMapGeometry = validPoints.length > 0 || validBoundaries.length > 0;

  if (loading) {
    return (
      <div
        className={`v4-geomap v4-geomap--loading${compact ? ' v4-geomap--compact' : ''}`}
        style={{ height: mapHeight }}
        aria-busy="true"
        aria-label="Carregando mapa"
      >
        <div className="v4-geomap__loading-inner">
          <span className="material-symbols-rounded v4-geomap__loading-icon">map</span>
          <span className="v4-geomap__loading-label">Carregando mapa</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`v4-geomap v4-geomap--state${compact ? ' v4-geomap--compact' : ''}`}
        style={{ height: mapHeight }}
      >
        <V4EmptyState
          icon={<span className="material-symbols-rounded">map_search</span>}
          title="Mapa indisponivel"
          description={error}
          compact={compact}
        />
      </div>
    );
  }

  if (!hasMapGeometry) {
    return (
      <div
        className={`v4-geomap v4-geomap--state${compact ? ' v4-geomap--compact' : ''}`}
        style={{ height: mapHeight }}
      >
        <V4EmptyState
          icon={<span className="material-symbols-rounded">location_off</span>}
          title="Nenhuma placa com coordenadas"
          description={
            points.length > 0
              ? `${points.length} placa${points.length !== 1 ? 's' : ''} sem coordenadas cadastradas. Registre latitude e longitude no backend para visualizar no mapa geografico.`
              : emptyMessage
          }
          compact={compact}
        />
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className={`v4-geomap${compact ? ' v4-geomap--compact' : ''}`}
      style={{ height: mapHeight }}
    >
      <MapContainer
        center={BRAZIL_CENTER}
        zoom={BRAZIL_ZOOM}
        className="v4-geomap__map"
        zoomControl={!compact}
        attributionControl={!compact}
        scrollWheelZoom={!compact}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
          maxZoom={19}
        />
        <MapFitBounds points={validPoints} regionBoundaries={validBoundaries} />
        {flyTo && <MapFlyTo flyTo={flyTo} />}
        {validBoundaries.map((region) => {
          const selected = selectedRegionId === region.id;
          const dimmed = selectedRegionId != null && !selected;
          const color = region.color ?? regionColorMap[region.id] ?? DEFAULT_PIN_COLOR;

          return (
            <GeoJSON
              key={`${region.id}-${selected ? 'selected' : 'base'}`}
              data={{
                type: 'Feature',
                properties: { id: region.id, label: region.label },
                geometry: region.geometry,
              }}
              style={{
                color,
                weight: selected ? 3 : 1.5,
                opacity: selected ? 0.95 : dimmed ? 0.28 : 0.58,
                fillColor: color,
                fillOpacity: selected ? 0.18 : dimmed ? 0.035 : 0.075,
                dashArray: selected ? null : '5 5',
              }}
            />
          );
        })}
        {validPoints.map((point) => {
          const selected = selectedPointId === point.id;
          const isInSelectedRegion = selectedRegionId
            ? point.region === selectedRegionId
            : false;
          const isDimmed = selectedRegionId != null && !isInSelectedRegion;

          // Prioridade de cor: status crítico > status temporal > cor regional
          const isCritical = point.status === 'critical' || point.status === 'maintenance';
          let color;
          if (isCritical) {
            color = pinColor(point.status);
          } else if (isInSelectedRegion && regionColorMap[selectedRegionId]) {
            color = regionColorMap[selectedRegionId];
          } else {
            color = pinColor(point.status);
          }

          return (
            <Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={createDivIcon(color, selected, isDimmed, point.id)}
              eventHandlers={{
                click:     () => onSelectPoint?.(point),
                mouseover: () => mapBus.emit('map:board:pin:hover', { boardId: point.id }),
                mouseout:  () => mapBus.emit('map:board:pin:leave', { boardId: point.id }),
              }}
            >
              <Popup>
                <BoardPopupContent point={point} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <MapStatusLegend compact={compact} />

      {missingCount > 0 && (
        <button
          type="button"
          className="v4-geomap__notice v4-geomap__notice--clickable"
          onClick={() => setShowMissingList((v) => !v)}
          aria-expanded={showMissingList}
          aria-controls="v4-geomap-missing-panel"
          title="Ver placas sem coordenadas"
        >
          <span className="material-symbols-rounded">info</span>
          {missingCount} placa{missingCount !== 1 ? 's' : ''} sem coordenadas
          <span className="material-symbols-rounded v4-geomap__notice-chevron">
            {showMissingList ? 'expand_more' : 'chevron_right'}
          </span>
        </button>
      )}

      {showMissingList && missingCount > 0 && (
        <MissingBoardsPanel
          missingPoints={missingPoints}
          onClose={() => setShowMissingList(false)}
        />
      )}
    </div>
  );
}

export default memo(V4OperationalMap);
