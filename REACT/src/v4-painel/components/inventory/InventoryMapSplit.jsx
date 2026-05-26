import { memo, useEffect, useMemo, useState } from 'react';
import V4OperationalMap    from '../map/V4OperationalMap.jsx';
import TerritoryMiniContext from './TerritoryMiniContext.jsx';
import { mapBus }           from '../../modules/map/mapBus.js';

function toMapPoint(board) {
  const lat = board.latitude  ?? board.lat  ?? board.coords?.lat  ?? null;
  const lng = board.longitude ?? board.lng  ?? board.coords?.lng  ?? null;
  return {
    id:           board.id ?? board.codigo,
    title:        board.codigo,
    subtitle:     board.nome,
    latitude:     lat != null ? Number(lat) : null,
    longitude:    lng != null ? Number(lng) : null,
    status:       board.status ?? 'available',
    region:       board.regiao ?? board.regionName ?? board.siglaRegiao ?? null,
    address:      board.localizacao ?? null,
    mainImageUrl: board.mainImageUrl ?? board.imagemPrincipal ?? board.imageUrl ?? null,
  };
}

function InventoryMapSplit({
  boards          = [],
  selectedBoardId = null,
  onBoardSelect,
  onClose,
  onResizeStart,
  onRegionSelect,
  activeRegion,
  regionStats     = [],
  loading         = false,
}) {
  const [flyTo, setFlyTo] = useState(null);

  useEffect(() => {
    function handleSelect(e) {
      const { lat, lng, zoom } = e.detail ?? {};
      const la = lat != null ? Number(lat) : NaN;
      const lo = lng != null ? Number(lng) : NaN;
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
      setFlyTo({ lat: la, lng: lo, zoom: zoom ?? 15 });
    }
    mapBus.on('map:board:select', handleSelect);
    return () => mapBus.off('map:board:select', handleSelect);
  }, []);

  const mapPoints = useMemo(() => boards.map(toMapPoint), [boards]);

  const validPointCount    = useMemo(
    () => mapPoints.filter((p) => p.latitude != null && p.longitude != null).length,
    [mapPoints],
  );
  const missingCoordsCount = boards.length - validPointCount;
  const shouldCluster      = validPointCount > 50;

  function handleSelectPoint(point) {
    const board = boards.find((b) => (b.id ?? b.codigo) === point.id);
    if (board) onBoardSelect?.(board);
  }

  return (
    <div className="inv-map-panel">
      {/* Resize handle — left edge, only shown on desktop */}
      <div
        className="inv-map-panel__resize-handle"
        onPointerDown={onResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar painel do mapa"
        title="Arrastar para redimensionar"
      />

      <div className="inv-map-panel__header">
        <div className="inv-map-panel__title">
          <span className="material-symbols-rounded" aria-hidden="true">map</span>
          Território operacional
        </div>

        {(shouldCluster || missingCoordsCount > 0) && (
          <div className="inv-map-panel__badges" aria-label="Informações do território">
            {shouldCluster && (
              <span
                className="inv-map-panel__badge inv-map-panel__badge--density"
                title="Alta densidade de pontos — clustering recomendado em versão futura"
              >
                Alta densidade
              </span>
            )}
            {missingCoordsCount > 0 && (
              <span
                className="inv-map-panel__badge inv-map-panel__badge--missing"
                title={`${missingCoordsCount} placa${missingCoordsCount !== 1 ? 's' : ''} sem coordenadas cadastradas`}
              >
                {missingCoordsCount} sem localização
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          className="inv-map-panel__close"
          onClick={onClose}
          aria-label="Fechar mapa lateral"
          title="Fechar mapa lateral"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      <div className="inv-map-panel__body">
        <V4OperationalMap
          points={mapPoints}
          loading={loading}
          selectedPointId={selectedBoardId}
          onSelectPoint={handleSelectPoint}
          height={440}
          flyTo={flyTo}
          emptyMessage="Cadastre coordenadas para ativar o mapa operacional."
          compact={false}
        />
      </div>

      {regionStats.length > 0 && (
        <div className="inv-map-panel__context">
          <TerritoryMiniContext
            regions={regionStats}
            onRegionSelect={onRegionSelect}
            activeRegion={activeRegion}
          />
        </div>
      )}
    </div>
  );
}

export default memo(InventoryMapSplit);
