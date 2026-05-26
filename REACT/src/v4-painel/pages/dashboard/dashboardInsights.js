/* ─── INTELIGÊNCIA OPERACIONAL — DASHBOARD ───────────────────── */
/* Simulação de análise automática do sistema.
   Em produção, estes dados virão de um motor de inteligência real. */

export const EXECUTIVE_SUMMARY = {
  situacao: {
    titulo:    'Situação operacional',
    texto:     'O inventário opera em nível saudável com 78,1% de ocupação — acima da meta de 75%. São Paulo lidera com 84,6% de aproveitamento e representa 45,1% da receita total do mês. A região Sul apresenta desaceleração pontual que requer atenção comercial nas próximas 48 horas.',
    estado:    'healthy',
  },
  riscos: {
    titulo:    'Principais riscos',
    itens: [
      'Ponto SP-2241 sem comunicação há 48h — R$ 4.200 parado diretamente.',
      '3 contratos somando R$ 34.400/mês vencem nos próximos 10 dias sem confirmação de renovação.',
      'Rio Grande do Sul com 67,4% de ocupação — 7,6pp abaixo da meta regional.',
    ],
    estado:    'warning',
  },
  oportunidades: {
    titulo:    'Oportunidades identificadas',
    itens: [
      'SP-1089 na Marginal Tietê ocioso há 12 dias — potencial de R$ 5.800/mês em corredor premium.',
      'Agência Meridian em análise de renovação: proposta de expansão para MG pode aumentar ticket em 28%.',
      'Sazonalidade favorável no eixo RJ-litoral para os próximos 45 dias.',
    ],
    estado:    'healthy',
  },
  recomendacoes: {
    titulo:    'Recomendações executivas',
    itens: [
      'Priorizar ativação da carteira Sul nos próximos 3 dias antes do fim do período de campanha de verão.',
      'Agendar revisão emergencial dos 3 contratos em vencimento — risco combinado de R$ 412.800/ano.',
      'Avaliar redução de preço de entrada em posições Standard B da região RS para reativar ocupação.',
    ],
    estado:    'healthy',
  },
};

export const OPERATIONAL_RECOMMENDATIONS = [
  {
    id:          'rec-001',
    tipo:        'urgente',
    icone:       'crisis_alert',
    titulo:      'Verificar ponto SP-2241 imediatamente',
    descricao:   'Ausência de sinal há 48h. Ponto premium com campanha ativa. Perda acumulada estimada em R$ 840.',
    impacto:     'R$ 4.200/mês',
    prazo:       'Hoje',
    estado:      'critical',
    categoria:   'operacional',
  },
  {
    id:          'rec-002',
    tipo:        'comercial',
    icone:       'trending_up',
    titulo:      'Ativar SP-1089 — Marginal Tietê',
    descricao:   'Posição premium ociosa há 12 dias no principal corredor de SP. Visibilidade muito alta, demanda latente identificada na base de leads.',
    impacto:     'R$ 5.800/mês',
    prazo:       'Esta semana',
    estado:      'warning',
    categoria:   'comercial',
  },
  {
    id:          'rec-003',
    tipo:        'renovacao',
    icone:       'description',
    titulo:      'Reunião de renovação — Grupo Azul',
    descricao:   'Contrato de R$ 18.400/mês vence em 7 dias. Cliente com histórico positivo e 3 pontos ativos. Alta probabilidade de renovação.',
    impacto:     'R$ 220.800/ano',
    prazo:       'Amanhã',
    estado:      'critical',
    categoria:   'comercial',
  },
  {
    id:          'rec-004',
    tipo:        'regional',
    icone:       'map',
    titulo:      'Campanha de ativação — Rio Grande do Sul',
    descricao:   '29 posições disponíveis com ocupação 7,6pp abaixo da meta. Período pré-inverno favorável para anunciantes do setor alimentação e vestuário.',
    impacto:     'R$ 8.200 potencial',
    prazo:       'Próximos 7 dias',
    estado:      'warning',
    categoria:   'regional',
  },
  {
    id:          'rec-005',
    tipo:        'estrategico',
    icone:       'insights',
    titulo:      'Expansão para corredor MG — Meridian Media',
    descricao:   'Cliente em renovação com budget aumentado. Proposta de expansão para o corredor Belo Horizonte — Betim pode elevar ticket médio em 28%.',
    impacto:     'R$ 8.700 adicional/mês',
    prazo:       'Esta semana',
    estado:      'healthy',
    categoria:   'estratégico',
  },
];
