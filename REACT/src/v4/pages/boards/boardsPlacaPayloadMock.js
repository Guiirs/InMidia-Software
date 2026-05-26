export const boardPreviewStatesV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando cards' },
  { value: 'empty', label: 'Sem resultados' },
  { value: 'error', label: 'Falha de leitura' }
];

export const boardStatusListV4 = [
  'disponivel',
  'ocupada',
  'reservada',
  'manutencao',
  'indisponivel',
  'vencendo',
  'pendente'
];

export const placasPayloadMockV4 = [
  {
    _id: 'placa-001',
    numero_placa: 'OOH-001-A',
    nome: 'Placa Central Norte',
    nomeDaRua: 'Avenida Central, 1204',
    cidade: 'São Paulo',
    regiao: { nome: 'Centro' },
    disponivel: true,
    ocupacaoPercentual: 22,
    valorReferencia: 18500,
    imagem: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'placa-002',
    numero_placa: 'OOH-014-C',
    nome: 'Placa Eixo Leste',
    nomeDaRua: 'Avenida dos Estados, 928',
    cidade: 'São Paulo',
    regiaoNome: 'Leste',
    aluguel_ativo: true,
    cliente_nome: 'Auto Via Express',
    aluguel_data_inicio: '2026-05-02',
    aluguel_data_fim: '2026-06-30',
    ocupacaoPercentual: 88,
    valor: 23600,
    imagem: 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'placa-003',
    numero_placa: 'OOH-021-R',
    nome: 'Placa Polo Sul',
    localizacao: 'Marginal Sul, 2440',
    municipio: 'São Paulo',
    regiao: 'Sul',
    aluguel_futuro: true,
    cliente: { nome: 'Rede Farma Prime' },
    periodo: { inicio: '2026-07-01', fim: '2026-07-31' },
    ocupacao: 76,
    precoReferencia: 20900,
    foto: 'https://images.unsplash.com/photo-1462392246754-28dfa2df8e6b?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'placa-004',
    numero_placa: 'OOH-033-M',
    titulo: 'Placa Norte Industrial',
    endereco: 'Rua das Fabricas, 88',
    cidadeNome: 'Guarulhos',
    regiao: 'Norte',
    manutencao: true,
    ativa: false,
    ocupacaoPercentual: 0,
    valor: 15800,
    imagem: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'placa-005',
    numero_placa: 'OOH-045-I',
    nome: 'Placa Avenida Oeste',
    nomeDaRua: 'Avenida Republica, 411',
    cidade: 'Osasco',
    regiao: 'Oeste',
    indisponivel: true,
    ocupacaoPercentual: 100,
    cliente_nome: 'Sem uso comercial',
    periodo: 'Aguardando liberação de compliance',
    valor: 17200,
    imagem: 'https://images.unsplash.com/photo-1508736793122-f516e3ba5569?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'placa-006',
    numero_placa: 'OOH-052-V',
    nome: 'Placa Centro Expandido',
    nomeDaRua: 'Rua da Consolação, 1400',
    cidade: 'São Paulo',
    regiao: 'Centro',
    aluguel_ativo: true,
    cliente_nome: 'Instituto Horizonte',
    aluguel_data_inicio: '2026-05-01',
    aluguel_data_fim: '2026-05-22',
    ocupacaoPercentual: 69,
    valor: 22400,
    imagem: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'placa-007',
    numero_placa: 'OOH-060-P',
    nome: 'Placa Corredor ABC',
    nomeDaRua: 'Avenida Industrial, 622',
    cidade: 'Santo André',
    regiao: 'ABC',
    pendente: true,
    cliente_nome: 'Mundo Varejo',
    periodo: { inicio: '2026-06-01' },
    ocupacaoPercentual: 41,
    valor: 19600,
    imagem: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80'
  }
];
