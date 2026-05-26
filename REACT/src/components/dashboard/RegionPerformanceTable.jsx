import React from 'react';

function RegionPerformanceTable({ data = [], loading }) {
  return (
    <section className="dashboard-section dashboard-card">
      <h3 className="dashboard-section__title">Regiões com melhor desempenho</h3>
      {loading ? (
        <p className="dashboard-state dashboard-state--loading">A carregar performance regional...</p>
      ) : data.length === 0 ? (
        <p className="dashboard-state dashboard-state--empty">Cadastre mais placas para gerar insights por região.</p>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Região</th>
                <th>Total placas</th>
                <th>Alugadas</th>
                <th>Taxa ocupação</th>
                <th>Receita estimada</th>
                <th>Propostas abertas</th>
                <th>Contratos ativos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.regiaoId}>
                  <td>{item.regiao}</td>
                  <td>{item.totalPlacas}</td>
                  <td>{item.placasAlugadas}</td>
                  <td>{item.taxaOcupacao.toFixed(2)}%</td>
                  <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.receitaEstimada || 0)}</td>
                  <td>{item.propostasAbertas}</td>
                  <td>{item.contratosAtivos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RegionPerformanceTable;
