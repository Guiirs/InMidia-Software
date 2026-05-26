import React from 'react';

function MostRentedBoards({ data = [], loading }) {
  return (
    <section className="dashboard-section dashboard-card">
      <h3 className="dashboard-section__title">Placas mais alugadas</h3>
      {loading ? (
        <p className="dashboard-state dashboard-state--loading">A carregar ranking...</p>
      ) : data.length === 0 ? (
        <p className="dashboard-state dashboard-state--empty">Ainda não há contratos suficientes para gerar ranking.</p>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Localização</th>
                <th>Região</th>
                <th>Aluguéis/Contratos</th>
                <th>Receita</th>
                <th>Última locação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.placaId}>
                  <td>{item.placa}</td>
                  <td>{item.localizacao}</td>
                  <td>{item.regiao}</td>
                  <td>{item.quantidadeAlugueisContratos}</td>
                  <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.receitaGerada || 0)}</td>
                  <td>{item.ultimaLocacao ? new Date(item.ultimaLocacao).toLocaleDateString('pt-BR') : '-'}</td>
                  <td>
                    <span className={`status-pill status-pill--${item.statusAtual === 'ocupada' ? 'warning' : 'success'}`}>
                      {item.statusAtual}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default MostRentedBoards;
