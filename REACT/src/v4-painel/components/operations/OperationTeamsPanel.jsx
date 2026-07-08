import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../../context/AuthContext.jsx';
import { useSyncResource } from '../../../core/sync-core/hooks/useSyncResource.js';
import { useSyncMutation } from '../../../core/sync-core/hooks/useSyncMutation.js';
import { V4Button, V4Card, V4EmptyState, V4Skeleton } from '../ui/index.js';
import { getOperationErrorPresentation } from '../../utils/operationErrorMessages.js';
import ConfirmationModal from '../../../components/ConfirmationModal/ConfirmationModal.jsx';
import './OperationTeamsPanel.css';

function emptyMember() {
  return { name: '', role: '', phone: '', active: true };
}

function emptyForm() {
  return { id: null, name: '', notes: '', members: [emptyMember()] };
}

function teamToForm(team) {
  const members = (team.members ?? []).map((member) => ({
    name: member.name ?? '',
    role: member.role ?? '',
    phone: member.phone ?? '',
    active: member.active !== false,
  }));
  return {
    id: team.id,
    name: team.name ?? '',
    notes: team.notes ?? '',
    members: members.length > 0 ? members : [emptyMember()],
  };
}

function activeMemberCount(members) {
  return members.filter((member) => member.active && member.name.trim()).length;
}

function TeamForm({ initial, onCancel, onSave, saving, serverError }) {
  const [form, setForm] = useState(initial);
  const [validationError, setValidationError] = useState(null);

  function updateMember(index, patch) {
    setForm((prev) => ({
      ...prev,
      members: prev.members.map((member, i) => (i === index ? { ...member, ...patch } : member)),
    }));
  }

  function addMember() {
    setForm((prev) => ({ ...prev, members: [...prev.members, emptyMember()] }));
  }

  function removeMember(index) {
    setForm((prev) => ({ ...prev, members: prev.members.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setValidationError('Informe o nome da equipe.');
      return;
    }
    setValidationError(null);

    const members = form.members
      .map((member) => ({ ...member, name: member.name.trim() }))
      .filter((member) => member.name)
      .map((member) => ({
        name: member.name,
        active: member.active,
        ...(member.role.trim() ? { role: member.role.trim() } : {}),
        ...(member.phone.trim() ? { phone: member.phone.trim() } : {}),
      }));

    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name,
      members,
      notes: form.notes.trim(),
    };

    await onSave(payload);
  }

  const memberCount = activeMemberCount(form.members);
  const bannerMessage = validationError ?? serverError?.message ?? null;
  const nameFieldError = serverError?.field === 'name' ? (serverError.fieldMessage ?? serverError.message) : null;

  return (
    <form className="v4p-teams-form" onSubmit={handleSubmit} noValidate data-testid="operation-team-form">
      <h3 className="v4p-teams-form__title">{form.id ? 'Editar equipe' : 'Nova equipe'}</h3>

      {bannerMessage && (
        <div className="v4p-teams-form__banner" role="alert" data-testid="operation-team-form-error">
          {bannerMessage}
        </div>
      )}

      <div className="v4p-teams-form__field">
        <label htmlFor="operation-team-name">Nome da equipe *</label>
        <input
          id="operation-team-name"
          type="text"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Ex.: Equipe Instalação Norte"
        />
        {nameFieldError && <span className="v4p-teams-form__field-error" role="alert">{nameFieldError}</span>}
      </div>

      <div className="v4p-teams-form__members">
        <div className="v4p-teams-form__members-header">
          <span>Integrantes</span>
          <span className="v4p-teams-form__member-count" data-testid="operation-team-member-count">
            {memberCount} {memberCount === 1 ? 'integrante ativo' : 'integrantes ativos'}
          </span>
        </div>

        {form.members.map((member, index) => (
          <div className="v4p-teams-form__member-row" key={index}>
            <input
              type="text"
              value={member.name}
              onChange={(event) => updateMember(index, { name: event.target.value })}
              placeholder="Nome"
              aria-label={`Nome do integrante ${index + 1}`}
            />
            <input
              type="text"
              value={member.role}
              onChange={(event) => updateMember(index, { role: event.target.value })}
              placeholder="Função (opcional)"
              aria-label={`Função do integrante ${index + 1}`}
            />
            <input
              type="text"
              value={member.phone}
              onChange={(event) => updateMember(index, { phone: event.target.value })}
              placeholder="Telefone (opcional)"
              aria-label={`Telefone do integrante ${index + 1}`}
            />
            <label className="v4p-teams-form__member-active">
              <input
                type="checkbox"
                checked={member.active}
                onChange={(event) => updateMember(index, { active: event.target.checked })}
              />
              Ativo
            </label>
            <button
              type="button"
              className="v4p-teams-form__member-remove"
              onClick={() => removeMember(index)}
              aria-label={`Remover integrante ${index + 1}`}
            >
              <span className="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
          </div>
        ))}

        <button type="button" className="v4p-teams-form__add-member" onClick={addMember}>
          <span className="material-symbols-rounded" aria-hidden="true">add</span>
          Adicionar integrante
        </button>
      </div>

      <div className="v4p-teams-form__field">
        <label htmlFor="operation-team-notes">Observações</label>
        <textarea
          id="operation-team-notes"
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          rows={3}
          placeholder="Observações sobre a equipe (opcional)"
        />
      </div>

      <div className="v4p-teams-form__actions">
        <button type="button" className="v4p-teams-form__btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="v4p-teams-form__btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar equipe'}
        </button>
      </div>
    </form>
  );
}

function TeamRow({ team, onEdit, onArchive, canEdit, archiving }) {
  const members = team.members ?? [];
  const activeMembers = members.filter((member) => member.active !== false);
  const preview = activeMembers.slice(0, 3).map((member) => member.name).join(', ');
  const extra = activeMembers.length > 3 ? ` +${activeMembers.length - 3}` : '';
  const isArchived = team.status === 'ARCHIVED';

  return (
    <div className="v4p-teams-row" data-testid="operation-team-row">
      <div className="v4p-teams-row__main">
        <strong className="v4p-teams-row__name">{team.name}</strong>
        <span className={`v4p-teams-row__status v4p-teams-row__status--${isArchived ? 'archived' : 'active'}`}>
          {isArchived ? 'Arquivada' : 'Ativa'}
        </span>
      </div>
      <div className="v4p-teams-row__meta">
        <span className="v4p-teams-row__count">
          {team.memberCount} {team.memberCount === 1 ? 'integrante' : 'integrantes'}
        </span>
        {preview && <span className="v4p-teams-row__members">{preview}{extra}</span>}
      </div>
      {canEdit && (
        <div className="v4p-teams-row__actions">
          <button type="button" onClick={() => onEdit(team)}>
            <span className="material-symbols-rounded" aria-hidden="true">edit</span>
            Editar
          </button>
          {!isArchived && (
            <button type="button" onClick={() => onArchive(team)} disabled={archiving}>
              <span className="material-symbols-rounded" aria-hidden="true">archive</span>
              {archiving ? '…' : 'Arquivar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OperationTeamsPanel({ newTeamSignal = 0 }) {
  const auth = useAuth();
  const canCreate = auth?.hasPermission?.('operations.create') ?? false;
  const canUpdate = auth?.hasPermission?.('operations.update') ?? false;

  const teamsResource = useSyncResource('operations.teams');
  const createMutation = useSyncMutation('operations.team.create');
  const updateMutation = useSyncMutation('operations.team.update');
  const archiveMutation = useSyncMutation('operations.team.archive');

  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [editingTeam, setEditingTeam] = useState(undefined);
  const [formError, setFormError] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null);

  const teams = Array.isArray(teamsResource.data) ? teamsResource.data : [];
  const filteredTeams = useMemo(
    () => teams.filter((team) => (team.status ?? 'ACTIVE') === statusFilter),
    [teams, statusFilter],
  );

  const handleNew = useCallback(() => {
    setFormError(null);
    setEditingTeam(null);
  }, []);

  useEffect(() => {
    if (newTeamSignal > 0 && canCreate) {
      handleNew();
    }
  }, [newTeamSignal, canCreate, handleNew]);

  const handleEdit = useCallback((team) => {
    setFormError(null);
    setEditingTeam(team);
  }, []);

  const handleCancelForm = useCallback(() => {
    setEditingTeam(undefined);
    setFormError(null);
  }, []);

  const handleSave = useCallback(async (payload) => {
    setFormError(null);
    try {
      if (payload.id) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      setEditingTeam(undefined);
      teamsResource.refresh({ reason: 'operation-team-saved' });
    } catch (err) {
      console.error('[OperationTeamsPanel] Erro ao salvar equipe:', err);
      setFormError(getOperationErrorPresentation(err));
    }
  }, [createMutation, updateMutation, teamsResource]);

  const handleArchive = useCallback((team) => {
    setArchiveConfirm(team);
  }, []);

  const handleConfirmArchive = useCallback(async () => {
    const team = archiveConfirm;
    setArchiveConfirm(null);
    if (!team) return;
    setActionError(null);
    setArchivingId(team.id);
    try {
      await archiveMutation.mutateAsync({ id: team.id });
      teamsResource.refresh({ reason: 'operation-team-archived' });
    } catch (err) {
      console.error('[OperationTeamsPanel] Erro ao arquivar equipe:', err);
      setActionError(getOperationErrorPresentation(err).message);
    } finally {
      setArchivingId(null);
    }
  }, [archiveConfirm, archiveMutation, teamsResource]);

  const isLoading = teamsResource.status === 'idle' || teamsResource.status === 'loading';
  const isSaving = createMutation.isLoading || updateMutation.isLoading;
  const canManage = canCreate || canUpdate;

  return (
    <>
    <V4Card
      className="v4p-teams-panel"
      title="Equipes operacionais"
      subtitle="Cadastre equipes de campo e vincule-as às operações."
      actions={canCreate && editingTeam === undefined ? (
        <V4Button variant="primary" size="sm" onClick={handleNew} data-testid="operation-team-new-btn">
          <span className="material-symbols-rounded" aria-hidden="true">add</span>
          Nova equipe
        </V4Button>
      ) : null}
    >
      {editingTeam !== undefined && canManage && (
        <TeamForm
          initial={editingTeam === null ? emptyForm() : teamToForm(editingTeam)}
          onCancel={handleCancelForm}
          onSave={handleSave}
          saving={isSaving}
          serverError={formError}
        />
      )}

      <div className="v4p-teams-filters" role="tablist" aria-label="Filtro de status de equipes">
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'ACTIVE'}
          className={`v4p-teams-filter${statusFilter === 'ACTIVE' ? ' is-active' : ''}`}
          onClick={() => setStatusFilter('ACTIVE')}
        >
          Ativas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'ARCHIVED'}
          className={`v4p-teams-filter${statusFilter === 'ARCHIVED' ? ' is-active' : ''}`}
          onClick={() => setStatusFilter('ARCHIVED')}
        >
          Arquivadas
        </button>
      </div>

      {actionError && <p className="v4p-teams-panel__error" role="alert">{actionError}</p>}

      {isLoading ? (
        <V4Skeleton variant="table" rows={3} />
      ) : filteredTeams.length === 0 ? (
        <V4EmptyState
          icon={<span className="material-symbols-rounded" aria-hidden="true">groups</span>}
          title={statusFilter === 'ACTIVE' ? 'Nenhuma equipe cadastrada' : 'Nenhuma equipe arquivada'}
          description={statusFilter === 'ACTIVE'
            ? 'Cadastre equipes de campo para vincular às operações.'
            : 'Equipes arquivadas aparecerão aqui.'}
          compact
        />
      ) : (
        <div className="v4p-teams-list" data-testid="operation-team-list">
          {filteredTeams.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              onEdit={handleEdit}
              onArchive={handleArchive}
              canEdit={canUpdate}
              archiving={archivingId === team.id}
            />
          ))}
        </div>
      )}
    </V4Card>

      <ConfirmationModal
        isOpen={Boolean(archiveConfirm)}
        title="Arquivar equipe"
        message={archiveConfirm ? `Arquivar a equipe "${archiveConfirm.name}"? Equipes arquivadas não podem ser selecionadas em novas operações.` : ''}
        confirmText="Confirmar arquivamento"
        onConfirm={handleConfirmArchive}
        onClose={() => setArchiveConfirm(null)}
        closeOnBackdrop={false}
        data-testid="archive-team-confirm-modal"
      />
    </>
  );
}

export default memo(OperationTeamsPanel);
