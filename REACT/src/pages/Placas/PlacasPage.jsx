// src/pages/Placas/PlacasPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchPlacas, deletePlaca, togglePlacaDisponibilidade, fetchRegioes, reorderPlacas } from '../../services';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import PlacaCard, { PlacaCardSkeleton } from '../../components/PlacaCard/PlacaCard';
import { subscribe } from '../../services/syncService';
import { SYNC_EVENT_TYPES } from '../../contracts';
import PlacaOrganizationPanel from './PlacaOrganizationPanel';
import {
  detectOperationalGaps,
  normalizeOperationalList,
  buildAutoOrganizationPreview,
  applyDragMove,
  getFriendlyOrganizationError,
} from './placaOrganizationUtils';
import './Placas.css';

const ITEMS_PER_PAGE = 10;

function PlacasPage() {
  const [filters, setFilters] = useState({ regiao_id: 'todas', disponibilidade: 'todos', search: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);
  const [organizationBefore, setOrganizationBefore] = useState([]);
  const [organizationDraft, setOrganizationDraft] = useState([]);
  const [organizationFeedback, setOrganizationFeedback] = useState('');
  const [organizationError, setOrganizationError] = useState('');

  const navigate = useNavigate();
  const showToast = useToast();
  const showConfirmation = useConfirmation();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreatePlaca = hasPermission(PERMISSIONS.PLACAS_CREATE);
  const canEditPlaca = hasPermission(PERMISSIONS.PLACAS_EDIT);
  const canDeletePlaca = hasPermission(PERMISSIONS.PLACAS_DELETE);
  const canTogglePlaca = hasPermission(PERMISSIONS.PLACAS_EDIT);

  // ─── Sync: subscriptions para eventos de placa ──────────────────────────────
  useEffect(() => {
    /**
     * Aplica PLACA_STATUS_CHANGED diretamente no cache sem refetch.
     * Payload contém: { disponivel, placaId }
     */
    const onStatusChanged = (event) => {
      const { entityId, payload } = event;
      queryClient.setQueriesData(
        { queryKey: ['placas'], exact: false },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((p) =>
              (p.id === entityId || p._id === entityId)
                ? { ...p, disponivel: payload.disponivel, ativa: payload.disponivel }
                : p
            ),
          };
        }
      );
    };

    /**
     * PLACA_DELETED: remove a placa do cache.
     */
    const onDeleted = (event) => {
      const { entityId } = event;
      queryClient.setQueriesData(
        { queryKey: ['placas'], exact: false },
        (old) => {
          if (!old?.data) return old;
          const filtered = old.data.filter((p) => p.id !== entityId && p._id !== entityId);
          return {
            ...old,
            data: filtered,
            pagination: old.pagination
              ? { ...old.pagination, totalDocs: Math.max(0, (old.pagination.totalDocs ?? 0) - 1) }
              : old.pagination,
          };
        }
      );
    };

    /**
     * PLACA_CREATED / PLACA_UPDATED: payload é mínimo, invalida para refetch.
     * Preserva os filtros atuais — não volta para página 1.
     */
    const onCreatedOrUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['placas'] });
    };

    const unsubs = [
      subscribe(SYNC_EVENT_TYPES.PLACA_STATUS_CHANGED, onStatusChanged),
      subscribe(SYNC_EVENT_TYPES.PLACA_DELETED, onDeleted),
      subscribe(SYNC_EVENT_TYPES.PLACA_CREATED, onCreatedOrUpdated),
      subscribe(SYNC_EVENT_TYPES.PLACA_UPDATED, onCreatedOrUpdated),
    ];

    return () => unsubs.forEach(fn => fn());
  }, [queryClient]);
  // ────────────────────────────────────────────────────────────────────────────

  // --- useQuery para Regiões (Filtro) ---
  const { data: regioes = [], isLoading: isLoadingRegioes } = useQuery({
    queryKey: ['regioes'],
    queryFn: fetchRegioes, // Agora corresponde à importação correta
    staleTime: 1000 * 60 * 60,
    placeholderData: [],
  });

  // --- useQuery para Placas ---
  const queryKeyPlacas = ['placas', filters, currentPage];
  const {
    data: placasData,
    isLoading: isLoadingPlacas,
    isError: isErrorPlacas,
    error: errorPlacas,
    isPlaceholderData,
  } = useQuery({
    queryKey: queryKeyPlacas,
    queryFn: async ({ queryKey }) => {
      const [_key, currentFilters, page] = queryKey;
      if (import.meta.env.DEV) console.log(`Fetching placas - Page: ${page}, Filters:`, currentFilters);
      const params = new URLSearchParams({
        page,
        limit: ITEMS_PER_PAGE,
        sortBy: 'createdAt',
        order: 'asc' // Ordenar da mais antiga para a mais nova
      });
      if (currentFilters.regiao_id !== 'todas') params.append('regiaoId', currentFilters.regiao_id);
      if (currentFilters.search) params.append('search', currentFilters.search);
      if (currentFilters.disponibilidade === 'true') params.append('ativa', 'true');
      else if (currentFilters.disponibilidade === 'false' || currentFilters.disponibilidade === 'manutencao') {
          params.append('ativa', 'false');
      }
      const result = await fetchPlacas(params);
      return result;
    },
    placeholderData: (previousData) => previousData,
  });

  const {
    data: organizationData,
    isLoading: isLoadingOrganizationData,
    isError: isErrorOrganizationData,
  } = useQuery({
    queryKey: ['placas-organizacao'],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
        sortBy: 'numeroOperacional',
        order: 'asc',
      });
      return fetchPlacas(params);
    },
    enabled: canEditPlaca,
    staleTime: 1000 * 30,
  });

  const placas = placasData?.data ?? [];
  const pagination = placasData?.pagination ?? { currentPage: 1, totalPages: 1, totalDocs: 0 };
  const organizationSource = useMemo(
    () => normalizeOperationalList(organizationData?.data ?? []),
    [organizationData]
  );
  const operationalGapInfo = useMemo(
    () => detectOperationalGaps(organizationSource),
    [organizationSource]
  );

  // --- Contadores de Status ---
  const statusCounts = useMemo(() => {
    const counts = { disponiveis: 0, alugadas: 0, reservadas: 0, manutencao: 0 };
    placas.forEach(placa => {
      if (placa.aluguel_ativo) {
        if (placa.aluguel_futuro) {
          counts.reservadas++;
        } else {
          counts.alugadas++;
        }
      } else if (placa.disponivel === false || placa.ativa === false) {
        counts.manutencao++;
      } else {
        counts.disponiveis++;
      }
    });
    return counts;
  }, [placas]);

  // --- Mutações (Delete, Toggle) ---

  // Mutação para Apagar Placa
  const deleteMutation = useMutation({
    mutationFn: deletePlaca,
    onSuccess: (_, placaId) => {
      showToast('Placa apagada com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: queryKeyPlacas });

      const validPlacasCount = placas.filter(p => !!p).length;
      
      if (validPlacasCount === 1 && currentPage > 1) {
          const prevPage = currentPage - 1;
          queryClient.prefetchQuery({
              queryKey: ['placas', filters, prevPage],
              queryFn: async () => {
                  const params = new URLSearchParams({
                    page: prevPage,
                    limit: ITEMS_PER_PAGE,
                    sortBy: 'createdAt',
                    order: 'asc' 
                  });
                   if (filters.regiao_id !== 'todas') params.append('regiaoId', filters.regiao_id);
                   if (filters.search) params.append('search', filters.search);
                   if (filters.disponibilidade === 'true') params.append('ativa', 'true');
                   else if (filters.disponibilidade === 'false' || filters.disponibilidade === 'manutencao') {
                       params.append('ativa', 'false');
                   }
                  return await fetchPlacas(params);
              }
          });
           setCurrentPage(prevPage);
      }
    },
    onError: (error) => {
      showToast(error.message || 'Erro ao apagar placa.', 'error');
    }
  });

  // Mutação para Alternar Disponibilidade
  const toggleMutation = useMutation({
    mutationFn: togglePlacaDisponibilidade,
    onSuccess: (updatedPlaca) => {
      showToast('Status da placa atualizado!', 'success');
      
      queryClient.setQueryData(queryKeyPlacas, (oldData) => {
          if (!oldData || !oldData.data) return oldData;
          
          const updatedPlacaId = updatedPlaca.id || updatedPlaca._id;

          return {
              ...oldData,
              data: oldData.data
                  .filter(p => !!p) 
                  .map(p => {
                      const currentPlacaId = p.id || p._id;
                      return currentPlacaId === updatedPlacaId ? updatedPlaca : p;
                  }
              )
          };
      });
    },
    onError: (error) => {
      showToast(error.message || 'Erro ao atualizar status.', 'error');
    }
  });

  const reorderMutation = useMutation({
    mutationFn: (items) => reorderPlacas({
      items: items.map((item) => ({
        placaId: item.id || item._id,
        numeroOperacional: item.numeroOperacional,
      })),
    }),
    onSuccess: () => {
      setOrganizationFeedback('Nova numeração aplicada com sucesso.');
      setOrganizationError('');
      setIsOrganizationOpen(false);
      queryClient.invalidateQueries({ queryKey: ['placas'] });
      queryClient.invalidateQueries({ queryKey: ['placas-organizacao'] });
      showToast('Numeração visual atualizada com sucesso.', 'success');
    },
    onError: () => {
      const message = getFriendlyOrganizationError();
      setOrganizationError(message);
      showToast(message, 'error');
    },
  });

  const isLoading = isLoadingRegioes || isLoadingPlacas;

  const openOrganization = () => {
    if (!organizationSource.length) {
      setOrganizationFeedback('Não há placas cadastradas ainda.');
      return;
    }

    setOrganizationFeedback('');
    setOrganizationError('');
    setOrganizationBefore(organizationSource);
    setOrganizationDraft(organizationSource);
    setIsOrganizationOpen(true);
  };

  const handleAutoOrganization = () => {
    const preview = buildAutoOrganizationPreview(organizationDraft.length ? organizationDraft : organizationSource);
    setOrganizationBefore(preview.before);
    setOrganizationDraft(preview.after);
  };

  const handleOrganizationDragEnd = (event) => {
    const { active, over } = event;
    if (!active?.id) return;
    const next = applyDragMove(organizationDraft, String(active.id), over?.id ? String(over.id) : null);
    setOrganizationDraft(next);
  };

  const handleApplyOrganization = async () => {
    try {
      await showConfirmation({
        title: 'Confirmar Organização',
        message: 'Essa alteração reorganiza apenas a numeração visual das placas. O histórico, contratos e registros internos não serão alterados.',
        confirmText: 'Confirmar Organização',
        cancelText: 'Voltar',
        confirmButtonType: 'green',
      });
    } catch {
      return;
    }

    reorderMutation.mutate(organizationDraft);
  };

  const handleCancelOrganization = () => {
    setIsOrganizationOpen(false);
    setOrganizationDraft([]);
    setOrganizationBefore([]);
    setOrganizationError('');
  };

  // --- Efeito para pré-buscar próxima página ---
  useEffect(() => {
    if (!isPlaceholderData && pagination.totalPages > currentPage) {
      queryClient.prefetchQuery({
        queryKey: ['placas', filters, currentPage + 1],
        queryFn: async () => {
          const nextPage = currentPage + 1;
          const params = new URLSearchParams({ 
              page: nextPage, 
              limit: ITEMS_PER_PAGE,
              sortBy: 'createdAt',
              order: 'asc'
            });
          if (filters.regiao_id !== 'todas') params.append('regiaoId', filters.regiao_id);
          if (filters.search) params.append('search', filters.search);
          if (filters.disponibilidade === 'true') params.append('ativa', 'true');
          else if (filters.disponibilidade === 'false' || filters.disponibilidade === 'manutencao') params.append('ativa', 'false');
          if (import.meta.env.DEV) console.log(`Prefetching page ${nextPage}`);
          return await fetchPlacas(params);
        },
      });
    }
  }, [placasData, isPlaceholderData, currentPage, pagination.totalPages, queryClient, filters]);


  // --- Listener para 'search' do Header ---
  useEffect(() => {
    const handleSearch = (event) => {
      const searchTerm = event.detail.query || '';
      if (window.location.pathname === '/placas') {
        setFilters(prevFilters => ({ ...prevFilters, search: searchTerm }));
        setCurrentPage(1);
      }
    };
    document.addEventListener('search', handleSearch);
    return () => document.removeEventListener('search', handleSearch);
  }, []);

  // --- Handlers de Ações ---
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters(prevFilters => ({
        ...prevFilters,
        [name]: value
    }));
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleAddPlaca = () => navigate('/placas/novo');
  const handleEditPlaca = (placaId) => navigate(`/placas/editar/${placaId}`);

  const handleToggleDisponibilidade = (placaId, buttonElement) => {
      toggleMutation.mutate(placaId);
  };

  const handleDeletePlaca = async (placaId, buttonElement) => {
    const placaToDelete = placas.filter(p => !!p).find(p => String(p.id || p._id) === String(placaId));
    const numeroPlaca = placaToDelete?.numero_placa || `ID ${placaId}`;

    try {
      await showConfirmation({
        message: `Tem a certeza que deseja apagar a placa "${numeroPlaca}"?`,
        title: "Confirmar Exclusão",
        confirmButtonType: "red",
      });
      deleteMutation.mutate(placaId);
    } catch {
      // Cancelado
    }
  };


  // --- Renderização ---
  const renderPaginationButtons = () => {
      if (!pagination || pagination.totalPages <= 1) return null;
      const buttons = [];
      buttons.push( <button key="prev" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isPlaceholderData}> &laquo; Ant </button> );
      for (let i = 1; i <= pagination.totalPages; i++) { buttons.push( <button key={i} className={i === currentPage ? 'placas-page__pagination-button--active' : ''} onClick={() => handlePageChange(i)} disabled={i === currentPage || isPlaceholderData}> {i} </button> ); }
      buttons.push( <button key="next" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pagination.totalPages || isPlaceholderData}> Próx &raquo; </button> );
      return buttons.map(btn => React.cloneElement(btn, { className: `${btn.props.className || ''} placas-page__pagination-button` }));
   };


  return (
    <div className="placas-page">
      <div className="placas-page__controls">
        <div className="placas-page__filters">
          <select
            id="regiao-filter"
            name="regiao_id" 
            className="placas-page__filter-select"
            value={filters.regiao_id}
            onChange={handleFilterChange}
            disabled={isLoadingRegioes || isLoadingPlacas}
          >
            <option value="todas">Todas as Regiões</option>
            {regioes.map(r => <option key={r._id} value={r._id}>{r.nome}</option>)}
          </select>
          
          <select
            id="disponibilidade-filter"
            name="disponibilidade"
            className="placas-page__filter-select"
            value={filters.disponibilidade}
            onChange={handleFilterChange}
            disabled={isLoadingPlacas}
          >
            <option value="todos">Todos Status</option>
            <option value="true">Disponível</option>
            <option value="false">Ocupada</option>
            <option value="manutencao">Em Manutenção</option>
          </select>
        </div>
        {canCreatePlaca && <button
            id="add-placa-button"
            className="placas-page__add-button"
            onClick={handleAddPlaca}
            disabled={isLoadingPlacas}
        >
          <i className="fas fa-plus"></i> Adicionar Placa
        </button>}
      </div>

      {canEditPlaca && (
        <div className="placas-page__organization-status">
          {isLoadingOrganizationData && (
            <p>Carregando estado da numeração...</p>
          )}

          {!isLoadingOrganizationData && isErrorOrganizationData && (
            <p>Não foi possível verificar a sequência agora. Tente novamente.</p>
          )}

          {!isLoadingOrganizationData && !isErrorOrganizationData && organizationSource.length === 0 && (
            <p>Não há placas cadastradas ainda.</p>
          )}

          {!isLoadingOrganizationData && !isErrorOrganizationData && organizationSource.length > 0 && operationalGapInfo.gapCount === 0 && (
            <div className="placas-page__organization-card placas-page__organization-card--ok">
              <span>Sua sequência está organizada.</span>
              <button type="button" onClick={openOrganization}>Organizar placas</button>
            </div>
          )}

          {!isLoadingOrganizationData && !isErrorOrganizationData && operationalGapInfo.gapCount > 0 && (
            <div className="placas-page__organization-card placas-page__organization-card--warn">
              <span>Encontramos espaços vazios na numeração. Sua numeração possui {operationalGapInfo.gapCount} espaço vazio.</span>
              <button type="button" onClick={openOrganization}>Organizar Agora</button>
            </div>
          )}

          {organizationFeedback && <p className="placas-page__organization-feedback">{organizationFeedback}</p>}
          {organizationError && <p className="placas-page__organization-error">{organizationError}</p>}
        </div>
      )}

      {isOrganizationOpen && (
        <PlacaOrganizationPanel
          items={organizationDraft}
          beforeItems={organizationBefore}
          loading={isLoadingOrganizationData}
          saving={reorderMutation.isPending}
          onDragEnd={handleOrganizationDragEnd}
          onAutoOrganize={handleAutoOrganization}
          onApply={handleApplyOrganization}
          onCancel={handleCancelOrganization}
        />
      )}

      {/* Status Summary */}
      {!isLoadingPlacas && placas.length > 0 && (
        <div className="placas-page__status-summary">
          <div className="placas-page__status-item placas-page__status-item--disponivel">
            <i className="fas fa-check-circle"></i>
            <span className="placas-page__status-count">{statusCounts.disponiveis}</span>
            <span className="placas-page__status-label">Disponível{statusCounts.disponiveis !== 1 ? 'is' : ''}</span>
          </div>
          <div className="placas-page__status-item placas-page__status-item--alugada">
            <i className="fas fa-user-tie"></i>
            <span className="placas-page__status-count">{statusCounts.alugadas}</span>
            <span className="placas-page__status-label">Alugada{statusCounts.alugadas !== 1 ? 's' : ''}</span>
          </div>
          <div className="placas-page__status-item placas-page__status-item--reservada">
            <i className="fas fa-calendar-check"></i>
            <span className="placas-page__status-count">{statusCounts.reservadas}</span>
            <span className="placas-page__status-label">Reservada{statusCounts.reservadas !== 1 ? 's' : ''}</span>
          </div>
          <div className="placas-page__status-item placas-page__status-item--manutencao">
            <i className="fas fa-tools"></i>
            <span className="placas-page__status-count">{statusCounts.manutencao}</span>
            <span className="placas-page__status-label">Em Manutenção</span>
          </div>
        </div>
      )}

      <div id="placas-grid" className="placas-page__placas-grid">
        {isLoadingPlacas && placas.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => <PlacaCardSkeleton key={i} />)
        ) : isErrorPlacas ? (
          <div className="placas-page__error">Erro: {errorPlacas.message}</div>
        ) : placas.length > 0 ? (
          placas
            .filter(placa => !!placa) 
            .map((placa, index) => { 
                const placaId = placa.id || placa._id;
                if (!placaId) return null; 
                
                const sequentialNumber = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

                return (
                    <PlacaCard
                    key={placaId}
                    placa={placa}
                    sequentialNumber={sequentialNumber} 
                    onToggle={handleToggleDisponibilidade}
                    onEdit={handleEditPlaca}
                    onDelete={handleDeletePlaca}
                    canToggle={canTogglePlaca}
                    canEdit={canEditPlaca}
                    canDelete={canDeletePlaca}
                    isToggling={toggleMutation.isPending && toggleMutation.variables === placaId}
                    isDeleting={deleteMutation.isPending && deleteMutation.variables === placaId}
                    />
                );
            })
        ) : (
          (placas.filter(p => !!p).length === 0 && placasData?.pagination?.totalDocs > 0) ?
            <div className="placas-page__no-results">Problema ao carregar dados. Tente atualizar a página.</div> :
            <div className="placas-page__no-results">Nenhuma placa encontrada com os filtros atuais.</div>
        )}
      </div>

      <div id="pagination-container" className="placas-page__pagination">
        {!isLoadingPlacas && renderPaginationButtons()}
      </div>
    </div>
  );
}

export default PlacasPage;
