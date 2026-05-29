// src/components/PlacaCard/PlacaCard.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl, formatDate } from '../../utils/helpers';
import { PLACA_STATUS, resolvePlacaStatus } from '../../utils/statusMap';
import './PlacaCard.css';

// ── Constantes ────────────────────────────────────────────────────────────────

const LOCKED_STATUSES = new Set(['ocupada', 'reservada']);
const OCCUPANCY_STATUSES = new Set(['ocupada', 'reservada']);

// ── Status resolver ───────────────────────────────────────────────────────────

function getStatusInfo(placa) {
  if (!placa) {
    return {
      statusText: PLACA_STATUS.erro.label,
      statusClass: 'placa-card__badge--erro',
      statusGroup: 'erro',
      toggleButtonIcon: 'fa-exclamation-triangle',
      toggleButtonTitle: 'Erro',
      toggleButtonDisabled: true,
      toggleButtonDisabledTitle: 'Erro ao carregar placa',
    };
  }

  const key = resolvePlacaStatus(placa);
  const { label } = PLACA_STATUS[key] ?? PLACA_STATUS.erro;
  const disponivel = placa.disponivel ?? placa.ativa ?? true;
  const toggleButtonDisabled = LOCKED_STATUSES.has(key);

  const toggleButtonIcon = disponivel ? 'fa-eye-slash' : 'fa-eye';
  const toggleButtonTitle = disponivel ? 'Colocar em Manutenção' : 'Tirar de Manutenção';
  const toggleButtonDisabledTitle = toggleButtonDisabled
    ? 'Não é possível alterar (placa alugada)'
    : toggleButtonTitle;

  return {
    statusText: label,
    statusClass: `placa-card__badge--${key}`,
    statusGroup: key,
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
        <div className="placa-card__identity">
          <div className="placa-card__identity-main">
            <div className="placa-skeleton placa-skeleton--code" />
            <div className="placa-skeleton placa-skeleton--seq" />
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
  const { cliente_nome, aluguel_data_inicio, aluguel_data_fim } = placa || {};
  const disponivel = placa?.disponivel ?? placa?.ativa ?? true;
  const placaId = id || _id;

  const placeholderUrl = '/assets/img/placeholder.png';
  const imageUrl = getImageUrl(imagem, placeholderUrl);
  const nomeRegiao = typeof regiao === 'object' && regiao?.nome ? regiao.nome : regiao || 'Sem região';
  const formattedNumber = String(sequentialNumber).padStart(2, '0');
  const displayStreet = nomeDaRua || 'Endereço não informado';
  const displayCode = numero_placa || 'N/A';

  // Bloco de ocupação: apenas quando status indica ocupação E há nome de cliente
  const showOccupancy = OCCUPANCY_STATUSES.has(statusGroup) && !!cliente_nome;
  const hasDates = aluguel_data_inicio || aluguel_data_fim;

  const handleCardClick = (e) => {
    if (!e.target.closest('button') && placaId) navigate(`/placas/${placaId}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(e);
    }
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
      onKeyDown={handleKeyDown}
      aria-label={`${displayCode} — ${statusText}`}
    >

      {/* Banner: imagem de fundo sem texto. aria-hidden — identificação está no corpo. */}
      <div className="placa-card__banner" aria-hidden="true">
        <img
          src={imageUrl}
          alt=""
          className="placa-card__banner-img"
          onError={(e) => { e.target.onerror = null; e.target.src = placeholderUrl; }}
        />
        <div className="placa-card__banner-overlay" />
      </div>

      <div className="placa-card__body">

        {/* Identidade: código único + número sequencial + badge de status */}
        <div className="placa-card__identity">
          <div className="placa-card__identity-main">
            <h3 className="placa-card__code">{displayCode}</h3>
            <span className="placa-card__seq" aria-hidden="true">#{formattedNumber}</span>
          </div>
          <span
            className={`placa-card__badge ${statusClass}`}
            role="status"
            aria-label={`Status: ${statusText}`}
          >
            {statusText}
          </span>
        </div>

        {/* Localização: informação principal do card */}
        <div className="placa-card__location">
          <i className="fas fa-map-marker-alt placa-card__location-icon" aria-hidden="true" />
          <span className="placa-card__location-text">{displayStreet}</span>
        </div>

        {/* Ocupação/Reserva: só aparece quando há cliente no status ativo */}
        {showOccupancy && (
          <div className="placa-card__rental">
            <div className="placa-card__rental-client">
              <i className="fas fa-building" aria-hidden="true" />
              <span>{cliente_nome}</span>
            </div>
            {hasDates && (
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
            )}
          </div>
        )}

        {/* Footer: região + ações */}
        <div className="placa-card__footer">
          <div className="placa-card__footer-meta">
            <i className="fas fa-layer-group" aria-hidden="true" />
            <span className="placa-card__regiao">{nomeRegiao}</span>
          </div>

          <div className="placa-card__actions" role="group" aria-label="Ações da placa">
            {canToggle && (
              <button
                className={`placa-card__action placa-card__action--toggle placa-card__action--${disponivel ? 'disponivel' : 'indisponivel'}`}
                title={toggleButtonDisabledTitle}
                aria-label={toggleButtonDisabledTitle}
                disabled={toggleButtonDisabled || isToggling}
                onClick={handleToggleClick}
              >
                {isToggling
                  ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                  : <i className={`fas ${toggleButtonIcon}`} aria-hidden="true" />}
              </button>
            )}
            {canEdit && (
              <button
                className="placa-card__action placa-card__action--edit"
                title="Editar placa"
                aria-label="Editar placa"
                disabled={isToggling || isDeleting}
                onClick={handleEditClick}
              >
                <i className="fas fa-pencil-alt" aria-hidden="true" />
              </button>
            )}
            {canDelete && (
              <button
                className="placa-card__action placa-card__action--delete"
                title="Apagar placa"
                aria-label="Apagar placa"
                disabled={isToggling || isDeleting}
                onClick={handleDeleteClick}
              >
                {isDeleting
                  ? <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                  : <i className="fas fa-trash" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>

      </div>
    </article>
  );
}

export default PlacaCard;
