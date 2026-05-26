/* ═══════════════════════════════════════════════════════════════
   CONTRACTS — CONTRATO DE INTEGRAÇÃO FUTURA
   Formato esperado de dados para a ContractsPage.
═══════════════════════════════════════════════════════════════ */

export const CONTRACT_DATA_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/contracts',
  shape: {
    id:                      { origin:'existente', field:'contrato_id',       format:'CTR-XXXX' },
    cliente:                 { origin:'existente', field:'cliente_nome'       },
    regiao:                  { origin:'existente', field:'regiao_nome'        },
    placas:                  { origin:'derivado',  formula:'count(placas_vinculadas)' },
    inicioVigencia:          { origin:'existente', field:'data_inicio',       format:'YYYY-MM-DD' },
    vencimento:              { origin:'existente', field:'data_vencimento',   format:'YYYY-MM-DD' },
    diasRestantes:           { origin:'derivado',  formula:'daysBetween(today, vencimento)' },
    receita:                 { origin:'existente', field:'valor_mensal',      type:'number' },
    status:                  { origin:'derivado',  formula:'mapToContractStatus(dias_restantes, renovado, encerrado)', enum:'active|expiring|renewed|paused|expired|draft' },
    risco:                   { origin:'derivado',  formula:'mapToSeverity(dias_restantes, valor_mensal, historico_renovacao)' },
    estado:                  { origin:'derivado',  formula:'mapRiscoToOperationalState(risco)' },
    probabilidadeRenovacao:  { origin:'novo',       description:'Probabilidade 0-1 calculada por histórico e contexto' },
    acaoRecomendada:         { origin:'novo',       description:'Ação recomendada em linguagem operacional' },
    impactoAnual:            { origin:'derivado',   formula:'receita * 12' },
  },
};

export const CONTRACTS_ENDPOINTS = [
  { method:'GET',   path:'/api/v4/contracts',                  status:'existente', description:'Lista de contratos com campos v4' },
  { method:'GET',   path:'/api/v4/contracts/:id',              status:'existente', description:'Detalhe de um contrato' },
  { method:'GET',   path:'/api/v4/contracts/summary',          status:'parcial',   description:'Resumo financeiro e de risco' },
  { method:'GET',   path:'/api/v4/contracts/expiring',         status:'novo',      description:'Contratos vencendo em N dias' },
  { method:'GET',   path:'/api/v4/contracts/renewal-opportunities', status:'novo', description:'Oportunidades de renovação e expansão' },
  { method:'GET',   path:'/api/v4/contracts/financial-impact', status:'novo',      description:'Impacto financeiro por cenário' },
  { method:'PATCH', path:'/api/v4/contracts/:id/status',       status:'existente', description:'Atualizar status do contrato' },
];
