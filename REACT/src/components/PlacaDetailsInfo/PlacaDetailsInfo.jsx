// src/components/PlacaDetailsInfo/PlacaDetailsInfo.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { formatDate } from '../../utils/helpers';

function PlacaDetailsInfo({
  placa,
  imageUrl,
  placeholderUrl,
  statusText,
  statusClass,
}) {
  const {
    numero_placa,
    nomeDaRua,
    regiao,
    tamanho,
    coordenadas,
    cliente_nome,
    aluguel_data_inicio,
    aluguel_data_fim,
  } = placa;

  const nomeRegiao = regiao?.nome || 'N/A';
  const hasCommercialState = cliente_nome || aluguel_data_inicio || aluguel_data_fim;

  return (
    <>
      <div className="placa-details-page__image-container">
        <img
          src={imageUrl}
          alt={`Imagem da Placa ${numero_placa}`}
          className="placa-details-page__image"
          onError={(e) => { e.target.onerror = null; e.target.src = placeholderUrl; }}
        />
      </div>

      <div className="placa-details-page__info-container">
        <div className="placa-details-page__header">
          <h2 className="placa-details-page__numero">{numero_placa}</h2>
          <span className={`placa-details-page__status ${statusClass}`}>{statusText}</span>
        </div>

        <div className="placa-details-page__info-grid">
          <div className="placa-details-page__info-item">
            <span className="placa-details-page__info-label">Localizacao</span>
            <p className="placa-details-page__info-value">{nomeDaRua || 'N/A'}</p>
          </div>
          <div className="placa-details-page__info-item">
            <span className="placa-details-page__info-label">Regiao</span>
            <p className="placa-details-page__info-value">{nomeRegiao}</p>
          </div>
          <div className="placa-details-page__info-item">
            <span className="placa-details-page__info-label">Tamanho</span>
            <p className="placa-details-page__info-value">{tamanho || 'N/A'}</p>
          </div>
          <div className="placa-details-page__info-item">
            <span className="placa-details-page__info-label">Coordenadas</span>
            <p className="placa-details-page__info-value">{coordenadas || 'N/A'}</p>
          </div>

          {hasCommercialState && (
            <div className="placa-details-page__info-item placa-details-page__info-item--full">
              <span className="placa-details-page__info-label">Estado comercial atual</span>
              <p className="placa-details-page__info-value">
                {cliente_nome || 'Sem cliente derivado'}
                {aluguel_data_inicio && aluguel_data_fim
                  ? ` (${formatDate(aluguel_data_inicio)} - ${formatDate(aluguel_data_fim)})`
                  : ''}
              </p>
              <p className="placa-details-page__info-note">
                Contratos e clientes sao gerenciados em PI/Contratos.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

PlacaDetailsInfo.propTypes = {
  placa: PropTypes.shape({
    numero_placa: PropTypes.string,
    nomeDaRua: PropTypes.string,
    regiao: PropTypes.shape({ nome: PropTypes.string }),
    tamanho: PropTypes.string,
    coordenadas: PropTypes.string,
    cliente_nome: PropTypes.string,
    aluguel_data_inicio: PropTypes.string,
    aluguel_data_fim: PropTypes.string,
  }).isRequired,
  imageUrl: PropTypes.string.isRequired,
  placeholderUrl: PropTypes.string.isRequired,
  statusText: PropTypes.string.isRequired,
  statusClass: PropTypes.string.isRequired,
};

export default PlacaDetailsInfo;
