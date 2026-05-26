import React from 'react';
import { useClient, useClientTimeline } from '../../hooks/useClients';
import Spinner from '../../components/Spinner/Spinner';
import './ClientsPage.css';

const STATUS_LABEL = {
  ACTIVE:   { label: 'Ativo',      cls: 'client-status--active' },
  INACTIVE: { label: 'Inativo',    cls: 'client-status--inactive' },
  BLOCKED:  { label: 'Bloqueado',  cls: 'client-status--blocked' },
  ARCHIVED: { label: 'Arquivado',  cls: 'client-status--archived' },
};

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="client-detail__field">
      <span className="client-detail__field-label">{label}</span>
      <span className="client-detail__field-value">{value}</span>
    </div>
  );
}

function TimelineItem({ event }) {
  const icons = {
    created:  '✦',
    updated:  '✎',
    archived: '⬛',
    restored: '↩',
    contract: '📄',
    pi:       '📋',
  };

  return (
    <div className="client-timeline__item">
      <span className="client-timeline__icon">{icons[event.type] ?? '•'}</span>
      <div className="client-timeline__body">
        <span className="client-timeline__label">{event.label}</span>
        {event.detail && <span className="client-timeline__detail">{event.detail}</span>}
        <span className="client-timeline__time">
          {new Date(event.timestamp).toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  );
}

export default function ClientDetailsPanel({ clientId, onEdit, onArchive, onRestore, canManage }) {
  const { data: client, isLoading, isError } = useClient(clientId);
  const { data: timeline = [], isLoading: timelineLoading } = useClientTimeline(clientId);

  if (isLoading) return <div className="client-detail__loading"><Spinner message="Carregando..." /></div>;
  if (isError || !client) return <div className="client-detail__error">Erro ao carregar cliente.</div>;

  const status = STATUS_LABEL[client.status] ?? STATUS_LABEL.ACTIVE;
  const isArchived = client.status === 'ARCHIVED';

  return (
    <div className="client-detail">
      {/* Header */}
      <div className="client-detail__header">
        <div>
          <h2 className="client-detail__name">{client.nome}</h2>
          {client.nomeFantasia && (
            <p className="client-detail__fantasy">{client.nomeFantasia}</p>
          )}
          <span className={`client-status ${status.cls}`}>{status.label}</span>
        </div>
        {canManage && (
          <div className="client-detail__actions">
            {!isArchived && (
              <button className="client-detail__btn client-detail__btn--edit" onClick={() => onEdit(client)}>
                Editar
              </button>
            )}
            {!isArchived ? (
              <button className="client-detail__btn client-detail__btn--archive" onClick={() => onArchive(client._id)}>
                Arquivar
              </button>
            ) : (
              <button className="client-detail__btn client-detail__btn--restore" onClick={() => onRestore(client._id)}>
                Restaurar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cadastral data */}
      <section className="client-detail__section">
        <h3 className="client-detail__section-title">Dados Cadastrais</h3>
        <div className="client-detail__fields">
          <Field label="Tipo"         value={client.tipoPessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'} />
          <Field label="Documento"    value={client.documento} />
          <Field label="Responsável"  value={client.responsavel} />
          <Field label="Email"        value={client.email} />
          <Field label="Telefone"     value={client.telefone} />
          <Field label="WhatsApp"     value={client.whatsapp} />
          <Field label="Endereço"     value={client.endereco} />
          <Field label="Cidade"       value={client.cidade} />
          <Field label="Estado"       value={client.estado} />
        </div>
        {client.observacoes && (
          <div className="client-detail__obs">
            <span className="client-detail__field-label">Observações</span>
            <p>{client.observacoes}</p>
          </div>
        )}
        {client.tags?.length > 0 && (
          <div className="client-detail__tags">
            {client.tags.map((tag) => (
              <span key={tag} className="client-tag">{tag}</span>
            ))}
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="client-detail__section">
        <h3 className="client-detail__section-title">Histórico</h3>
        {timelineLoading ? (
          <Spinner message="Carregando..." />
        ) : timeline.length === 0 ? (
          <p className="client-detail__empty">Nenhum evento registrado.</p>
        ) : (
          <div className="client-timeline">
            {timeline.map((ev) => <TimelineItem key={ev.id} event={ev} />)}
          </div>
        )}
      </section>
    </div>
  );
}
