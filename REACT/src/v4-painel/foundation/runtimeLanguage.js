/* ─── LINGUAGEM OPERACIONAL — FOUNDATION V4 PAINEL ──────────── */
/* Vocabulário autorizado para toda interface do sistema.
   Nunca use termos técnicos internos diretamente na UI. */

export const LANG = {
  /* Ações */
  action: {
    save:       'Salvar',
    cancel:     'Cancelar',
    confirm:    'Confirmar',
    close:      'Fechar',
    export:     'Exportar',
    filter:     'Filtrar',
    search:     'Buscar',
    refresh:    'Atualizar',
    viewAll:    'Ver todos',
    viewDetail: 'Ver detalhes',
    edit:       'Editar',
    archive:    'Arquivar',
  },

  /* Status operacionais */
  status: {
    operational:   'Operacional',
    attention:     'Atenção',
    critical:      'Crítico',
    degraded:      'Degradado',
    pending:       'Aguardando',
    syncing:       'Sincronizando',
    readonly:      'Somente leitura',
    unavailable:   'Indisponível',
    active:        'Ativo',
    inactive:      'Inativo',
    available:     'Disponível',
    occupied:      'Ocupado',
    reserved:      'Reservado',
    maintenance:   'Em manutenção',
  },

  /* Métricas e indicadores */
  metric: {
    revenue:      'Receita',
    occupancy:    'Ocupação',
    inventory:    'Inventário',
    availability: 'Disponibilidade',
    performance:  'Desempenho',
    activity:     'Atividade',
    alerts:       'Alertas',
    contracts:    'Contratos',
    points:       'Pontos',
    regions:      'Regiões',
    campaigns:    'Campanhas',
  },

  /* Períodos */
  period: {
    today:        'Hoje',
    yesterday:    'Ontem',
    thisWeek:     'Esta semana',
    lastWeek:     'Semana passada',
    thisMonth:    'Este mês',
    lastMonth:    'Mês passado',
    thisQuarter:  'Este trimestre',
    thisYear:     'Este ano',
    custom:       'Período personalizado',
  },

  /* Mensagens do sistema */
  system: {
    lastUpdate:       'Última atualização',
    syncOk:           'Sincronização estável',
    syncInProgress:   'Sincronizando dados…',
    noData:           'Sem dados disponíveis',
    loading:          'Carregando informações…',
    errorGeneric:     'Não foi possível carregar os dados.',
    errorRetry:       'Tente novamente em instantes.',
    emptyState:       'Nenhum registro encontrado.',
    allOperational:   'Todos os sistemas operacionais.',
    attention:        'Situação requer atenção.',
  },

  /* Seções da sidebar */
  nav: {
    dashboard:     'Dashboard',
    operations:    'Operações',
    inventory:     'Inventário',
    commercial:    'Comercial',
    contracts:     'Contratos',
    reports:       'Relatórios',
    regions:       'Regiões',
    campaigns:     'Campanhas',
    alerts:        'Alertas',
    activity:      'Atividade',
    settings:      'Configurações',
  },
};
