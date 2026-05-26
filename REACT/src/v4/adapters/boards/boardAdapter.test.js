import {
  formatBoardPeriod,
  formatBoardPrice,
  getBoardAlertState,
  getBoardOccupancyState,
  getBoardOperationalStatus,
  mapPlacaToBoardCard,
  mapPlacasToBoardCards
} from './boardAdapter';

const inputMock = {
  disponivel: {
    id: 'p-1',
    numero_placa: 'OOH-001',
    nome: 'Placa Centro',
    nomeDaRua: 'Av. Paulista, 1000',
    cidade: 'Sao Paulo',
    regiao: { nome: 'Centro' },
    disponivel: true,
    valorReferencia: 18500,
    imagem: 'https://cdn.local/placa-1.jpg'
  },
  ocupadaComCliente: {
    id: 'p-2',
    numero_placa: 'OOH-014',
    nome: 'Placa Leste',
    nomeDaRua: 'Rua Itaquera, 200',
    cidade: 'Sao Paulo',
    regiaoNome: 'Leste',
    aluguel_ativo: true,
    cliente_nome: 'Cliente Prime',
    aluguel_data_inicio: '2026-05-01',
    aluguel_data_fim: '2026-06-30',
    valor: 23600,
    ocupacaoPercentual: 90
  },
  reservada: {
    id: 'p-3',
    numero_placa: 'OOH-021',
    nome: 'Placa Sul',
    localizacao: 'Marginal Sul, 80',
    municipio: 'Sao Paulo',
    regiao: 'Sul',
    aluguel_futuro: true,
    cliente: { nome: 'Rede Farma' },
    periodo: { inicio: '2026-07-01', fim: '2026-07-31' },
    preco: 20900
  },
  manutencao: {
    id: 'p-4',
    numero_placa: 'OOH-033',
    manutencao: true,
    motivoIndisponibilidade: 'manutencao preventiva',
    ativa: false,
    cidadeNome: 'Guarulhos',
    endereco: 'Rua Industrial, 33'
  },
  pendente: {
    id: 'p-5',
    numero_placa: 'OOH-060',
    pendente: true,
    nomeDaRua: 'Av. Comercial, 55',
    regiao: 'ABC',
    cidade: 'Santo Andre',
    valor: 19600
  },
  incompleta: {
    id: null,
    numero_placa: null,
    regiao: null,
    cidade: null,
    nomeDaRua: null
  }
};

describe('boardAdapter v4', () => {
  it('mapeia placa disponivel no shape esperado do BoardCard', () => {
    const result = mapPlacaToBoardCard(inputMock.disponivel);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'p-1',
        code: 'OOH-001',
        name: 'Placa Centro',
        imageUrl: 'https://cdn.local/placa-1.jpg',
        location: 'Av. Paulista, 1000',
        city: 'Sao Paulo',
        region: 'Centro',
        status: 'disponivel',
        clientName: '',
        periodLabel: 'Sem periodo contratado',
        priceLabel: expect.stringContaining('R$'),
        alert: null
      })
    );
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it('classifica placa ocupada com cliente e preserva periodo', () => {
    const result = mapPlacaToBoardCard(inputMock.ocupadaComCliente);

    expect(result.status).toBe('ocupada');
    expect(result.clientName).toBe('Cliente Prime');
    expect(result.periodLabel).toContain('2026-05-01');
    expect(result.periodLabel).toContain('2026-06-30');
    expect(result.occupancy).toBe(90);
  });

  it('classifica placa reservada com alerta correspondente', () => {
    const result = mapPlacaToBoardCard(inputMock.reservada);

    expect(result.status).toBe('reservada');
    expect(result.alert).toContain('Reserva ativa');
    expect(result.clientName).toBe('Rede Farma');
  });

  it('classifica placa em manutencao mesmo com dados parciais', () => {
    const result = mapPlacaToBoardCard(inputMock.manutencao);

    expect(result.status).toBe('manutencao');
    expect(result.location).toBe('Rua Industrial, 33');
    expect(result.city).toBe('Guarulhos');
    expect(result.occupancy).toBe(0);
  });

  it('classifica placa pendente e emite alerta', () => {
    const result = mapPlacaToBoardCard(inputMock.pendente);

    expect(result.status).toBe('pendente');
    expect(result.alert).toContain('Pendencia operacional');
  });

  it('nao quebra com dados incompletos e aplica fallback', () => {
    const result = mapPlacaToBoardCard(inputMock.incompleta);

    expect(result.id).toBe('sem-id');
    expect(result.code).toBe('SEM-CODIGO');
    expect(result.location).toBe('Localizacao nao informada');
    expect(result.city).toBe('Cidade nao informada');
    expect(result.region).toBe('Sem regiao');
    expect(result.imageUrl).toBe('/assets/img/placeholder.png');
  });

  it('mapPlacasToBoardCards retorna lista adaptada e tolera entrada invalida', () => {
    const mapped = mapPlacasToBoardCards([inputMock.disponivel, inputMock.ocupadaComCliente]);
    const fallback = mapPlacasToBoardCards(null);

    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toHaveProperty('status');
    expect(fallback).toEqual([]);
  });

  it('suporta status operacionais obrigatorios via heuristica principal', () => {
    expect(getBoardOperationalStatus({ disponivel: true })).toBe('disponivel');
    expect(getBoardOperationalStatus({ aluguel_ativo: true })).toBe('ocupada');
    expect(getBoardOperationalStatus({ aluguel_futuro: true })).toBe('reservada');
    expect(getBoardOperationalStatus({ manutencao: true })).toBe('manutencao');
    expect(getBoardOperationalStatus({ indisponivel: true })).toBe('indisponivel');
    expect(getBoardOperationalStatus({ pendente: true })).toBe('pendente');
    expect(getBoardOperationalStatus({ aluguel_ativo: true, aluguel_data_fim: new Date(Date.now() + 2 * 86400000).toISOString() })).toBe('vencendo');
  });

  it('formatBoardPrice e formatBoardPeriod retornam labels seguras', () => {
    expect(formatBoardPrice(12345)).toContain('R$');
    expect(formatBoardPrice(undefined)).toBe('Nao informado');

    expect(formatBoardPeriod({ inicio: '2026-05-01', fim: '2026-05-31' })).toBe('2026-05-01 - 2026-05-31');
    expect(formatBoardPeriod({ inicio: '2026-05-01' })).toBe('A partir de 2026-05-01');
    expect(formatBoardPeriod(null)).toBe('Sem periodo contratado');
  });

  it('getBoardOccupancyState e getBoardAlertState respondem de forma deterministica', () => {
    const occ = getBoardOccupancyState({ ocupacaoPercentual: 67, aluguel_ativo: true });
    const alert = getBoardAlertState({ pendente: true });

    expect(occ).toEqual(
      expect.objectContaining({
        occupancy: 67,
        availabilityLabel: expect.any(String)
      })
    );
    expect(alert).toContain('Pendencia operacional');
  });
});
