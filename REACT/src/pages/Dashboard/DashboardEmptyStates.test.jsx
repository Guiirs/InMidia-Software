import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import MostRentedBoards from '../../components/dashboard/MostRentedBoards';
import IdleBoards from '../../components/dashboard/IdleBoards';
import RegionPerformanceTable from '../../components/dashboard/RegionPerformanceTable';
import SalesFunnelCards from '../../components/dashboard/SalesFunnelCards';
import SmartAlerts from '../../components/dashboard/SmartAlerts';

describe('Dashboard empty states', () => {
  it('mostra mensagem quando não há contratos para ranking', () => {
    const html = renderToString(<MostRentedBoards data={[]} loading={false} />);
    expect(html).toContain('Ainda não há contratos suficientes para gerar ranking.');
  });

  it('mostra mensagem quando não há placas paradas', () => {
    const html = renderToString(<IdleBoards data={[]} loading={false} />);
    expect(html).toContain('Nenhuma placa parada encontrada.');
  });

  it('mostra mensagem quando não há regiões para performance', () => {
    const html = renderToString(<RegionPerformanceTable data={[]} loading={false} />);
    expect(html).toContain('Cadastre mais placas para gerar insights por região.');
  });

  it('mostra mensagem quando não há propostas abertas no funil', () => {
    const html = renderToString(
      <SalesFunnelCards
        loading={false}
        data={{
          propostasCriadas: 0,
          propostasEmNegociacao: 0,
          propostasAprovadas: 0,
          propostasRecusadas: 0,
          contratosGerados: 0,
          taxaConversao: 0,
        }}
      />
    );

    expect(html).toContain('Sem propostas abertas no momento.');
  });

  it('não quebra com base pequena (poucos dados)', () => {
    const html = renderToString(
      <MostRentedBoards
        loading={false}
        data={[
          {
            placaId: 'placa-1',
            placa: 'INM-001',
            localizacao: 'Centro',
            regiao: 'Região 1',
            quantidadeAlugueisContratos: 1,
            receitaGerada: 1200,
            ultimaLocacao: null,
            statusAtual: 'disponivel',
          },
        ]}
      />
    );

    expect(html).toContain('Placas mais alugadas');
    expect(html).toContain('INM-001');
  });

  it('mantém seção oportunidades com vazio amigável', () => {
    const html = renderToString(<SmartAlerts data={[]} loading={false} />);
    expect(html).toContain('Oportunidades');
    expect(html).toContain('Sem alertas ativos.');
  });
});
