// src/pages/Organizacao/MembersPage.jsx
import React, { useState } from 'react';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useTenant } from '../../context/TenantContext';
import Spinner from '../../components/Spinner/Spinner';
import {
  useOrganization,
  useOrganizationMembers,
  useUpdateMemberRole,
  useUpdateMemberStatus,
} from '../../hooks/useOrganization';
import './Organizacao.css';

const ROLES        = ['OWNER', 'ADMIN', 'VIEWER'];
const ROLE_LABEL   = { OWNER: 'Proprietário', ADMIN: 'Administrador', VIEWER: 'Visualizador' };
const STATUS_LABEL = { ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', REMOVED: 'Removido' };
const STATUS_CLS   = { ACTIVE: 'org-badge--active', SUSPENDED: 'org-badge--suspended', REMOVED: 'org-badge--removed' };

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export default function MembersPage() {
  const showToast        = useToast();
  const showConfirmation = useConfirmation();
  const { isOwner, membership: myMembership } = useTenant();

  const { data: org, isLoading: orgLoading }       = useOrganization();
  const { data: members, isLoading, isError, error } = useOrganizationMembers();

  const [editingRoleId, setEditingRoleId] = useState(null);
  const [selectedRole, setSelectedRole]   = useState('');

  const updateRole = useUpdateMemberRole({
    onSuccess: () => { showToast('Role atualizado com sucesso!', 'success'); setEditingRoleId(null); },
    onError:   (e) => showToast(e.message ?? 'Erro ao atualizar role.', 'error'),
  });

  const updateStatus = useUpdateMemberStatus({
    onSuccess: () => showToast('Status do membro atualizado.', 'success'),
    onError:   (e) => showToast(e.message ?? 'Erro ao atualizar status.', 'error'),
  });

  const handleRoleEdit = (member) => {
    setEditingRoleId(member._id ?? member.id);
    setSelectedRole(member.role);
  };

  const handleRoleSave = async (memberId) => {
    updateRole.mutate({ memberId, role: selectedRole });
  };

  const handleStatusChange = async (member, newStatus) => {
    const label = STATUS_LABEL[newStatus] ?? newStatus;
    try {
      await showConfirmation({
        title: `Alterar status para "${label}"?`,
        message: `Confirma a alteração do status do membro?`,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        confirmButtonType: newStatus === 'REMOVED' ? 'red' : 'blue',
      });
      updateStatus.mutate({ memberId: member._id ?? member.id, status: newStatus });
    } catch {
      // cancelado
    }
  };

  if (isLoading || orgLoading) {
    return (
      <div className="org-page">
        <Spinner message="Carregando membros..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="org-page">
        <div className="org-error">
          <i className="fas fa-exclamation-circle" />
          <p>{error?.message ?? 'Erro ao carregar membros.'}</p>
        </div>
      </div>
    );
  }

  const memberList = Array.isArray(members) ? members : [];

  return (
    <div className="org-page">
      <div className="org-header">
        <div>
          <h2 className="org-title">Membros da Organização</h2>
          {org && (
            <p className="org-subtitle">
              {org.name}
              {org.plan && <span className="org-plan-badge">{org.plan}</span>}
            </p>
          )}
        </div>
      </div>

      {memberList.length === 0 ? (
        <p className="org-empty">Nenhum membro encontrado.</p>
      ) : (
        <div className="org-table-wrapper">
          <table className="org-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Role</th>
                <th>Status</th>
                <th>Desde</th>
                {isOwner && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {memberList.map((m) => {
                const memberId = m._id ?? m.id;
                const isMe = memberId === (myMembership?._id ?? myMembership?.id);
                const isEditing = editingRoleId === memberId;

                return (
                  <tr key={memberId} className={isMe ? 'org-table__row--me' : ''}>
                    <td>
                      <div className="org-member-name">
                        {m.user?.name ?? m.user?.email ?? m.userId ?? '—'}
                      </div>
                      {m.user?.email && m.user?.name && (
                        <div className="org-member-email">{m.user.email}</div>
                      )}
                    </td>

                    <td>
                      {isOwner && isEditing ? (
                        <div className="org-inline-edit">
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="org-select"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                            ))}
                          </select>
                          <button
                            className="org-btn org-btn--primary"
                            onClick={() => handleRoleSave(memberId)}
                            disabled={updateRole.isPending}
                          >
                            Salvar
                          </button>
                          <button
                            className="org-btn org-btn--ghost"
                            onClick={() => setEditingRoleId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span className="org-role-text">{ROLE_LABEL[m.role] ?? m.role}</span>
                      )}
                    </td>

                    <td>
                      <span className={`org-badge ${STATUS_CLS[m.status] ?? ''}`}>
                        {STATUS_LABEL[m.status] ?? m.status ?? '—'}
                      </span>
                    </td>

                    <td className="org-date">{formatDate(m.joinedAt ?? m.createdAt)}</td>

                    {isOwner && (
                      <td>
                        <div className="org-actions">
                          {!isEditing && m.role !== 'OWNER' && (
                            <button
                              className="org-btn org-btn--ghost"
                              onClick={() => handleRoleEdit(m)}
                              title="Alterar role"
                            >
                              <i className="fas fa-user-edit" /> Role
                            </button>
                          )}

                          {m.status === 'ACTIVE' && m.role !== 'OWNER' && (
                            <button
                              className="org-btn org-btn--warn"
                              onClick={() => handleStatusChange(m, 'SUSPENDED')}
                              disabled={updateStatus.isPending}
                              title="Suspender membro"
                            >
                              <i className="fas fa-ban" /> Suspender
                            </button>
                          )}

                          {m.status === 'SUSPENDED' && (
                            <button
                              className="org-btn org-btn--primary"
                              onClick={() => handleStatusChange(m, 'ACTIVE')}
                              disabled={updateStatus.isPending}
                              title="Reativar membro"
                            >
                              <i className="fas fa-check" /> Reativar
                            </button>
                          )}

                          {m.role !== 'OWNER' && m.status !== 'REMOVED' && (
                            <button
                              className="org-btn org-btn--danger"
                              onClick={() => handleStatusChange(m, 'REMOVED')}
                              disabled={updateStatus.isPending}
                              title="Remover membro"
                            >
                              <i className="fas fa-user-times" /> Remover
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
