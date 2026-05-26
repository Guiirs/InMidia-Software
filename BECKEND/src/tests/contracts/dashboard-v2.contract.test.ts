import {
  DashboardOverviewSchema,
  MostRentedBoardSchema,
  IdleBoardSchema,
  RegionPerformanceSchema,
  SalesFunnelSchema,
  DashboardAlertSchema,
} from '@modules/dashboard/dashboard.types';

describe('DashboardContract V2: canonical dashboard contracts', () => {
  it('DashboardOverview possui shape canônico', () => {
    const payload = {
      totalPlacas: 10,
      placasDisponiveis: 4,
      placasAlugadasOcupadas: 6,
      taxaOcupacao: 60,
      propostasEmAberto: 3,
      contratosAtivos: 2,
      receitaEstimadaMensal: 5500,
      regioesAtivas: 5,
    };

    const result = DashboardOverviewSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('MostRentedBoard possui shape canônico', () => {
    const payload = {
      placaId: 'abc',
      placa: 'PL-001',
      localizacao: 'Centro',
      regiao: 'Norte',
      quantidadeAlugueisContratos: 8,
      receitaGerada: 12000,
      ultimaLocacao: new Date().toISOString(),
      statusAtual: 'ocupada',
    };

    const result = MostRentedBoardSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('IdleBoard possui shape canônico', () => {
    const payload = {
      placaId: 'abc',
      placa: 'PL-002',
      diasSemAluguel: 90,
      nuncaAlugada: false,
      baixaTaxaOcupacao: true,
      taxaOcupacao: 10,
      regiao: 'Sul',
      status: 'disponivel',
      sugestaoAcao: 'Acionar comercial',
    };

    const result = IdleBoardSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('RegionPerformance possui shape canônico', () => {
    const payload = {
      regiaoId: 'reg-1',
      regiao: 'Norte',
      totalPlacas: 20,
      placasAlugadas: 15,
      taxaOcupacao: 75,
      receitaEstimada: 30000,
      propostasAbertas: 5,
      contratosAtivos: 4,
    };

    const result = RegionPerformanceSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('SalesFunnel possui shape canônico', () => {
    const payload = {
      propostasCriadas: 20,
      propostasEmNegociacao: 6,
      propostasAprovadas: 8,
      propostasRecusadas: 4,
      contratosGerados: 7,
      taxaConversao: 35,
    };

    const result = SalesFunnelSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('DashboardAlert possui severidade e ação sugerida', () => {
    const payload = {
      id: 'a1',
      tipo: 'idle-board',
      titulo: 'Placa parada',
      descricao: 'Sem locação há 120 dias',
      severidade: 'critical',
      acaoSugerida: 'Revisar preço',
      meta: { placaId: 'xyz' },
    };

    const result = DashboardAlertSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
