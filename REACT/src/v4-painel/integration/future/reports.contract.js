/* ═══════════════════════════════════════════════════════════════
   REPORTS — CONTRATO DE INTEGRAÇÃO FUTURA
   Formato esperado para a ReportsPage e exportação.
═══════════════════════════════════════════════════════════════ */

export const PERFORMANCE_HISTORY_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/reports/performance?period=6m',
  shape: {
    mes:        { origin:'derivado',  formula:'format(date, "MMM")' },
    receita:    { origin:'existente', field:'receita_mensal', type:'number'  },
    ocupacao:   { origin:'derivado',  formula:'placas_ocupadas / total_placas' },
    contratos:  { origin:'existente', field:'contratos_ativos_no_mes', type:'number' },
    campanhas:  { origin:'existente', field:'campanhas_veiculadas', type:'number' },
  },
};

export const EXPORT_SERVICE_CONTRACT = {
  _origin: 'endpoint: POST /api/v4/reports/export',
  request: {
    tipo:     { type:'string', enum:'pdf|xlsx|csv' },
    relatorio:{ type:'string', enum:'ocupacao|receita|regional|campanhas|contratos|desempenho' },
    periodo:  { type:'object', fields:['from','to'], format:'YYYY-MM-DD' },
    filtros:  { type:'object', optional:true },
  },
  response: {
    jobId:    'string — ID do job de geração',
    status:   'string — pending|processing|ready|failed',
    url:      'string — URL temporária de download (nullable até ready)',
    expiresAt:'string — ISO 8601',
  },
  polling: 'GET /api/v4/reports/export/:jobId para verificar status',
};

export const REPORTS_ENDPOINTS = [
  { method:'GET',  path:'/api/v4/reports/performance',    status:'novo',     description:'Histórico de desempenho por período' },
  { method:'GET',  path:'/api/v4/reports/revenue',        status:'existente',description:'Analytics de receita' },
  { method:'GET',  path:'/api/v4/reports/regional',       status:'existente',description:'Comparativo regional' },
  { method:'GET',  path:'/api/v4/reports/occupancy',      status:'existente',description:'Histórico de ocupação e sazonalidade' },
  { method:'POST', path:'/api/v4/reports/export',         status:'novo',     description:'Iniciar job de exportação' },
  { method:'GET',  path:'/api/v4/reports/export/:jobId',  status:'novo',     description:'Status do job de exportação' },
];
