import { memo, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mapBus } from '../../modules/map/mapBus.js';

import { useSyncResource } from '../../../core/sync-core/hooks/useSyncResource.js';
import { V4OperationalMap, OpportunityMapPanel, RegionSidebar } from '../../components/map/index.js';
import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { normalizeBoardCoordinates } from '../../integration/adapters/boardCoordinates.js';
import { isBoardWithoutRegion } from '../../utils/regionUtils.js';
import './MapPage.css';

const DEFAULT_FILTERS = { regionId: 'all', status: 'all', search: '' };
const EMPTY_LIST = [];
const EMPTY_SUMMARY = {};

function toMapPoints(boards) {
  return boards.map((board) => {
    const coords = normalizeBoardCoordinates(board);
    return {
      id: board.id ?? board.codigo,
      title: board.codigo,
      subtitle: board.nome,
      latitude: coords.latitude,
      longitude: coords.longitude,
      status: board.status ?? 'available',
      region: getBoardRegionId(board),
      address: board.localizacao,
      mainImageUrl: board.mainImageUrl ?? board.imagemPrincipal ?? board.imageUrl ?? null,
      images: board.images ?? board.imagens ?? [],
      imageStatus: board.imageStatus ?? (board.mainImageUrl || board.imagemPrincipal || board.imageUrl ? 'AVAILABLE' : 'MISSING'),
      metadata: { coordinateSource: coords.source },
    };
  });
}

function getRegionValue(value) {
  if (value == null) return null;
  if (typeof value === 'object') return getRegionValue(value.id ?? value._id ?? value.codigo ?? value.code ?? null);
  const normalized = String(value).trim();
  return normalized || null;
}

function getBoardRegionId(board) {
  return getRegionValue(board.regionId)
    ?? getRegionValue(board.regiaoId)
    ?? getRegionValue(board.regiao)
    ?? getRegionValue(board.loteRegional)
    ?? getRegionValue(board.regionalLot);
}

function statusFrom(...resources) {
  if (resources.some((r) => r.status === 'unauthorized')) return 'unauthorized';
  if (resources.some((r) => r.status === 'forbidden')) return 'forbidden';
  if (resources.some((r) => r.status === 'offline')) return 'offline';
  if (resources.some((r) => r.status === 'error')) return 'error';
  if (resources.some((r) => r.status === 'stale' || r.isStale)) return 'stale';
  if (resources.some((r) => r.status === 'refreshing' || r.isRefreshing)) return 'refreshing';
  if (resources.some((r) => r.status === 'loading' || r.status === 'idle')) return 'loading';
  return 'success';
}

function firstError(...resources) {
  return resources.find((r) => r.error)?.error?.message ?? null;
}

function regionCode(region) {
  return region.code || region.name?.slice(0, 2).toUpperCase() || 'SR';
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function normalizeRegionBoundary(boundary) {
  if (!boundary) return null;
  if (boundary.type === 'Feature') return boundary.geometry ?? null;
  if (boundary.type === 'Polygon' || boundary.type === 'MultiPolygon') return boundary;
  if (Array.isArray(boundary.coordinates)) {
    return { type: 'Polygon', coordinates: boundary.coordinates };
  }
  if (Array.isArray(boundary)) {
    return { type: 'Polygon', coordinates: boundary };
  }
  return null;
}

function toMapRegions(regions) {
  return regions.map((region, index) => {
    const occupancy = Number(region.occupancyRate ?? 0);
    const totalRevenue = region.boards?.reduce((sum, board) => sum + Number(board.receitaEstimada ?? 0), 0) ?? 0;
    const state = occupancy >= 0.75
      ? OPERATIONAL_STATE.HEALTHY
      : occupancy >= 0.45
        ? OPERATIONAL_STATE.WARNING
        : OPERATIONAL_STATE.DEGRADED;
    const col = 2 + (index % 8);
    const row = 1 + (index % 7);

    return {
      id: region.id,
      label: region.name,
      sigla: regionCode(region),
      col,
      row,
      colSpan: 1,
      rowSpan: 1,
      placas: region.totalBoards,
      ocupacao: occupancy,
      estado: state,
      heatLevel: Math.ceil(occupancy * 5),
      receita: totalRevenue,
      cor: occupancy >= 0.75 ? 'rgba(56,199,143,0.45)' : occupancy >= 0.45 ? 'rgba(227,180,86,0.35)' : 'rgba(239,68,68,0.28)',
      regionColor: region.color ?? null,
      centerLatitude: region.centerLatitude ?? null,
      centerLongitude: region.centerLongitude ?? null,
      boundary: normalizeRegionBoundary(region.boundary ?? region.polygon ?? region.geojson ?? region.geoJson),
      operationsPending: region.pendingOperations ?? region.operationalBacklog ?? null,
      criticalAlerts: region.criticalAlertsCount ?? null,
      endingContracts: region.endingContracts ?? null,
    };
  });
}

function toOpportunities(regions) {
  return regions
    .filter((region) => region.availableBoards > 0 || region.occupancyRate < 0.5)
    .map((region) => ({
      id: `opp-${region.id}`,
      regiao: region.name,
      tipo: region.availableBoards > 0 ? 'ociosa' : 'baixa ocupacao',
      potencial: `${money(region.boards?.reduce((sum, board) => (
        board.status === 'available' ? sum + Number(board.receitaEstimada ?? 0) : sum
      ), 0) ?? 0)}/mes`,
      label: `${region.availableBoards} placas disponiveis em ${region.name}`,
    }));
}

function DataSourceBadge({ status, hasData }) {
  const label = status === 'success' && hasData ? 'DADOS REAIS' : status === 'success' ? 'VAZIO REAL' : status.toUpperCase();
  return <span className={`v4p-source-badge v4p-source-badge--${hasData ? 'real' : 'empty'}`}>{label}</span>;
}

function MapStateNotice({ status, error, onRetry }) {
  if (status === 'success' || status === 'refreshing') return null;
  const copy = {
    loading: 'Carregando mapa pela API V4.',
    stale: 'Dados em revalidacao. Exibindo o ultimo retorno real do Sync Core.',
    unauthorized: 'Sessao ausente ou expirada para carregar o mapa.',
    forbidden: 'Seu usuario nao tem permissao inventory.read para acessar regioes.',
    offline: 'Sem conexao. O mapa nao exibira dados locais enquanto estiver offline.',
    error: error || 'Nao foi possivel carregar regioes pela API V4.',
  }[status];

  return (
    <div className="v4p-inventory-error-banner" role={status === 'error' ? 'alert' : 'status'}>
      <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
        {status === 'offline' ? 'wifi_off' : status === 'forbidden' ? 'block' : 'info'}
      </span>
      <span>{copy}</span>
      {status !== 'loading' && (
        <button type="button" onClick={onRetry} className="v4p-inventory-error-retry">Tentar novamente</button>
      )}
    </div>
  );
}

function FocusBanner({ board, onClear }) {
  if (!board) return null;
  return (
    <div className="v4p-map-focus-banner" role="status" aria-live="polite">
      <div className="v4p-map-focus-banner__inner">
        <span className="material-symbols-rounded v4p-map-focus-banner__pulse" aria-hidden="true">
          location_on
        </span>
        <div className="v4p-map-focus-banner__text">
          <strong>{board.codigo}</strong>
          <span>{board.nome}</span>
          <span className="v4p-map-focus-banner__loc">{board.localizacao}</span>
        </div>
        {board.hasCoordinates && (
          <div className="v4p-map-focus-banner__coords">
            <span>{board.lat?.toFixed(4)}</span>
            <span>{board.lng?.toFixed(4)}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className="v4p-map-focus-banner__close"
        onClick={onClear}
        aria-label="Remover foco da placa"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 15 }}>close</span>
        Remover foco
      </button>
    </div>
  );
}

function RegionActiveChip({ region, onClear }) {
  if (!region) return null;
  const color = region.regionColor || region.cor || '#22d3ee';
  return (
    <div className="v4p-map-region-chip" role="status" aria-live="polite">
      <span
        className="v4p-map-region-chip__dot"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="v4p-map-region-chip__label">Região ativa:</span>
      <strong className="v4p-map-region-chip__name">{region.label}</strong>
      {!region.centerLatitude && !region.centerLongitude && (
        <span className="v4p-map-region-chip__no-coords" title="Esta região ainda não possui coordenadas centrais.">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>location_off</span>
        </span>
      )}
      {[region.operationsPending, region.criticalAlerts, region.endingContracts].some((value) => value != null) && (
        <span className="v4p-map-region-chip__ops">
          {region.operationsPending != null && <em>{region.operationsPending} ops</em>}
          {region.criticalAlerts != null && <em>{region.criticalAlerts} alertas</em>}
          {region.endingContracts != null && <em>{region.endingContracts} vencendo</em>}
        </span>
      )}
      <button
        type="button"
        className="v4p-map-region-chip__clear"
        onClick={onClear}
        aria-label="Limpar região ativa"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
      </button>
    </div>
  );
}

function MapPage({ focusBoard, onClearFocus }) {
  const navigate = useNavigate();
  const boardsResource  = useSyncResource('inventory.boards');
  const regionsResource = useSyncResource('inventory.regions');
  const summaryResource = useSyncResource('inventory.summary');
  // ── selectedRegionId é a ÚNICA fonte de verdade para a região ativa ──────
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [boardSelectFlyTo, setBoardSelectFlyTo] = useState(null);

  const status  = statusFrom(boardsResource, regionsResource, summaryResource);
  const error   = firstError(regionsResource, boardsResource, summaryResource);
  const boards  = Array.isArray(boardsResource.data) ? boardsResource.data : EMPTY_LIST;
  const regions = Array.isArray(regionsResource.data?.regions) ? regionsResource.data.regions : EMPTY_LIST;
  const summary = summaryResource.data?.compact ?? EMPTY_SUMMARY;
  const hasData = regions.length > 0 || boards.length > 0;

  const mapRegions    = useMemo(() => toMapRegions(regions), [regions]);
  const opportunities = useMemo(() => toOpportunities(regions), [regions]);
  const regionOptions = useMemo(() => regions.map((r) => ({ id: r.id, label: r.name })), [regions]);

  // ── selectedRegion derivado de mapRegions — nunca setar manualmente ───────
  const selectedRegion = useMemo(
    () => mapRegions.find((r) => r.id === selectedRegionId) ?? null,
    [mapRegions, selectedRegionId],
  );

  const handleSelectRegion = useCallback((regionId) => {
    const id = regionId ?? null;
    setSelectedRegionId(id);
    setFilters((prev) => ({ ...prev, regionId: id ?? 'all' }));
    setBoardSelectFlyTo(null);
  }, []);

  const handleClearRegion = useCallback(() => {
    setSelectedRegionId(null);
    setFilters((prev) => ({ ...prev, regionId: 'all' }));
  }, []);

  useEffect(() => {
    if (!selectedRegionId || regionsResource.status !== 'success' || selectedRegion) return;
    setSelectedRegionId(null);
    setFilters((prev) => ({ ...prev, regionId: 'all' }));
  }, [regionsResource.status, selectedRegion, selectedRegionId]);

  useEffect(() => {
    function handleBoardSelect(e) {
      const { lat, lng, zoom } = e.detail ?? {};
      const la = lat != null ? Number(lat) : NaN;
      const lo = lng != null ? Number(lng) : NaN;
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
      setBoardSelectFlyTo({ lat: la, lng: lo, zoom: zoom ?? 15 });
    }
    mapBus.on('map:board:select', handleBoardSelect);
    return () => mapBus.off('map:board:select', handleBoardSelect);
  }, []);

  const filteredBoards = useMemo(() => boards.filter((board) => {
    if (filters.regionId !== 'all') {
      if (filters.regionId === 'no-region') {
        // Inclui qualquer placa sem vínculo territorial (legado + V4)
        if (!isBoardWithoutRegion(board)) return false;
      } else {
        // Filtra pela região selecionada — checar todos os campos possíveis
        const bid = filters.regionId;
        const match = getBoardRegionId(board) === bid;
        if (!match) return false;
      }
    }
    if (filters.status !== 'all' && board.status !== filters.status) return false;
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      return board.codigo.toLowerCase().includes(q)
        || board.nome.toLowerCase().includes(q)
        || board.localizacao.toLowerCase().includes(q);
    }
    return true;
  }), [boards, filters]);

  const mapPoints = useMemo(() => toMapPoints(filteredBoards), [filteredBoards]);

  const regionColorMap = useMemo(() => {
    const map = {};
    mapRegions.forEach((r) => { if (r.regionColor) map[r.id] = r.regionColor; });
    return map;
  }, [mapRegions]);

  const regionBoundaries = useMemo(
    () => mapRegions
      .filter((region) => region.boundary)
      .map((region) => ({
        id: region.id,
        label: region.label,
        color: region.regionColor ?? region.cor ?? '#22d3ee',
        geometry: region.boundary,
      })),
    [mapRegions],
  );

  const regionFlyTo = useMemo(() => {
    if (!selectedRegion?.centerLatitude || !selectedRegion?.centerLongitude) return null;
    return { lat: selectedRegion.centerLatitude, lng: selectedRegion.centerLongitude };
  }, [selectedRegion]);

  const flyTo = boardSelectFlyTo ?? regionFlyTo;

  const refresh = () => Promise.all([
    boardsResource.refresh({ reason: 'map-manual' }),
    regionsResource.refresh({ reason: 'map-manual' }),
    summaryResource.refresh({ reason: 'map-manual' }),
  ]);

  return (
    <div className="v4p-map-page">
      <header className="v4p-map-hero">
        <div>
          <span>Mapa operacional</span>
          <h1>Cobertura OOH por regioes</h1>
          <p>Regioes e placas derivadas da API V4 de inventario.</p>
        </div>
        <div className="v4p-map-hero__metrics">
          <article>
            <strong>{status === 'loading' ? '...' : boards.length}</strong>
            <p>pontos monitorados</p>
          </article>
          <article>
            <strong>{status === 'loading' ? '...' : regions.length}</strong>
            <p>regioes</p>
          </article>
          <article>
            <strong>{status === 'loading' ? '...' : `${Math.round((summary.taxaOcupacao ?? 0) * 100)}%`}</strong>
            <p>ocupacao media</p>
          </article>
          <DataSourceBadge status={status} hasData={hasData} />
        </div>
        <button
          type="button"
          className="v4p-map-hero__manage-btn"
          onClick={() => navigate('/regioes')}
          aria-label="Gerenciar regiões"
        >
          <span className="material-symbols-rounded" aria-hidden="true">hub</span>
          Gerenciar regiões
        </button>
      </header>

      <MapStateNotice status={status} error={error} onRetry={refresh} />

      <FocusBanner board={focusBoard} onClear={onClearFocus} />

      <RegionActiveChip region={selectedRegion} onClear={handleClearRegion} />

      <section className="v4p-map-filters" aria-label="Filtros do mapa">
        <input
          type="search"
          value={filters.search}
          placeholder="Buscar placa ou localizacao"
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
        />
        <select
          value={filters.regionId}
          onChange={(e) => {
            const id = e.target.value;
            // Dropdown é fonte de verdade secundária — atualiza selectedRegionId
            setFilters((prev) => ({ ...prev, regionId: id }));
            if (id === 'all' || id === 'no-region') {
              setSelectedRegionId(null);
            } else {
              setSelectedRegionId(id);
            }
          }}
        >
          <option value="all">Todas as regioes</option>
          <option value="no-region">Sem região</option>
          {regionOptions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="all">Todos os status</option>
          <option value="available">Disponivel</option>
          <option value="occupied">Ocupado</option>
          <option value="reserved">Reservado</option>
          <option value="maintenance">Manutencao</option>
          <option value="critical">Critico</option>
        </select>
        <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setSelectedRegionId(null); }}>
          Limpar filtros
        </button>
      </section>

      {!hasData && status === 'success' ? (
        <section className="v4p-map-empty" role="status">
          <span className="material-symbols-rounded">map</span>
          <strong>Nenhuma regiao com placas cadastradas.</strong>
          <p>Cadastre placas reais com regiao para preencher o mapa operacional.</p>
          <button
            type="button"
            className="v4p-map-empty__manage"
            onClick={() => navigate('/regioes')}
          >
            <span className="material-symbols-rounded" aria-hidden="true">hub</span>
            Gerenciar regiões
          </button>
        </section>
      ) : (
        <>
          <section className="v4p-map-workspace">
            <aside className="v4p-map-regions">
              <RegionSidebar
                regions={mapRegions}
                opportunities={opportunities}
                selectedRegionId={selectedRegionId}
                onRegionSelect={handleSelectRegion}
              />
            </aside>

            <main className="v4p-map-stage">
              <div className="v4p-map-stage__top">
                <div>
                  <h2>Distribuicao geografica</h2>
                  <p>
                    {focusBoard
                      ? `Placa em foco: ${focusBoard.codigo} - ${focusBoard.nome}`
                      : selectedMarker
                        ? `${selectedMarker.id} selecionado`
                        : selectedRegion
                          ? `${selectedRegion.label} em foco`
                          : 'Visao consolidada por regiao e marcador operacional.'}
                  </p>
                </div>
                <div className="v4p-map-stage__top-actions">
                  {selectedRegion && (
                    <button
                      type="button"
                      className="v4p-map-stage__btn-secondary"
                      onClick={handleClearRegion}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 15 }}>close</span>
                      Limpar região
                    </button>
                  )}
                  {(selectedMarker || focusBoard) && (
                    <button
                      type="button"
                      className="v4p-map-stage__btn-secondary"
                      onClick={() => { setSelectedMarker(null); onClearFocus?.(); }}
                    >
                      Limpar selecao
                    </button>
                  )}
                  <button
                    type="button"
                    className="v4p-map-stage__btn-manage"
                    onClick={() => navigate('/regioes')}
                    title="Gerenciar regiões"
                  >
                    <span className="material-symbols-rounded" aria-hidden="true">hub</span>
                    Gerenciar regiões
                  </button>
                </div>
              </div>
              <V4OperationalMap
                points={mapPoints}
                loading={status === 'loading'}
                error={status === 'error' ? (error ?? 'Nao foi possivel carregar as placas.') : null}
                selectedPointId={selectedMarker?.id}
                onSelectPoint={setSelectedMarker}
                height={520}
                flyTo={flyTo}
                selectedRegionId={selectedRegionId}
                regionColorMap={regionColorMap}
                regionBoundaries={regionBoundaries}
              />
            </main>
          </section>

          <section className="v4p-map-opportunities">
            <OpportunityMapPanel opportunities={opportunities} />
          </section>
        </>
      )}
    </div>
  );
}

export default memo(MapPage);
