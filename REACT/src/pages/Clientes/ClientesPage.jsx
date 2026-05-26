import React, { useState } from 'react';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import Spinner from '../../components/Spinner/Spinner';
import ClientFormModal from './ClientFormModal';
import ClientDetailsPanel from './ClientDetailsPanel';
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useArchiveClient,
  useRestoreClient,
} from '../../hooks/useClients';
import './ClientsPage.css';

const STATUS_CONFIG = {
  ACTIVE:   { label: 'Ativo',      cls: 'client-status--active' },
  INACTIVE: { label: 'Inativo',    cls: 'client-status--inactive' },
  BLOCKED:  { label: 'Bloqueado',  cls: 'client-status--blocked' },
  ARCHIVED: { label: 'Arquivado',  cls: 'client-status--archived' },
};

const FILTER_STATUS = ['', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED'];

export default function ClientesPage() {
  const showToast       = useToast();
  const showConfirmation = useConfirmation();
  const { hasPermission } = useAuth();

  const canRead    = hasPermission(PERMISSIONS.CLIENTS_READ);
  const canCreate  = hasPermission(PERMISSIONS.CLIENTS_CREATE);
  const canUpdate  = hasPermission(PERMISSIONS.CLIENTS_UPDATE);
  const canArchive = hasPermission(PERMISSIONS.CLIENTS_ARCHIVE);
  const canManage  = canCreate || canUpdate || canArchive;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]       = useState(false);
  const [editingClient, setEditing]   = useState(null);
  const [selectedId, setSelectedId]   = useState(null);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage]               = useState(1);
  const [showArchived, setShowArchived] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const queryFilters = {
    page,
    limit: 20,
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(showArchived && !filterStatus ? { includeArchived: true } : {}),
    ...(search ? { q: search } : {}),
  };

  const { data, isLoading, isError, error } = useClients(queryFilters);
  const clients    = data?.data ?? [];
  const pagination = data?.pagination ?? { totalPages: 1, currentPage: 1 };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreateClient({
    onSuccess: () => { showToast('Cliente criado com sucesso!', 'success'); closeForm(); },
    onError:   (e) => showToast(e.response?.data?.error ?? 'Erro ao criar cliente.', 'error'),
  });

  const updateMutation = useUpdateClient({
    onSuccess: () => { showToast('Cliente atualizado!', 'success'); closeForm(); },
    onError:   (e) => showToast(e.response?.data?.error ?? 'Erro ao atualizar cliente.', 'error'),
  });

  const archiveMutation = useArchiveClient({
    onSuccess: () => { showToast('Cliente arquivado.', 'success'); setSelectedId(null); },
    onError:   (e) => showToast(e.response?.data?.error ?? 'Erro ao arquivar.', 'error'),
  });

  const restoreMutation = useRestoreClient({
    onSuccess: () => showToast('Cliente restaurado.', 'success'),
    onError:   (e) => showToast(e.response?.data?.error ?? 'Erro ao restaurar.', 'error'),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(client) { setEditing(client); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }

  function handleFormSubmit(data) {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient._id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  async function handleArchive(id) {
    const client = clients.find((c) => c._id === id);
    try {
      await showConfirmation({
        title:             'Arquivar cliente',
        message:           `Arquivar "${client?.nome}"? O cliente não aparecerá mais nas listagens padrão.`,
        confirmButtonType: 'red',
      });
      archiveMutation.mutate(id);
    } catch { /* cancelled */ }
  }

  async function handleRestore(id) {
    restoreMutation.mutate(id);
  }

  function handleSearch(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="clients-page">
      {/* Header */}
      <div className="clients-page__header">
        <div className="clients-page__header-left">
          <h1 className="clients-page__title">Clientes</h1>
          <span className="clients-page__count">
            {pagination.totalDocs !== undefined ? `${pagination.totalDocs} registros` : ''}
          </span>
        </div>
        {canCreate && (
          <button className="clients-page__add-btn" onClick={openCreate}>
            <i className="fas fa-plus" /> Novo Cliente
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="clients-page__filters">
        <div className="clients-page__search">
          <i className="fas fa-search clients-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome, documento, responsável..."
            value={search}
            onChange={handleSearch}
            className="clients-page__search-input"
          />
        </div>
        <select
          className="clients-page__filter-select"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
          <option value="BLOCKED">Bloqueado</option>
          <option value="ARCHIVED">Arquivado</option>
        </select>
        <label className="clients-page__archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
          />
          Incluir arquivados
        </label>
      </div>

      {/* Main layout: table + detail panel */}
      <div className={`clients-page__layout ${selectedId ? 'clients-page__layout--split' : ''}`}>

        {/* Table */}
        <div className="clients-page__table-area">
          {isLoading ? (
            <Spinner message="Carregando clientes..." />
          ) : isError ? (
            <div className="clients-page__error">Erro: {error?.message ?? 'Falha ao carregar.'}</div>
          ) : clients.length === 0 ? (
            <div className="clients-page__empty">
              <i className="fas fa-users" />
              <p>Nenhum cliente encontrado.</p>
              {canCreate && (
                <button className="clients-page__add-btn clients-page__add-btn--sm" onClick={openCreate}>
                  Criar primeiro cliente
                </button>
              )}
            </div>
          ) : (
            <div className="clients-page__table-wrapper">
              <table className="clients-page__table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Documento</th>
                    <th>Responsável</th>
                    <th>Telefone</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const st = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.ACTIVE;
                    const isActive = selectedId === client._id;
                    const isArchived = client.status === 'ARCHIVED';
                    return (
                      <tr
                        key={client._id}
                        className={isActive ? 'clients-page__row--selected' : ''}
                        onClick={() => setSelectedId(isActive ? null : client._id)}
                      >
                        <td>
                          <div className="clients-page__name-cell">
                            <span className="clients-page__name">{client.nome}</span>
                            {client.nomeFantasia && (
                              <span className="clients-page__fantasy">{client.nomeFantasia}</span>
                            )}
                          </div>
                        </td>
                        <td>{client.documento ?? '—'}</td>
                        <td>{client.responsavel ?? '—'}</td>
                        <td>{client.telefone ?? '—'}</td>
                        <td>
                          <span className={`client-status ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="clients-page__actions" onClick={(e) => e.stopPropagation()}>
                          {canUpdate && !isArchived && (
                            <button
                              className="clients-page__action-btn clients-page__action-btn--edit"
                              title="Editar"
                              onClick={() => openEdit(client)}
                            >
                              <i className="fas fa-pencil-alt" />
                            </button>
                          )}
                          {canArchive && !isArchived && (
                            <button
                              className="clients-page__action-btn clients-page__action-btn--archive"
                              title="Arquivar"
                              onClick={() => handleArchive(client._id)}
                              disabled={archiveMutation.isPending}
                            >
                              <i className="fas fa-archive" />
                            </button>
                          )}
                          {canArchive && isArchived && (
                            <button
                              className="clients-page__action-btn clients-page__action-btn--restore"
                              title="Restaurar"
                              onClick={() => handleRestore(client._id)}
                              disabled={restoreMutation.isPending}
                            >
                              <i className="fas fa-undo" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="clients-page__pagination">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="clients-page__page-btn"
                  >
                    ‹ Anterior
                  </button>
                  <span className="clients-page__page-info">
                    {page} / {pagination.totalPages}
                  </span>
                  <button
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="clients-page__page-btn"
                  >
                    Próximo ›
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <aside className="clients-page__detail-panel">
            <button
              className="clients-page__panel-close"
              onClick={() => setSelectedId(null)}
              title="Fechar painel"
            >
              ×
            </button>
            <ClientDetailsPanel
              clientId={selectedId}
              canManage={canManage}
              onEdit={openEdit}
              onArchive={handleArchive}
              onRestore={handleRestore}
            />
          </aside>
        )}
      </div>

      {/* Form modal */}
      <ClientFormModal
        isOpen={formOpen}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        initialData={editingClient}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
