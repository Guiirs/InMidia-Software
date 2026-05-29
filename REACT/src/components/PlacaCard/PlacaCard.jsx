// src/components/PlacaCard/PlacaCard.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl, formatDate } from '../../utils/helpers';
import './PlacaCard.css';

// ── Status resolver ───────────────────────────────────────────────────────────

function getStatusInfo(placa) {
  if (!placa) {
    return {
      statusText: 'Erro',
      statusClass: 'placa-card__badge--error',
      statusGroup: 'error',
      toggleButtonIcon: 'fa-exclamation-triangle',
      toggleButtonTitle: 'Erro',
      toggleButtonDisabled: true,
      toggleButtonDisabledTitle: 'Erro ao carregar placa',
    };
  }

  const disponivel = placa.disponivel ?? placa.ativa ?? true;
  const { cliente_nome, aluguel_data_inicio, aluguel_data_fim, aluguel_ativo, aluguel_futuro } = placa;
  const commercialStatus = placa.temporalStatus ?? placa.commercialStatus ?? placa.statusComercial;

  let statusText, statusClass, statusGroup;
  let toggleButtonDisabled = false;

  if (commercialStatus === 'CONTRACTED_ACTIVE' || commercialStatus === 'OCCUPIED') {
    statusText = 'Ocupada';
    statusClass = 'placa-card__badge--ocupada';
    statusGroup = 'ocupada';
    toggleButtonDisabled = true;
  } else if (commercialStatus === 'RESERVED' || commercialStatus === 'FUTURE_RESERVED') {
    statusText = 'Reservada';
    statusClass = 'placa-card__badge--reservada';
    statusGroup = 'reservada';
    toggleButtonDisabled = true;
  } else if (commercialStatus === 'MAINTENANCE') {
    statusText = 'ManutenÃ§Ã£o';
    statusClass = 'placa-card__badge--manutencao';
    statusGroup = 'manutencao';
  } else if (aluguel_ativo && cliente_nome && aluguel_data_inicio && aluguel_data_fim) {
    if (aluguel_futuro) {
      statusText = 'Reservada';
      statusClass = 'placa-card__badge--reservada';
      statusGroup = 'reservada';
    } else {
      statusText = 'Ocupada';
      statusClass = 'placa-card__badge--ocupada';
      statusGroup = 'ocupada';
    }
    toggleButtonDisabled = true;
  } else if (!disponivel) {
    statusText = 'Manutenção';
    statusClass = 'placa-card__badge--manutencao';
    statusGroup = 'manutencao';
  } else {
    statusText = 'Disponível';
    statusClass = 'placa-card__badge--disponivel';
    statusGroup = 'disponivel';
  }

  const toggleButtonIcon = disponivel ? 'fa-eye-slash' : 'fa-eye';
  const toggleButtonTitle = disponivel ? 'Colocar em Manutenção' : 'Tirar de Manutenção';
  const toggleButtonDisabledTitle = toggleButtonDisabled
    ? 'Não é possível alterar (placa alugada)'
    : toggleButtonTitle;

  return {
    statusText,
    statusClass,
    statusGroup,
    toggleButtonIcon,
    toggleButtonTitle,
    toggleButtonDisabled,
    toggleButtonDisabledTitle,
  };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function PlacaCardSkeleton() {
  return (
    <div className="placa-card placa-card--skeleton" aria-hidden="true">
      <div className="placa-card__banner placa-card__banner--skeleton" />
      <div className="placa-card__body">
        <div className="placa-card__header">
          <div className="placa-card__header-info">
            <div className="placa-skeleton placa-skeleton--title" />
            <div className="placa-skeleton placa-skeleton--subtitle" />
          </div>
          <div className="placa-skeleton placa-skeleton--badge" />
        </div>
        <div className="placa-skeleton placa-skeleton--location" />
        <div className="placa-card__footer">
          <div className="placa-skeleton placa-skeleton--regiao" />
          <div className="placa-skeleton placa-skeleton--actions" />
        </div>
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function PlacaCard({
  placa,
  sequentialNumber,
  onToggle,
  onEdit,
  onDelete,
  isToggling,
  isDeleting,
  canToggle = true,
  canEdit = true,
  canDelete = true,
}) {
  const navigate = useNavigate();

  const {
    statusText,
    statusClass,
    statusGroup,
    toggleButtonIcon,
    toggleButtonTitle,
    toggleButtonDisabled,
    toggleButtonDisabledTitle,
  } = useMemo(() => getStatusInfo(placa), [placa]);

  const { _id, id, numero_placa, nomeDaRua, imagem, regiao } = placa || {};
  const { cliente_nome, aluguel_data_inicio, aluguel_data_fim, aluguel_ativo } = placa || {};
  const disponivel = placa?.disponivel ?? placa?.ativa ?? true;
  const placaId = id || _id;

  const placeholderUrl = '/assets/img/placeholder.png';
  const imageUrl = getImageUrl(imagem, placeholderUrl);
  const nomeRegiao = typeof regiao === 'object' && regiao?.nome ? regiao.nome : regiao || 'Sem região';
  const formattedNumber = String(sequentialNumber).padStart(2, '0');
  const displayStreet = nomeDaRua || 'Endereço não informado';
  const displayCode = numero_placa || 'N/A';

  const isRented = aluguel_ativo && cliente_nome && aluguel_data_inicio && aluguel_data_fim;

  const handleCardClick = (e) => {
    if (!e.target.closest('button') && placaId) navigate(`/placas/${placaId}`);
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    if (onToggle && placaId) onToggle(placaId, e.currentTarget);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit && placaId) onEdit(placaId);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete && placaId) onDelete(placaId, e.currentTarget);
  };

  if (!placaId) return null;

  return (
    <article
      className={`placa-card placa-card--${statusGroup}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick(e)}
      aria-label={`Placa ${formattedNumber} — ${statusText}`}
    >
      <header className="placa-card__banner">
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="placa-card__banner-img"
          onError={(e) => { e.target.onerror = null; e.target.src = placeholderUrl; }}
        />
        <div className="placa-card__banner-overlay" />
        <div className="placa-card__media-top">
          <span className="placa-card__counter">#{formattedNumber}</span>
          <span className={`placa-card__badge ${statusClass}`}>{statusText}</span>
        </div>
        <div className="placa-card__media-bottom">
          <p className="placa-card__media-eyebrow">Ativo operacional</p>
          <h3 className="placa-card__media-title">{displayCode}</h3>
        </div>
      </header>

      <div className="placa-card__body">

        <div className="placa-card__header">
          <div className="placa-card__header-info">
            <h3 className="placa-card__numero">Placa {formattedNumber}</h3>
            <span className="placa-card__codigo">Código {displayCode}</span>
          </div>

          <div className="placa-card__actions">
            {canToggle && <button
              className={`placa-card__action placa-card__action--toggle placa-card__action--${disponivel ? 'disponivel' : 'indisponivel'}`}
              title={toggleButtonDisabledTitle}
              aria-label={toggleButtonDisabledTitle}
              disabled={toggleButtonDisabled || isToggling}
              onClick={handleToggleClick}
            >
              {isToggling
                ? <i className="fas fa-spinner fa-spin" />
                : <i className={`fas ${toggleButtonIcon}`} />}
            </button>}
            {canEdit && <button
              className="placa-card__action placa-card__action--edit"
              title="Editar placa"
              aria-label="Editar Placa"
              onClick={handleEditClick}
              disabled={isToggling || isDeleting}
            >
              <i className="fas fa-pencil-alt" />
            </button>}
            {canDelete && <button
              className="placa-card__action placa-card__action--delete"
              title="Apagar placa"
              aria-label="Apagar Placa"
              onClick={handleDeleteClick}
              disabled={isToggling || isDeleting}
            >
              {isDeleting
                ? <i className="fas fa-spinner fa-spin" />
                : <i className="fas fa-trash" />}
            </button>}
          </div>
        </div>

        <div className="placa-card__location">
          <i className="fas fa-map-marker-alt placa-card__location-icon" aria-hidden="true" />
          <span className="placa-card__location-text">{displayStreet}</span>
        </div>

        {isRented && (
          <div className="placa-card__rental">
            <div className="placa-card__rental-client">
              <i className="fas fa-building" aria-hidden="true" />
              <span>{cliente_nome}</span>
            </div>
            <div className="placa-card__rental-dates">
              <span className="placa-card__rental-date">
                <i className="fas fa-calendar-check" aria-hidden="true" />
                {formatDate(aluguel_data_inicio)}
              </span>
              <span className="placa-card__rental-sep" aria-hidden="true">→</span>
              <span className="placa-card__rental-date">
                <i className="fas fa-calendar-times" aria-hidden="true" />
                {formatDate(aluguel_data_fim)}
              </span>
            </div>
          </div>
        )}

        <div className="placa-card__footer">
          <div className="placa-card__footer-meta">
            <i className="fas fa-layer-group" aria-hidden="true" />
            <span className="placa-card__regiao">{nomeRegiao}</span>
          </div>
          <span className="placa-card__sync-dot" title="Dados em tempo real" aria-hidden="true" />
        </div>

      </div>
    </article>
  );
}

export default PlacaCard;
