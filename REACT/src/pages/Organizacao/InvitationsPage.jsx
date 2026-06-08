// src/pages/Organizacao/InvitationsPage.jsx
import React, { useState } from 'react';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useTenant } from '../../context/TenantContext';
import Spinner from '../../components/Spinner/Spinner';
import {
  useOrganizationInvitations,
  useCreateInvitation,
} from '../../hooks/useOrganization';
import './Organizacao.css';

const isDev = import.meta.env.DEV;

const ROLES       = ['ADMIN', 'VIEWER'];
const ROLE_LABEL  = { OWNER: 'Proprietário', ADMIN: 'Administrador', VIEWER: 'Visualizador' };
const STATUS_CLS  = {
  PENDING:  'org-badge--pending',
  ACCEPTED: 'org-badge--active',
  EXPIRED:  'org-badge--removed',
  REVOKED:  'org-badge--suspended',
};
const STATUS_LABEL = {
  PENDING:  'Pendente',
  ACCEPTED: 'Aceito',
  EXPIRED:  'Expirado',
  REVOKED:  'Revogado',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export default function InvitationsPage() {
  const showToast = useToast();
  const { canInviteMembers } = useTenant();

  const { data: invitations, isLoading, isError, error } = useOrganizationInvitations();

  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState('VIEWER');
  const [formError, setFormError] = useState('');
  const [lastToken, setLastToken] = useState(null);

  const createInvitation = useCreateInvitation({
    onSuccess: (result) => {
      showToast(`Convite enviado para ${email}!`, 'success');
      setEmail('');
      setRole('VIEWER');
      setFormError('');
      if (result?.token) {
        setLastToken(result.token);
      }
    },
    onError: (e) => {
      const msg = e.message ?? 'Erro ao criar convite.';
      const isDuplicate =
        e.statusCode === 409 ||
        msg.toLowerCase().includes('já existe') ||
        msg.toLowerCase().includes('duplicado') ||
        msg.toLowerCase().includes('duplicate');
      setFormError(isDuplicate ? 'Já existe um convite pendente para este email.' : msg);
    },
  });

  const handleSubmit = (ev) => {
    ev.preventDefault();
    setFormError('');
    setLastToken(null);

    if (!email.trim()) { setFormError('Informe o email do convidado.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError('Email inválido.'); return; }

    createInvitation.mutate({ email: email.trim(), role });
  };

  if (isLoading) {
    return (
      <div className="org-page">
        <Spinner message="Carregando convites..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="org-page">
        <div className="org-error">
          <i className="fas fa-exclamation-circle" />
          <p>{error?.message ?? 'Erro ao carregar convites.'}</p>
        </div>
      </div>
    );
  }

  const inviteList = Array.isArray(invitations) ? invitations : [];

  return (
    <div className="org-page">
      <div className="org-header">
        <h2 className="org-title">Convites</h2>
      </div>

      {canInviteMembers && (
        <div className="org-card">
          <h3 className="org-card__title">Convidar membro</h3>
          <form onSubmit={handleSubmit} className="org-invite-form">
            <div className="org-invite-form__row">
              <input
                type="email"
                placeholder="Email do convidado"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="org-input"
                aria-label="Email do convidado"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="org-select"
                aria-label="Role do convidado"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <button
                type="submit"
                className="org-btn org-btn--primary"
                disabled={createInvitation.isPending}
              >
                {createInvitation.isPending ? 'Enviando...' : 'Convidar'}
              </button>
            </div>

            {formError && (
              <p className="org-form-error" role="alert">{formError}</p>
            )}
          </form>

          {lastToken && isDev && (
            <div className="org-token-box">
              <p className="org-token-box__warn">
                <i className="fas fa-info-circle" /> Token do convite (visível apenas em desenvolvimento — em produção deve ser enviado por email):
              </p>
              <code className="org-token-box__value"
                    onClick={() => { navigator.clipboard?.writeText(lastToken); showToast('Token copiado!', 'info'); }}
                    title="Clique para copiar"
              >
                {lastToken}
              </code>
            </div>
          )}
        </div>
      )}

      {inviteList.length === 0 ? (
        <p className="org-empty">Nenhum convite encontrado.</p>
      ) : (
        <div className="org-table-wrapper">
          <table className="org-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Expira em</th>
                <th>Convidado por</th>
              </tr>
            </thead>
            <tbody>
              {inviteList.map((inv) => {
                const invId = inv._id ?? inv.id;
                return (
                  <tr key={invId}>
                    <td>{inv.email}</td>
                    <td>{ROLE_LABEL[inv.role] ?? inv.role}</td>
                    <td>
                      <span className={`org-badge ${STATUS_CLS[inv.status] ?? ''}`}>
                        {STATUS_LABEL[inv.status] ?? inv.status ?? '—'}
                      </span>
                    </td>
                    <td className="org-date">{formatDate(inv.expiresAt)}</td>
                    <td>{inv.invitedByUserId ?? '—'}</td>
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
