export const auditV4MockData = {
  generatedAt: '2026-05-18T18:20:00Z',
  header: {
    title: 'Auditoria Operacional v4',
    subtitle: 'Camada visual isolada para validação de layout',
    description: 'Sem conexão com auditService nesta fase. Dados abaixo são inteiramente simulados.'
  },
  summary: {
    totalEventos24h: 386,
    eventosCríticos: 14,
    usuariosAtivos: 27,
    entidadesMonitoradas: 11
  },
  filters: {
    users: [
      { value: 'all', label: 'Todos os usuários' },
      { value: 'ana.souza', label: 'ana.souza' },
      { value: 'carlos.melo', label: 'carlos.melo' },
      { value: 'marina.lima', label: 'marina.lima' },
      { value: 'sistema', label: 'sistema' }
    ],
    actions: [
      { value: 'all', label: 'Todas as ações' },
      { value: 'CREATE', label: 'CREATE' },
      { value: 'UPDATE', label: 'UPDATE' },
      { value: 'DELETE', label: 'DELETE' },
      { value: 'LOGIN', label: 'LOGIN' },
      { value: 'EXPORT', label: 'EXPORT' }
    ],
    entities: [
      { value: 'all', label: 'Todas as entidades' },
      { value: 'placa', label: 'placa' },
      { value: 'contrato', label: 'contrato' },
      { value: 'usuario', label: 'usuario' },
      { value: 'sync', label: 'sync' },
      { value: 'dashboard', label: 'dashboard' }
    ],
    periods: [
      { value: '6h', label: 'Últimas 6h' },
      { value: '24h', label: 'Últimas 24h' },
      { value: '7d', label: 'Últimos 7 dias' },
      { value: '30d', label: 'Últimos 30 dias' }
    ]
  },
  timeline: [
    {
      id: 'ev-901',
      severity: 'error',
      status: 'critico',
      actor: 'sistema',
      action: 'DELETE',
      entity: 'contrato',
      entityId: 'ctr-9912',
      at: '2026-05-18 18:03:11',
      detail: 'Tentativa bloqueada por regra de retencao de dados.'
    },
    {
      id: 'ev-902',
      severity: 'warning',
      status: 'atencao',
      actor: 'ana.souza',
      action: 'UPDATE',
      entity: 'placa',
      entityId: 'pl-1203',
      at: '2026-05-18 17:56:24',
      detail: 'Atualização com divergência de coordenadas; revisão pendente.'
    },
    {
      id: 'ev-903',
      severity: 'info',
      status: 'normal',
      actor: 'marina.lima',
      action: 'CREATE',
      entity: 'usuario',
      entityId: 'usr-882',
      at: '2026-05-18 17:49:12',
      detail: 'Novo usuario criado com perfil gestor.'
    },
    {
      id: 'ev-904',
      severity: 'info',
      status: 'normal',
      actor: 'carlos.melo',
      action: 'EXPORT',
      entity: 'dashboard',
      entityId: 'exp-445',
      at: '2026-05-18 17:42:50',
      detail: 'Exportação operacional concluída em formato CSV.'
    }
  ],
  recentEvents: [
    {
      id: 'ev-901',
      severity: 'error',
      actor: 'sistema',
      action: 'DELETE',
      entity: 'contrato',
      entityId: 'ctr-9912',
      at: '2026-05-18 18:03:11',
      ip: '10.24.7.10'
    },
    {
      id: 'ev-902',
      severity: 'warning',
      actor: 'ana.souza',
      action: 'UPDATE',
      entity: 'placa',
      entityId: 'pl-1203',
      at: '2026-05-18 17:56:24',
      ip: '10.24.1.34'
    },
    {
      id: 'ev-903',
      severity: 'info',
      actor: 'marina.lima',
      action: 'CREATE',
      entity: 'usuario',
      entityId: 'usr-882',
      at: '2026-05-18 17:49:12',
      ip: '10.24.2.21'
    },
    {
      id: 'ev-904',
      severity: 'info',
      actor: 'carlos.melo',
      action: 'EXPORT',
      entity: 'dashboard',
      entityId: 'exp-445',
      at: '2026-05-18 17:42:50',
      ip: '10.24.8.12'
    },
    {
      id: 'ev-905',
      severity: 'warning',
      actor: 'ana.souza',
      action: 'UPDATE',
      entity: 'sync',
      entityId: 'sync-77',
      at: '2026-05-18 17:37:09',
      ip: '10.24.1.34'
    },
    {
      id: 'ev-906',
      severity: 'info',
      actor: 'sistema',
      action: 'LOGIN',
      entity: 'usuario',
      entityId: 'usr-103',
      at: '2026-05-18 17:30:44',
      ip: '10.24.0.9'
    }
  ]
};
