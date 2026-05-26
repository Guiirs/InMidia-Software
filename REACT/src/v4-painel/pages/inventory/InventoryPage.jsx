import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  BoardDetailsPanel,
  InventoryFilters,
  InventoryTable,
  OccupancyDistribution,
} from '../../components/inventory/index.js';
import BoardEditPanel        from '../../components/inventory/BoardEditPanel.jsx';
import BoardCreatePanel      from '../../components/inventory/BoardCreatePanel.jsx';
import BoardOperationalCard  from '../../components/inventory/BoardOperationalCard.jsx';
import InventoryViewToggle   from '../../components/inventory/InventoryViewToggle.jsx';
import InventoryCommandBar   from '../../components/inventory/InventoryCommandBar.jsx';
import InventoryStatusRail   from '../../components/inventory/InventoryStatusRail.jsx';
import TerritoryMiniContext  from '../../components/inventory/TerritoryMiniContext.jsx';
import BoardDetailPage       from './BoardDetailPage.jsx';

const InventoryMapSplit = lazy(() => import('../../components/inventory/InventoryMapSplit.jsx'));
import { mapBus }            from '../../modules/map/mapBus.js';
import InventoryProvider, { useInventory } from '../../providers/InventoryProvider.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import './InventoryPage.css';

/* ── Constants ──────────────────────────────────────────────── */

const DEFAULT_FILTERS = { regiao: 'Todas', status: 'Todos', categoria: 'Todas', prioridade: 'Todas' };

const BOARD_STATUS = {
  OCCUPIED:    'occupied',
  AVAILABLE:   'available',
  MAINTENANCE: 'maintenance',
  RESERVED:    'reserved',
  CRITICAL:    'critical',
};

const STATUS_MAP = {
  Ocupado:      BOARD_STATUS.OCCUPIED,
  Disponivel:   BOARD_STATUS.AVAILABLE,
  Manutencao:   BOARD_STATUS.MAINTENANCE,
  Critico:      BOARD_STATUS.CRITICAL,
  'Disponível': BOARD_STATUS.AVAILABLE,
  'Manutenção': BOARD_STATUS.MAINTENANCE,
  Reservado:    BOARD_STATUS.RESERVED,
  'Crítico':    BOARD_STATUS.CRITICAL,
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

/* ── localStorage helpers ───────────────────────────────────── */

const MAP_SPLIT_KEY  = 'inmidia:v4:inventory:mapSplitOpen';
const MAP_WIDTH_KEY  = 'inmidia:v4:inventory:mapPanelWidth';
const MAP_WIDTH_MIN  = 340;
const MAP_WIDTH_MAX  = 640;
const MAP_WIDTH_DEFAULT = 440;

function readMapSplitPref() {
  try {
    const saved = localStorage.getItem(MAP_SPLIT_KEY);
    if (saved === null) return false;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return false;
    return saved === 'true';
  } catch { return false; }
}

function saveMapSplitPref(value) {
  try { localStorage.setItem(MAP_SPLIT_KEY, String(value)); } catch { /* ignore */ }
}

function readMapPanelWidthPref() {
  try {
    const parsed = Number(localStorage.getItem(MAP_WIDTH_KEY));
    return Number.isFinite(parsed)
      ? Math.min(MAP_WIDTH_MAX, Math.max(MAP_WIDTH_MIN, parsed))
      : MAP_WIDTH_DEFAULT;
  } catch { return MAP_WIDTH_DEFAULT; }
}

function saveMapPanelWidthPref(value) {
  try { localStorage.setItem(MAP_WIDTH_KEY, String(value)); } catch { /* ignore */ }
}

/* ── Skeleton card ──────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="v4p-board-card" aria-hidden="true" style={{ cursor: 'default' }}>
      <div style={{ aspectRatio: '16/9', background: 'rgba(148,163,184,0.08)', animation: 'v4p-skeleton 1.6s ease-in-out infinite', backgroundSize: '200% 100%' }} />
      <div style={{ padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[85, 60, 40, 70, 50].map((w, i) => (
          <div key={i} style={{ height: 10, width: `${w}%`, borderRadius: 4, background: 'rgba(148,163,184,0.08)', animation: 'v4p-skeleton 1.6s ease-in-out infinite', backgroundSize: '200% 100%' }} />
        ))}
      </div>
    </div>
  );
}

/* ── Operational notice (consolidated secondary banner) ─────── */

function OperationalNotice({ notice }) {
  if (!notice) return null;
  return (
    <div className={`v4p-inventory-op-notice v4p-inventory-op-notice--${notice.level ?? 'info'}`} role={notice.role ?? 'status'}>
      <span className="material-symbols-rounded" style={{ fontSize: 15, flexShrink: 0 }} aria-hidden="true">
        {notice.icon}
      </span>
      <span className="v4p-inventory-op-notice__msg">{notice.msg}</span>
      {notice.action && (
        <button
          type="button"
          className="v4p-inventory-error-retry"
          onClick={notice.action.fn}
        >
          {notice.action.label}
        </button>
      )}
      {notice.onDismiss && (
        <button
          type="button"
          className="v4p-inventory-error-retry"
          onClick={notice.onDismiss}
        >
          Fechar
        </button>
      )}
    </div>
  );
}

/* ── Inner component (consumes InventoryProvider) ────────────── */

function InventoryPageInner({ onNavigateToMap }) {
  const {
    boards, summary, summaryLoading, summaryError, loading, error, source, refresh, refreshSummary,
    status, stale,
    setBoardQuery,
    patchBoardLocally,
    updateBoard, createBoard, deleteBoard, toggleAvailability,
    actionLoading, actionError, clearActionError,
  } = useInventory();

  const { hasPermission } = useAuth();
  const canCreate = hasPermission?.('inventory.create') ?? false;
  const canDelete = hasPermission?.('inventory.delete') ?? false;

  const [filters, setFilters]             = useState(DEFAULT_FILTERS);
  const [search, setSearch]               = useState('');
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [viewMode, setViewMode]           = useState('cards');
  const [editingBoard, setEditingBoard]   = useState(null);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(null);
  const [saveNotice, setSaveNotice]       = useState(false);
  const [deleteError, setDeleteError]     = useState(null);

  const [currentView, setCurrentView] = useState('inventory');
  const [detailBoard, setDetailBoard] = useState(null);
  const [mapSplitOpen, setMapSplitOpen]   = useState(() => readMapSplitPref());
  const [mapPanelWidth, setMapPanelWidth] = useState(() => readMapPanelWidthPref());
  const mapPanelWidthRef = useRef(mapPanelWidth);
  mapPanelWidthRef.current = mapPanelWidth;
  const cardsGridRef = useRef(null);

  useEffect(() => {
    if (!mapSplitOpen || !selectedBoard?.id || !cardsGridRef.current) return;
    const el = cardsGridRef.current.querySelector(`[data-board-card-id="${selectedBoard.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedBoard?.id, mapSplitOpen]);

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const handleClearFilters = () => { setFilters(DEFAULT_FILTERS); setSearch(''); };

  useEffect(() => {
    setBoardQuery?.({
      page: 1, limit: 200,
      search: search || undefined,
      status: filters.status !== 'Todos' ? STATUS_MAP[filters.status] : undefined,
    });
  }, [filters.status, search, setBoardQuery]);

  const showSaveNotice = useCallback(() => {
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 3500);
  }, []);

  const handleSaveBoard = useCallback(async (updated) => {
    const saved = await updateBoard(updated);
    const next  = saved ?? updated;
    setSelectedBoard((prev) => (prev?.id === next.id ? next : prev));
    setDetailBoard  ((prev) => (prev?.id === next.id ? next : prev));
    showSaveNotice();
    return next;
  }, [updateBoard, showSaveNotice]);

  const handleImageBoardChange = useCallback((updated) => {
    if (!updated?.id) return;
    patchBoardLocally?.(updated);
    setEditingBoard ((prev) => (prev?.id === updated.id ? updated : prev));
    setSelectedBoard((prev) => (prev?.id === updated.id ? updated : prev));
    setDetailBoard  ((prev) => (prev?.id === updated.id ? updated : prev));
    refresh?.({ reason: 'inventory:image-update' });
    refreshSummary?.({ reason: 'inventory:image-update' });
    showSaveNotice();
  }, [patchBoardLocally, refresh, refreshSummary, showSaveNotice]);

  const handleCreateBoard = useCallback(async (formData) => {
    await createBoard(formData);
    showSaveNotice();
  }, [createBoard, showSaveNotice]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingBoard) return;
    setDeleteError(null);
    try {
      await deleteBoard(deletingBoard);
      setDeletingBoard(null);
      if (selectedBoard?.id === deletingBoard.id) setSelectedBoard(null);
      if (detailBoard?.id  === deletingBoard.id) {
        setDetailBoard(null);
        setCurrentView('inventory');
      }
      showSaveNotice();
    } catch (err) {
      setDeleteError(err.message ?? 'Não foi possível excluir a placa.');
    }
  }, [deleteBoard, deletingBoard, detailBoard, selectedBoard, showSaveNotice]);

  const handleViewDetails = useCallback((board) => {
    setDetailBoard(board);
    setCurrentView('board-detail');
  }, []);

  const handleBackToInventory = useCallback(() => {
    setCurrentView('inventory');
  }, []);

  const handleToggleMap = useCallback(() => {
    setMapSplitOpen((v) => {
      const next = !v;
      if (!v) setCurrentView('inventory');
      saveMapSplitPref(next);
      return next;
    });
  }, []);

  const handleResizeStart = useCallback((e) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    e.preventDefault();
    const startX     = e.clientX;
    const startWidth = mapPanelWidthRef.current;

    function onMove(ev) {
      const delta    = startX - ev.clientX;
      const newWidth = Math.min(MAP_WIDTH_MAX, Math.max(MAP_WIDTH_MIN, startWidth + delta));
      setMapPanelWidth(newWidth);
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      saveMapPanelWidthPref(mapPanelWidthRef.current);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, []);

  const handleTerritoryRegionSelect = useCallback((regionName) => {
    setFilters((prev) => ({
      ...prev,
      regiao: prev.regiao === regionName ? 'Todas' : regionName,
    }));
  }, []);

  const handleCardSelectInSplit = useCallback((board) => {
    setSelectedBoard(board);
    mapBus.emit('map:board:select', {
      boardId: board.id,
      lat: board.latitude ?? board.lat,
      lng: board.longitude ?? board.lng,
    });
  }, []);

  const handleMapBoardSelect = useCallback((board) => {
    setSelectedBoard(board);
  }, []);

  useEffect(() => {
    function handlePinHover(e) {
      const { boardId } = e.detail ?? {};
      if (!boardId || !cardsGridRef.current) return;
      cardsGridRef.current.querySelector('[data-map-hovered="true"]')
        ?.removeAttribute('data-map-hovered');
      cardsGridRef.current.querySelector(`[data-board-card-id="${boardId}"]`)
        ?.setAttribute('data-map-hovered', 'true');
    }

    function handlePinLeave(e) {
      const { boardId } = e.detail ?? {};
      if (!boardId || !cardsGridRef.current) return;
      cardsGridRef.current.querySelector(`[data-board-card-id="${boardId}"]`)
        ?.removeAttribute('data-map-hovered');
    }

    mapBus.on('map:board:pin:hover', handlePinHover);
    mapBus.on('map:board:pin:leave', handlePinLeave);
    return () => {
      mapBus.off('map:board:pin:hover', handlePinHover);
      mapBus.off('map:board:pin:leave', handlePinLeave);
    };
  }, []);

  const summaryCompact = summary?.compact ?? {};
  const isPanelOpen    = Boolean(editingBoard || creatingBoard || deletingBoard);

  const filteredBoards = useMemo(() => {
    return boards.filter((board) => {
      if (filters.regiao    !== 'Todas' && board.regiao    !== filters.regiao)      return false;
      if (filters.status    !== 'Todos' && board.status    !== STATUS_MAP[filters.status]) return false;
      if (filters.categoria !== 'Todas' && board.categoria !== filters.categoria)   return false;
      if (filters.prioridade !== 'Todas') {
        const pMap = { Urgente: 'urgent', Alta: 'high', Normal: 'normal', Baixa: 'low' };
        if (board.prioridade !== pMap[filters.prioridade]) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return board.codigo.toLowerCase().includes(q)
          || board.nome.toLowerCase().includes(q)
          || board.localizacao.toLowerCase().includes(q)
          || String(board.cliente ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [boards, filters, search]);

  const filterOptions = useMemo(() => ({
    regiao:     ['Todas', ...uniqueSorted(boards.map((b) => b.regiao))],
    status:     ['Todos', 'Ocupado', 'Disponivel', 'Manutencao', 'Reservado', 'Critico'],
    categoria:  ['Todas', ...uniqueSorted(boards.map((b) => b.categoria))],
    prioridade: ['Todas', 'Urgente', 'Alta', 'Normal', 'Baixa'],
  }), [boards]);

  const regionStats = useMemo(() => {
    if (!boards.length) return [];
    const byRegion = {};
    boards.forEach((board) => {
      const name = board.regiao || board.regionName || board.siglaRegiao || 'Sem região';
      if (!byRegion[name]) byRegion[name] = { name, total: 0, occupied: 0 };
      byRegion[name].total++;
      if (board.status === 'occupied') byRegion[name].occupied++;
    });
    return Object.values(byRegion)
      .map((r) => ({ ...r, occupancy: r.total ? r.occupied / r.total : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [boards]);

  const handleTableAction = useCallback(async (board) => {
    if (board.status === BOARD_STATUS.AVAILABLE || board.status === BOARD_STATUS.MAINTENANCE) {
      await toggleAvailability(board);
      showSaveNotice();
      return;
    }
    handleViewDetails(board);
  }, [handleViewDetails, showSaveNotice, toggleAvailability]);

  /* Consolidated secondary operational notice (max 1 banner for background issues) */
  const secondaryNotice = useMemo(() => {
    if (error) return {
      level: 'error', role: 'alert', icon: 'wifi_off',
      msg: `Sincronização indisponível. ${error}`,
      action: { label: 'Tentar novamente', fn: refresh },
    };
    if (status === 'unauthorized') return {
      level: 'error', role: 'alert', icon: 'lock',
      msg: 'Sessão ausente ou expirada. Faça login para acessar o inventário.',
      action: null,
    };
    if (status === 'forbidden') return {
      level: 'error', role: 'alert', icon: 'block',
      msg: 'Sem permissão para acessar o inventário operacional.',
      action: null,
    };
    if (status === 'offline') return {
      level: 'warn', role: 'status', icon: 'wifi_off',
      msg: 'Sem conexão. O inventário exibe a última versão disponível.',
      action: null,
    };
    if (stale && !isPanelOpen) return {
      level: 'warn', role: 'status', icon: 'schedule',
      msg: 'Alguns dados operacionais não foram atualizados. Última versão disponível exibida.',
      action: { label: 'Atualizar', fn: refresh },
    };
    if (summaryError && source === 'real') return {
      level: 'info', role: 'status', icon: 'analytics',
      msg: 'Indicadores de resumo não disponíveis. Exibindo cálculo local.',
      action: { label: 'Tentar novamente', fn: refreshSummary },
    };
    return null;
  }, [error, status, stale, isPanelOpen, summaryError, source, refresh, refreshSummary]);

  /* ── Board detail sub-view ────────────────────────────────── */
  if (currentView === 'board-detail' && detailBoard) {
    const liveBoard = boards.find((b) => b.id === detailBoard.id) ?? detailBoard;
    return (
      <div className="v4p-inventory-page">
        <BoardDetailPage
          board={liveBoard}
          onBack={handleBackToInventory}
          onSave={handleSaveBoard}
          onToggleAvailability={toggleAvailability}
          onNavigateToMap={onNavigateToMap}
          actionLoading={actionLoading}
          actionError={actionError}
          onClearActionError={clearActionError}
        />
        {saveNotice && (
          <div className="v4p-inventory-save-notice" role="status">
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>check_circle</span>
            Alteração salva
          </div>
        )}
      </div>
    );
  }

  /* ── Main inventory view ──────────────────────────────────── */
  return (
    <div className="v4p-inventory-page">

      {/* Zone 1 — Command bar */}
      <InventoryCommandBar
        summary={summaryCompact}
        source={source}
        loading={loading || summaryLoading}
        filteredCount={filteredBoards.length !== boards.length ? filteredBoards.length : null}
        canCreate={canCreate}
        onCreateBoard={() => setCreatingBoard(true)}
        actionLoading={actionLoading}
        mapSplitOpen={mapSplitOpen}
        onToggleMap={handleToggleMap}
      />

      {/* Zone 2 — Status rail */}
      <InventoryStatusRail
        value={filters.status}
        onChange={(v) => handleFilterChange('status', v)}
        distribution={summary?.statusDistribution}
        total={summaryCompact.total}
        loading={loading}
      />

      {/* Zone 3 — Action error (write-operation specific, separate) */}
      {actionError && (
        <div className="v4p-inventory-op-notice v4p-inventory-op-notice--error" role="alert">
          <span className="material-symbols-rounded" style={{ fontSize: 15, flexShrink: 0 }} aria-hidden="true">sync_problem</span>
          <span className="v4p-inventory-op-notice__msg">{actionError}</span>
          <button type="button" onClick={clearActionError} className="v4p-inventory-error-retry">Fechar</button>
        </div>
      )}

      {/* Zone 3b — Consolidated secondary notice (max 1) */}
      <OperationalNotice notice={secondaryNotice} />

      {/* Zone 4+5 — Split container: filters + workspace (left) + map panel (right) */}
      <div
        className={mapSplitOpen ? 'inv-workspace--split' : 'inv-workspace--solo'}
        style={mapSplitOpen ? { '--map-panel-width': `${mapPanelWidth}px` } : undefined}
      >
        <div className="inv-asset-area">
          <InventoryFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
            onSearch={setSearch}
            searchValue={search}
            options={filterOptions}
            summary={summaryCompact}
            hideStatusField
            hideSummaryStrip
          />

          <section className="v4p-inventory-workspace">
            <div className="v4p-inventory-table-area">
              <div className="v4p-inventory-section-head">
                <div>
                  <h2>Placas operacionais</h2>
                  <p>
                    {viewMode === 'cards'
                      ? 'Visão por cards com imagem e ações rápidas.'
                      : 'Tabela de disponibilidade, receita e prioridade.'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ color: 'var(--v4p-text-4)', fontSize: 11 }}>
                    {loading ? '…' : `${filteredBoards.length} resultado${filteredBoards.length !== 1 ? 's' : ''}`}
                  </span>
                  <InventoryViewToggle view={viewMode} onChange={setViewMode} />
                </div>
              </div>

              {viewMode === 'cards' ? (
                <div className="v4p-inventory-cards-grid" ref={cardsGridRef}>
                  {loading ? (
                    Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)
                  ) : filteredBoards.length === 0 ? (
                    <div className="v4p-inventory-empty">
                      <span className="material-symbols-rounded">search_off</span>
                      <p>Nenhuma placa encontrada com os filtros selecionados.</p>
                    </div>
                  ) : (
                    filteredBoards.map((board) => {
                      const isMapSelected = mapSplitOpen && selectedBoard?.id === board.id;
                      return (
                        <div
                          key={board.id}
                          data-board-card-id={board.id}
                          className={isMapSelected ? 'inv-card-wrap inv-card-wrap--selected' : 'inv-card-wrap'}
                        >
                          <BoardOperationalCard
                            board={board}
                            onSelect={mapSplitOpen ? handleCardSelectInSplit : handleViewDetails}
                            onEdit={setEditingBoard}
                            onDelete={canDelete ? setDeletingBoard : undefined}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <InventoryTable
                  boards={filteredBoards}
                  onSelectBoard={handleViewDetails}
                  onActionBoard={handleTableAction}
                  actionLoading={actionLoading}
                />
              )}
            </div>

            <aside className="v4p-inventory-detail-area">
              <BoardDetailsPanel board={selectedBoard} onClose={() => setSelectedBoard(null)} />
              <OccupancyDistribution distribution={summary?.statusDistribution} total={summaryCompact.total} />
              {!mapSplitOpen && (
                <TerritoryMiniContext
                  regions={regionStats}
                  onRegionSelect={handleTerritoryRegionSelect}
                  activeRegion={filters.regiao !== 'Todas' ? filters.regiao : null}
                />
              )}
            </aside>
          </section>
        </div>

        {mapSplitOpen && (
          <Suspense fallback={<div className="inv-map-panel inv-map-panel--loading" aria-busy="true" />}>
            <InventoryMapSplit
              boards={filteredBoards}
              selectedBoardId={selectedBoard?.id}
              onBoardSelect={handleMapBoardSelect}
              onClose={handleToggleMap}
              onResizeStart={handleResizeStart}
              onRegionSelect={handleTerritoryRegionSelect}
              activeRegion={filters.regiao !== 'Todas' ? filters.regiao : null}
              regionStats={regionStats}
              loading={loading}
            />
          </Suspense>
        )}
      </div>

      {/* Panels */}
      {editingBoard && (
        <BoardEditPanel
          board={editingBoard}
          onSave={handleSaveBoard}
          onImageChange={handleImageBoardChange}
          onClose={() => setEditingBoard(null)}
          saving={actionLoading}
        />
      )}

      {creatingBoard && (
        <BoardCreatePanel
          onSave={handleCreateBoard}
          onClose={() => setCreatingBoard(false)}
          saving={actionLoading}
        />
      )}

      {deletingBoard && (
        <div
          className="v4p-edit-panel__backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) { setDeletingBoard(null); setDeleteError(null); } }}
          aria-hidden="false"
        >
          <div
            className="v4p-edit-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="v4p-delete-confirm-title"
            style={{ maxWidth: 440 }}
          >
            <header className="v4p-edit-panel__header">
              <div>
                <span className="v4p-edit-panel__eyebrow" style={{ color: 'var(--v4p-danger)' }}>Atenção</span>
                <h2 id="v4p-delete-confirm-title" style={{ fontSize: 16 }}>Excluir placa?</h2>
              </div>
              <button
                type="button"
                className="v4p-edit-panel__close material-symbols-rounded"
                onClick={() => { setDeletingBoard(null); setDeleteError(null); }}
                aria-label="Cancelar exclusão"
                disabled={actionLoading}
              >
                close
              </button>
            </header>
            <div className="v4p-edit-panel__body" style={{ gap: 8 }}>
              <p style={{ fontSize: 13, color: 'var(--v4p-text-2)', margin: 0 }}>
                Você está prestes a excluir a placa{' '}
                <strong style={{ color: 'var(--v4p-text-1)', fontFamily: 'var(--v4p-mono)' }}>
                  {deletingBoard.codigo}
                </strong>
                . Esta ação não pode ser desfeita.
              </p>
              {deleteError && (
                <div style={{
                  padding: '8px 12px', borderRadius: 'var(--v4p-r-md)',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
                  fontSize: 12, color: 'var(--v4p-danger)',
                }}>
                  {deleteError}
                </div>
              )}
            </div>
            <footer className="v4p-edit-panel__footer">
              <button
                type="button"
                className="v4p-edit-panel__btn-cancel"
                onClick={() => { setDeletingBoard(null); setDeleteError(null); }}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 32, padding: '0 14px', borderRadius: 'var(--v4p-r-md)',
                  fontFamily: 'var(--v4p-font)', fontSize: 12, fontWeight: 600,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  border: 0, background: 'var(--v4p-danger)', color: '#fff',
                  opacity: actionLoading ? 0.55 : 1,
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span>
                {actionLoading ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {saveNotice && (
        <div className="v4p-inventory-save-notice" role="status">
          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>check_circle</span>
          Operação concluída
        </div>
      )}
    </div>
  );
}

/* ── Exported component ──────────────────────────────────────── */

function InventoryPage({ onNavigateToMap }) {
  return (
    <InventoryProvider>
      <InventoryPageInner onNavigateToMap={onNavigateToMap} />
    </InventoryProvider>
  );
}

export default memo(InventoryPage);
