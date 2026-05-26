export const healthV4MockData = {
  generatedAt: '2026-05-18T18:45:00Z',
  header: {
    title: 'Saúde Operacional v4',
    subtitle: 'Painel visual isolado para acompanhamento diário',
    description: 'Esta versão usa dados simulados para validação de layout, sem conexão com serviços reais.'
  },
  kpis: {
    disponibilidadeGeral: '98,7%',
    sincronizacaoAtiva: '94,2%',
    filasPendentes: 18,
    incidentesAbertos: 3
  },
  syncPanel: {
    faseAtual: 'Sincronização contínua',
    ultimoCiclo: '2026-05-18 18:42:19',
    tempoMedioAtualizacao: '42s',
    coberturaInventario: '96,4%',
    status: 'atencao'
  },
  channels: [
    {
      id: 'ch-01',
      nome: 'Inventario de placas',
      status: 'normal',
      ultimaAtualizacao: '18:42:19',
      fila: 4,
      observacao: 'Processamento estável no ciclo atual.'
    },
    {
      id: 'ch-02',
      nome: 'Eventos operacionais',
      status: 'atencao',
      ultimaAtualizacao: '18:41:03',
      fila: 9,
      observacao: 'Pico de entrada acima da média.'
    },
    {
      id: 'ch-03',
      nome: 'Consolidação executiva',
      status: 'normal',
      ultimaAtualizacao: '18:40:52',
      fila: 2,
      observacao: 'Sem desvios relevantes.'
    },
    {
      id: 'ch-04',
      nome: 'Atualização de contratos',
      status: 'critico',
      ultimaAtualizacao: '18:33:11',
      fila: 21,
      observacao: 'Fila alta; exige acompanhamento imediato.'
    }
  ],
  recentEvents: [
    {
      id: 'he-801',
      tipo: 'Atraso de processamento',
      canal: 'Atualização de contratos',
      impacto: 'alto',
      horario: '18:33:11',
      responsavel: 'Time Operacional'
    },
    {
      id: 'he-802',
      tipo: 'Recuperação de lote',
      canal: 'Eventos operacionais',
      impacto: 'medio',
      horario: '18:36:48',
      responsavel: 'Time Integração'
    },
    {
      id: 'he-803',
      tipo: 'Ciclo concluido',
      canal: 'Inventario de placas',
      impacto: 'baixo',
      horario: '18:42:19',
      responsavel: 'Automação'
    },
    {
      id: 'he-804',
      tipo: 'Fila normalizada',
      canal: 'Consolidação executiva',
      impacto: 'baixo',
      horario: '18:40:52',
      responsavel: 'Automação'
    }
  ],
  degradation: {
    situacao: 'parcial',
    titulo: 'Operação em modo de atencao',
    descricao: 'Alguns canais estão com atraso e podem apresentar atualização fora do ritmo esperado.',
    acoesSugeridas: [
      'Priorizar canal de contratos',
      'Reprocessar lote de eventos pendentes',
      'Acompanhar painel a cada 5 minutos'
    ]
  }
};
