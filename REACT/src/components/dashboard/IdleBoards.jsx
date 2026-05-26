import React from 'react';

function IdleBoards({ data = [], loading }) {
  return (
    <section className="dashboard-section dashboard-card">
      <h3 className="dashboard-section__title">Placas paradas</h3>
      {loading ? (
        <p className="dashboard-state dashboard-state--loading">A carregar placas paradas...</p>
      ) : data.length === 0 ? (
        <p className="dashboard-state dashboard-state--empty">Nenhuma placa parada encontrada.</p>
      ) : (
        <ul className="dashboard-list">
          {data.slice(0, 8).map((item) => (
            <li key={item.placaId} className="dashboard-list__item">
              <div>
                <strong>{item.placa}</strong> · {item.regiao}
                <p>
                  {item.nuncaAlugada
                    ? 'Nunca alugada'
                    : `${item.diasSemAluguel ?? 0} dias sem aluguel`} · taxa {item.taxaOcupacao.toFixed(1)}%
                </p>
              </div>
              <p className="dashboard-list__hint">{item.sugestaoAcao}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default IdleBoards;
