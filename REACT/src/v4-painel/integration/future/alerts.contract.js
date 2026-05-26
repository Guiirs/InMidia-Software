/* ═══════════════════════════════════════════════════════════════
   ALERTS — CONTRATO DE INTEGRAÇÃO FUTURA
   Formato esperado para a AlertsPage e sistema de alertas em tempo real.
═══════════════════════════════════════════════════════════════ */

export const ALERT_FULL_CONTRACT = {
  _origin: 'SSE /api/v4/alerts/stream ou GET /api/v4/alerts/active',
  shape: {
    id:             { origin:'existente', field:'alerta_id'      },
    titulo:         { origin:'novo',      description:'Texto curto em linguagem operacional (max 80 chars)' },
    descricao:      { origin:'novo',      description:'Descrição completa do alerta (max 300 chars)' },
    categoria:      { origin:'novo',      enum:'operacional|comercial|sistema|regional|contrato|manutencao' },
    severidade:     { origin:'existente', field:'severity',     enum:'info|low|medium|high|critical' },
    estado:         { origin:'derivado',  formula:'mapSeverityToOperationalState(severidade)' },
    prioridade:     { origin:'derivado',  formula:'mapSeverityToPriority(severidade)' },
    sla:            { origin:'novo',      description:'Tempo máximo de resposta — "2h", "8h", "48h"' },
    owner:          { origin:'novo',      description:'Equipe responsável pela resolução' },
    impacto:        { origin:'novo',      description:'Texto descritivo do impacto financeiro/operacional' },
    status:         { origin:'novo',      enum:'Aberto|Em andamento|Monitorando|Sincronizando|Resolvido' },
    regioesAfetadas:{ origin:'derivado',  formula:'extractRegioes(metadata)', type:'Array<string>' },
    lido:           { origin:'novo',      type:'boolean', default:false },
    acao:           { origin:'novo',      description:'Ação em andamento descrita em linguagem operacional' },
    historico:      { origin:'novo',      type:'Array<{tempo: string, evento: string}>' },
    timestamp:      { origin:'existente', field:'created_at', format:'ISO 8601' },
  },
};

export const ALERTS_ENDPOINTS = [
  { method:'GET',   path:'/api/v4/alerts/active',           status:'novo',     description:'Lista de alertas ativos com formato v4' },
  { method:'SSE',   path:'/api/v4/alerts/stream',           status:'novo',     description:'Stream em tempo real de novos alertas' },
  { method:'GET',   path:'/api/v4/alerts/:id',              status:'novo',     description:'Detalhe completo de um alerta com histórico' },
  { method:'PATCH', path:'/api/v4/alerts/:id/read',         status:'novo',     description:'Marcar alerta como lido' },
  { method:'PATCH', path:'/api/v4/alerts/read-all',         status:'novo',     description:'Marcar todos os alertas como lidos' },
  { method:'GET',   path:'/api/v4/alerts/recommendations',  status:'novo',     description:'Recomendações de mitigação para alertas ativos' },
];
