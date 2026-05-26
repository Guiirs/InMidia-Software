export const inventoryPreviewStatesV4 = [
  { value: 'default', label: 'Exibição padrão' },
  { value: 'loading', label: 'Carregando inventario' },
  { value: 'empty', label: 'Sem resultados' },
  { value: 'error', label: 'Falha de leitura' }
];

export const inventoryStatusListV4 = [
  'disponivel',
  'ocupada',
  'reservada',
  'manutencao',
  'indisponivel',
  'vencendo',
  'pendente'
];

export const inventoryMockPayloadV4 = [
  {
    _id: 'inv-001',
    numero_placa: 'INV-001-A',
    nome: 'Painel Centro Norte',
    nomeDaRua: 'Avenida Santos Dumont, 812',
    cidade: 'São Paulo',
    regiao: { nome: 'Centro' },
    disponivel: true,
    ocupacaoPercentual: 18,
    valorReferencia: 19800,
    imagem: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-002',
    numero_placa: 'INV-014-C',
    nome: 'Painel Eixo Leste',
    endereco: 'Avenida Aricanduva, 1540',
    cidade: 'São Paulo',
    regiaoNome: 'Leste',
    aluguel_ativo: true,
    cliente_nome: 'Auto Via Express',
    aluguel_data_inicio: '2026-05-02',
    aluguel_data_fim: '2026-07-02',
    ocupacaoPercentual: 86,
    valor: 23600,
    foto: 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-003',
    numero_placa: 'INV-021-R',
    nome: 'Painel Marginal Sul',
    localizacao: 'Marginal Pinheiros, 2440',
    municipio: 'São Paulo',
    regiao: 'Sul',
    aluguel_futuro: true,
    cliente: { nome: 'Rede Farma Prime' },
    periodo: { inicio: '2026-07-10', fim: '2026-08-10' },
    ocupacao: 74,
    precoReferencia: 21200,
    imagem: 'https://images.unsplash.com/photo-1462392246754-28dfa2df8e6b?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-004',
    numero_placa: 'INV-033-M',
    titulo: 'Painel Norte Industrial',
    nomeDaRua: 'Rua das Fabricas, 99',
    cidadeNome: 'Guarulhos',
    regiao: 'Norte',
    manutencao: true,
    ativa: false,
    ocupacaoPercentual: 0,
    valor: 16200,
    imagem: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-005',
    numero_placa: 'INV-045-I',
    nome: 'Painel Avenida Oeste',
    nomeDaRua: 'Avenida Republica, 411',
    cidade: 'Osasco',
    regiao: 'Oeste',
    indisponivel: true,
    ocupacaoPercentual: 100,
    cliente_nome: 'Sem uso comercial',
    periodo: 'Aguardando liberação de compliance',
    valor: 17400,
    imagem: 'https://images.unsplash.com/photo-1508736793122-f516e3ba5569?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-006',
    numero_placa: 'INV-052-V',
    nome: 'Painel Centro Expandido',
    nomeDaRua: 'Rua da Consolação, 1400',
    cidade: 'São Paulo',
    regiao: 'Centro',
    aluguel_ativo: true,
    cliente_nome: 'Instituto Horizonte',
    aluguel_data_inicio: '2026-05-01',
    aluguel_data_fim: '2026-05-23',
    ocupacaoPercentual: 69,
    valor: 22400,
    imagem: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-007',
    numero_placa: 'INV-060-P',
    nome: 'Painel Corredor ABC',
    nomeDaRua: 'Avenida Industrial, 622',
    cidade: 'Santo André',
    regiao: 'ABC',
    pendente: true,
    cliente_nome: 'Mundo Varejo',
    periodo: { inicio: '2026-06-04' },
    ocupacaoPercentual: 43,
    valor: 19400,
    imagem: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-008',
    numero_placa: 'INV-072-D',
    nome: 'Painel Rodovia Dom Pedro',
    endereco: 'Rodovia Dom Pedro, Km 78',
    cidade: 'Campinas',
    regiao: 'Interior',
    disponivel: true,
    ocupacaoPercentual: 32,
    valorReferencia: 18200,
    imagem: 'https://images.unsplash.com/photo-1508050919630-b135583b29ab?auto=format&fit=crop&w=1200&q=80'
  },
  {
    _id: 'inv-009',
    numero_placa: 'INV-085-O',
    nome: 'Painel Centro Sao Bernardo',
    endereco: 'Avenida Kennedy, 400',
    cidade: 'Sao Bernardo do Campo',
    regiao: 'ABC',
    aluguel_ativo: true,
    cliente_nome: 'Construtora Via Sul',
    aluguel_data_inicio: '2026-04-15',
    aluguel_data_fim: '2026-06-20',
    ocupacaoPercentual: 82,
    valor: 20800,
    imagem: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80'
  }
];
