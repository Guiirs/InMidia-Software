/* ═══════════════════════════════════════════════════════════════
   OPERATIONS — CONTRATO DE INTEGRAÇÃO FUTURA
   Formato esperado de dados para a OperationsPage.
═══════════════════════════════════════════════════════════════ */

export const RUNTIME_MODULES_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/system/modules ou SSE /api/v4/system/health',
  shape: {
    id:                  { origin:'novo', type:'string'  },
    label:               { origin:'novo', description:'Nome operacional do módulo (não técnico)' },
    descricao:           { origin:'novo', description:'O que o módulo faz em linguagem operacional' },
    estado:              { origin:'novo', enum:'OPERATIONAL_STATE' },
    uptime:              { origin:'novo', format:'99.97%' },
    tempoResposta:       { origin:'novo', format:'210ms' },
    pontosSincronizados: { origin:'derivado', nullable:true },
    ultimaAtividade:     { origin:'derivado', formula:'formatRelativeTime(last_heartbeat)' },
    tendencia:           { origin:'derivado', enum:'crescimento|estável|queda|lenta|atenção' },
  },
};

export const OPERATIONS_FEED_CONTRACT = {
  _origin: 'SSE endpoint: /api/v4/operations/feed',
  _refreshRate: '15s or push',
  shape: {
    id:        { origin:'derivado', formula:'uuid()' },
    tipo:      { origin:'existente', enum:'ocupacao|liberacao|campanha|manutencao|sync|alerta|contrato|relatorio' },
    icone:     { origin:'derivado', formula:'mapTipoToIcon(tipo)' },
    label:     { origin:'novo',     description:'Descrição em linguagem operacional' },
    regiao:    { origin:'existente', field:'regiao_nome', nullable:true },
    tempo:     { origin:'derivado',  formula:'formatRelativeTime(created_at)' },
    cor:       { origin:'derivado',  formula:'mapTipoToColor(tipo)' },
  },
};

export const SYNC_STATUS_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/system/sync-status',
  shape: {
    estado:              { origin:'derivado' },
    modo:                { origin:'novo',     enum:'automático|manual|parado' },
    intervalo:           { origin:'existente',field:'sync_interval', format:'30 segundos' },
    ultimaSync:          { origin:'existente',field:'last_sync_at', format:'ISO 8601' },
    ultimaSyncLabel:     { origin:'derivado',  formula:'formatRelativeTime(ultima_sync)' },
    proximaSync:         { origin:'derivado',  formula:'formatRelativeTime(proxima_sync)' },
    totalPontos:         { origin:'existente' },
    pontosAtualizados:   { origin:'novo',     description:'Pontos com heartbeat nos últimos 30s' },
    divergencias:        { origin:'novo',     description:'Pontos com dados inconsistentes' },
    detalhes:            { origin:'novo',     description:'Array com status por região' },
  },
};

export const OPERATIONS_ENDPOINTS = [
  { method:'GET', path:'/api/v4/system/health',            status:'novo',     description:'Saúde geral do sistema v4' },
  { method:'GET', path:'/api/v4/system/modules',           status:'novo',     description:'Status de cada módulo operacional' },
  { method:'SSE', path:'/api/v4/system/health/stream',     status:'novo',     description:'Stream de saúde em tempo real' },
  { method:'GET', path:'/api/v4/system/sync-status',       status:'novo',     description:'Status de sincronização por região' },
  { method:'SSE', path:'/api/v4/operations/feed',          status:'novo',     description:'Feed de atividades em tempo real' },
  { method:'GET', path:'/api/v4/operations/regional',      status:'existente',description:'Resumo por região' },
];
