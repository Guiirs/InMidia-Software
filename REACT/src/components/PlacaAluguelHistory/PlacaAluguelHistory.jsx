// src/components/PlacaAluguelHistory/PlacaAluguelHistory.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import Spinner from '../Spinner/Spinner';
import { formatDate } from '../../utils/helpers';
import { fetchAlugueisByPlaca } from '../../services';

const alugueisQueryKey = (placaId) => ['alugueis', placaId];

function PlacaAluguelHistory({ placaId }) {
  const {
    data: alugueis = [],
    isLoading: isLoadingAlugueis,
    isError: isErrorAlugueis,
    error: errorAlugueis,
  } = useQuery({
    queryKey: alugueisQueryKey(placaId),
    queryFn: () => fetchAlugueisByPlaca(placaId),
    enabled: !!placaId,
    placeholderData: [],
  });

  const renderTable = () => {
    if (isLoadingAlugueis) {
      return <Spinner message="A carregar historico..." />;
    }

    if (isErrorAlugueis) {
      return <p className="error-message">Erro ao carregar historico: {errorAlugueis.message}</p>;
    }

    if (alugueis.length === 0) {
      return <p>Nenhum aluguel encontrado para esta placa.</p>;
    }

    return (
      <table className="regioes-page__table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Inicio</th>
            <th>Fim</th>
          </tr>
        </thead>
        <tbody>
          {alugueis.map((a) => (
            <tr key={a.id}>
              <td>{a.cliente_nome || 'Cliente apagado'}</td>
              <td>{formatDate(a.data_inicio)}</td>
              <td>{formatDate(a.data_fim)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="placa-details-page__alugueis-container">
      <h3>Historico de alugueis</h3>
      <p className="placa-details-page__info-note">
        Contratos e clientes sao gerenciados em PI/Contratos.
      </p>
      <div id="alugueis-list">
        {renderTable()}
      </div>
    </div>
  );
}

PlacaAluguelHistory.propTypes = {
  placaId: PropTypes.string.isRequired,
};

export default PlacaAluguelHistory;
