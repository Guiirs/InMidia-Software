import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useRegions } from '../../../hooks/useRegions.js';
import * as regionService from '../../../services/regionService.js';
import { getRegionStatusMeta } from '../../utils/regionUtils.js';
import RegionFormModal from './RegionFormModal.jsx';
import RegionAlertsPanel from './RegionAlertsPanel.jsx';
import RegionList from './RegionList.jsx';
import RegionOperationsPanel from './RegionOperationsPanel.jsx';
import RegionPlateList from './RegionPlateList.jsx';
import RegionSummaryCard from './RegionSummaryCard.jsx';
import './RegionManagerPanel.css';

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function money(val) {
  if (val == null) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(val));
}

function percentValue(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n > 1 ? n : n * 100);
}

function SkeletonList() {
  return (
    <div className="v4p-rmp__skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="v4p-rmp__skeleton-item">
          <div className="v4p-rmp__skeleton-dot" />
          <div className="v4p-rmp__skeleton-lines">
            <div className="v4p-rmp__skeleton-line v4p-rmp__skeleton-line--wide" />
            <div className="v4p-rmp__skeleton-line" />
          </div>
          <div className="v4p-rmp__skeleton-bar" />
        </div>
      ))}
    </div>
  );
}

function TerritoryHeader({ region, summary, canUpdate, canArchive, actionLoading, onEdit, onArchive }) {
  const color = region.color || region.cor || '#22d3ee';
  const name = region.name || region.nome || '—';
  const city = region.city || region.cidade || '';
  const state = region.state || region.uf || '';
  const location = [city, state].filter(Boolean).join(', ');
  const plates = region.totalPlates ?? region.totalBoards ?? region.placas ?? null;
  const occupancyNum = region.occupancyRate != null
    ? percentValue(region.occupancyRate)
    : typeof region.ocupacao === 'number'
      ? region.ocupacao
      : null;
  const revenue = summary?.activeRevenue != null ? money(summary.activeRevenue) : null;
  const statusMeta = getRegionStatusMeta(region.status ?? 'ACTIVE');
  const isArchived = statusMeta.className === 'is-archived';

  return (
    <div className="v4p-territory-header" style={{ '--tc': color }}>
      <div className="v4p-territory-header__accent" aria-hidden="true" />
      <div className="v4p-territory-header__body">
        <div className="v4p-territory-header__identity">
          <div className="v4p-territory-header__name-row">
            <h3 className="v4p-territory-header__name">{name}</h3>
            <span className={`v4p-territory-header__status-badge ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>
          {location && (
            <p className="v4p-territory-header__loc">
              <span className="material-symbols-rounded" aria-hidden="true">location_on</span>
              {location}
            </p>
          )}
        </div>

        {(plates != null || occupancyNum != null || revenue) && (
          <div className="v4p-territory-header__stats" aria-label="Indicadores do território">
            {plates != null && (
              <div className="v4p-territory-header__stat">
                <strong>{plates}</strong>
                <span>placas</span>
              </div>
            )}
            {occupancyNum != null && (
              <div className="v4p-territory-header__stat">
                <strong
                  className={
                    occupancyNum >= 75
                      ? 'is-healthy'
                      : occupancyNum >= 45
                        ? 'is-warning'
                        : 'is-critical'
                  }
                >
                  {occupancyNum}%
                </strong>
                <span>ocupação</span>
              </div>
            )}
            {revenue && (
              <div className="v4p-territory-header__stat v4p-territory-header__stat--revenue">
                <strong>{revenue}</strong>
                <span>receita ativa</span>
              </div>
            )}
          </div>
        )}

        <div className="v4p-territory-header__actions">
          {canUpdate && (
            <button
              type="button"
              className="v4p-rmp__btn-ghost"
              onClick={onEdit}
              disabled={actionLoading}
              aria-label="Editar território"
              title="Editar"
            >
              <span className="material-symbols-rounded">edit</span>
            </button>
          )}
          {canArchive && !isArchived && (
            <button
              type="button"
              className="v4p-rmp__btn-ghost v4p-rmp__btn-ghost--danger"
              onClick={onArchive}
              disabled={actionLoading}
              aria-label="Arquivar território"
              title="Arquivar"
            >
              <span className="material-symbols-rounded">archive</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NoSelection({ canCreate, onCreateClick }) {
  return (
    <div className="v4p-rmp__no-selection" role="status">
      <span className="material-symbols-rounded" aria-hidden="true">map</span>
      <p>Selecione um território</p>
      <span>para ver métricas, placas e indicadores operacionais</span>
      {canCreate && (
        <button type="button" className="v4p-rmp__btn-primary" onClick={onCreateClick}>
          <span className="material-symbols-rounded" aria-hidden="true">add</span>
          Novo território
        </button>
      )}
    </div>
  );
}

function RegionBacklogPanel({ summary, operationsSummary, alertsSummary }) {
  const backlog = summary?.operationalBacklog ?? ((operationsSummary?.pending ?? 0) + (alertsSummary?.critical ?? 0));
  const next = summary?.nextDueOperation;
  const highestPriority = (operationsSummary?.critical ?? 0) > 0 || (alertsSummary?.critical ?? 0) > 0 ? 'Critica' : backlog > 0 ? 'Media' : 'Estavel';

  return (
    <section className="v4p-region-backlog" aria-label="Backlog regional">
      <header className="v4p-region-panel-header">
        <div>
          <span className="material-symbols-rounded" aria-hidden="true">pending_actions</span>
          <h4>Backlog regional</h4>
        </div>
        <span>{backlog} itens</span>
      </header>
      <div className="v4p-region-backlog__grid">
        <div><strong>{backlog}</strong><span>Total de pendencias</span></div>
        <div><strong>{highestPriority}</strong><span>Prioridade mais alta</span></div>
        <div><strong>{next?.plateNumber ?? 'Sem acao'}</strong><span>Proxima placa</span></div>
        <div><strong>{summary?.expiredPendingRelease ?? 0}</strong><span>Expiradas pendentes</span></div>
      </div>
    </section>
  );
}

function RegionManagerPanel({ onRegionSelect }) {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const canRead    = permissions.includes('regions.read')    || permissions.includes('admin.access');
  const canCreate  = permissions.includes('regions.create')  || permissions.includes('admin.access');
  const canUpdate  = permissions.includes('regions.update')  || permissions.includes('admin.access');
  const canArchive = permissions.includes('regions.archive') || permissions.includes('admin.access');
  const canManage  = permissions.includes('regions.manage')  || permissions.includes('admin.access');

  const {
    regions,
    selectedRegion,
    summary,
    plates,
    operations,
    operationsSummary,
    operationsLoading,
    operationsError,
    alerts,
    alertsSummary,
    alertsLoading,
    alertsError,
    loading,
    error,
    actionLoading,
    refresh,
    selectRegion,
    loadRegionDetails,
    createRegion,
    updateRegion,
    archiveRegion,
  } = useRegions();

  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingRegion, setEditingRegion] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [detachLoading, setDetachLoading]   = useState(false);
  const debouncedSearch = useDebounce(search, 280);
  const initialLoad = useRef(false);

  useEffect(() => {
    if (canRead && !initialLoad.current) {
      initialLoad.current = true;
      refresh();
    }
  }, [canRead, refresh]);

  const handleSelectRegion = useCallback((region) => {
    selectRegion(region);
    loadRegionDetails(region.id);
    onRegionSelect?.(region);
  }, [selectRegion, loadRegionDetails, onRegionSelect]);

  const filteredRegions = useMemo(() => {
    return regions.filter((region) => {
      if (filterStatus !== 'all' && String(region.status ?? '').trim().toLowerCase() !== filterStatus) return false;
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim().toLowerCase();
        const name = (region.name || region.nome || '').toLowerCase();
        const code = (region.code || '').toLowerCase();
        const city = (region.city || region.cidade || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !city.includes(q)) return false;
      }
      return true;
    });
  }, [regions, filterStatus, debouncedSearch]);

  const handleOpenCreate = useCallback(() => {
    setEditingRegion(null);
    setModalOpen(true);
    setActionError(null);
  }, []);

  const handleOpenEdit = useCallback(() => {
    setEditingRegion(selectedRegion);
    setModalOpen(true);
    setActionError(null);
  }, [selectedRegion]);

  const handleSave = async (payload) => {
    setActionError(null);
    try {
      if (editingRegion?.id) {
        await updateRegion(editingRegion.id, payload);
      } else {
        await createRegion(payload);
      }
      setModalOpen(false);
      refresh();
    } catch (err) {
      setActionError(err.message ?? 'Erro ao salvar território.');
    }
  };

  const handleArchive = async () => {
    if (!selectedRegion) return;
    const name = selectedRegion.name || selectedRegion.nome;
    if (!window.confirm(`Arquivar o território "${name}"? Esta ação pode ser revertida pelo suporte.`)) return;
    setActionError(null);
    try {
      await archiveRegion(selectedRegion.id);
      selectRegion(null);
      refresh();
    } catch (err) {
      setActionError(err.message ?? 'Erro ao arquivar território.');
    }
  };

  const handleDetach = async (plateId) => {
    if (!selectedRegion) return;
    setDetachLoading(true);
    setActionError(null);
    try {
      await regionService.detachPlateFromRegion(selectedRegion.id, plateId);
      loadRegionDetails(selectedRegion.id);
    } catch (err) {
      setActionError(err.message ?? 'Erro ao desvincular placa.');
    } finally {
      setDetachLoading(false);
    }
  };

  const handleMigrateLegacy = async () => {
    if (!window.confirm('Migrar territórios legados para o formato V4?\nEsta ação importa dados antigos e não pode ser desfeita.')) return;
    setMigrateLoading(true);
    setActionError(null);
    try {
      await regionService.migrateLegacyRegions();
      refresh();
    } catch (err) {
      setActionError(err.message ?? 'Erro na migração.');
    } finally {
      setMigrateLoading(false);
    }
  };

  const dismissError = () => { setActionError(null); };

  if (!canRead) {
    return (
      <div className="v4p-rmp v4p-rmp--forbidden" role="status">
        <span className="material-symbols-rounded" aria-hidden="true">lock</span>
        <p>Você não tem permissão para visualizar regiões.</p>
      </div>
    );
  }

  return (
    <div className="v4p-rmp">
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <div className="v4p-rmp__topbar">
        <div className="v4p-rmp__topbar-identity">
          <span className="material-symbols-rounded v4p-rmp__topbar-icon" aria-hidden="true">
            map
          </span>
          <span className="v4p-rmp__topbar-label">Centro Territorial</span>
          <span className="v4p-rmp__topbar-sublabel">Cobertura, ocupacao e placas vinculadas</span>
          <span className="v4p-rmp__count" aria-label={`${filteredRegions.length} territorios`}>
            {loading ? '...' : `${filteredRegions.length} territorios`}
          </span>
        </div>
        <div className="v4p-rmp__topbar-actions">
          {canManage && (
            <button
              type="button"
              className="v4p-rmp__btn-ghost"
              onClick={handleMigrateLegacy}
              disabled={migrateLoading}
              title="Migrar territórios legados para V4"
              aria-label="Migrar legado"
            >
              <span
                className={`material-symbols-rounded${migrateLoading ? ' v4p-rmp__spin' : ''}`}
                aria-hidden="true"
              >
                sync_alt
              </span>
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              className="v4p-rmp__btn-primary"
              onClick={handleOpenCreate}
              disabled={actionLoading}
            >
              <span className="material-symbols-rounded" aria-hidden="true">add</span>
              Nova região
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {(error || actionError) && (
        <div className="v4p-rmp__alert" role="alert">
          <span className="material-symbols-rounded" aria-hidden="true">error_outline</span>
          <span>{error || actionError}</span>
          <button
            type="button"
            className="v4p-rmp__alert-dismiss"
            onClick={dismissError}
            aria-label="Fechar aviso"
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {/* ── Workspace: sidebar + territory pane ──────────────────── */}
      <div className="v4p-rmp__workspace">
        {/* Sidebar: filters + list */}
        <div className="v4p-rmp__sidebar" role="complementary" aria-label="Lista de territórios">
          <div className="v4p-rmp__filters">
            <div className="v4p-rmp__search-wrap">
              <span className="material-symbols-rounded v4p-rmp__search-icon" aria-hidden="true">
                search
              </span>
              <input
                type="search"
                className="v4p-rmp__search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar território..."
                aria-label="Buscar territórios"
              />
            </div>
            <select
              className="v4p-rmp__select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>

          <div className="v4p-rmp__list-area">
            {loading && <SkeletonList />}

            {!loading && !error && filteredRegions.length === 0 && (
              <div className="v4p-rmp__empty" role="status">
                <span className="material-symbols-rounded" aria-hidden="true">
                  {regions.length === 0 ? 'add_location_alt' : 'search_off'}
                </span>
                <span>
                  {regions.length === 0
                    ? 'Nenhum território cadastrado'
                    : 'Nenhum resultado encontrado'}
                </span>
              </div>
            )}

            {!loading && filteredRegions.length > 0 && (
              <RegionList
                regions={filteredRegions}
                selectedRegionId={selectedRegion?.id}
                onSelectRegion={handleSelectRegion}
              />
            )}
          </div>
        </div>

        {/* Territory pane */}
        {selectedRegion ? (
          <div
            className="v4p-rmp__territory"
            role="region"
            aria-label={`Detalhes: ${selectedRegion.name || selectedRegion.nome}`}
            style={{ '--tc': selectedRegion.color || selectedRegion.cor || '#22d3ee' }}
          >
            <TerritoryHeader
              region={selectedRegion}
              summary={summary}
              canUpdate={canUpdate}
              canArchive={canArchive}
              actionLoading={actionLoading}
              onEdit={handleOpenEdit}
              onArchive={handleArchive}
            />
            <div className="v4p-rmp__territory-body">
              <RegionSummaryCard
                summary={summary}
                regionName={selectedRegion.name || selectedRegion.nome}
              />
              <RegionOperationsPanel
                operations={operations}
                summary={operationsSummary}
                loading={operationsLoading}
                error={operationsError}
              />
              <RegionAlertsPanel
                alerts={alerts}
                summary={alertsSummary}
                loading={alertsLoading}
                error={alertsError}
              />
              <RegionBacklogPanel
                summary={summary}
                operationsSummary={operationsSummary}
                alertsSummary={alertsSummary}
              />
              <RegionPlateList
                plates={plates}
                canManage={canManage}
                onDetach={handleDetach}
                detachLoading={detachLoading}
              />
            </div>
          </div>
        ) : (
          <NoSelection canCreate={canCreate} onCreateClick={handleOpenCreate} />
        )}
      </div>

      <RegionFormModal
        open={modalOpen}
        region={editingRegion}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        saving={actionLoading}
      />
    </div>
  );
}

export default memo(RegionManagerPanel);
