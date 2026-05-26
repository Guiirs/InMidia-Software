/* ═══════════════════════════════════════════════════════════════
   COMMERCIAL — CONTRATO DE INTEGRAÇÃO FUTURA
   Formato esperado de dados para a CommercialPage.
═══════════════════════════════════════════════════════════════ */

export const PIPELINE_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/commercial/pipeline',
  stages: {
    type:   'Array<PipelineStage>',
    shape: {
      id:          { origin:'existente', field:'stage_id'          },
      label:       { origin:'existente', field:'stage_nome'        },
      count:       { origin:'derivado',  formula:'count(oportunidades where estagio = id)' },
      receita:     { origin:'derivado',  formula:'sum(valor_potencial where estagio = id)' },
      conversao:   { origin:'derivado',  formula:'count(estagio+1) / count(estagio)' },
    },
  },
  summary: {
    taxaConversaoGlobal: { origin:'derivado' },
    ticketMedioFechado:  { origin:'derivado' },
    cicloMedioVendas:    { origin:'novo',     description:'Média de dias do lead ao fechamento' },
    receitaNoMes:        { origin:'existente' },
    metaMensal:          { origin:'novo',     description:'Meta configurada por período' },
  },
};

export const OPPORTUNITY_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/commercial/opportunities',
  shape: {
    id:          { origin:'existente', field:'oportunidade_id'   },
    cliente:     { origin:'existente', field:'cliente_nome'      },
    regiao:      { origin:'existente', field:'regiao_nome'       },
    potencial:   { origin:'existente', field:'valor_potencial'   },
    prioridade:  { origin:'derivado',  formula:'mapPriority(valor_potencial, dias_no_funil)' },
    status:      { origin:'existente', field:'estagio_nome',     enum:'Lead|Proposta|Negociação|Fechamento' },
    chance:      { origin:'novo',      description:'Probabilidade de fechamento 0-1, calculada por IA' },
    tags:        { origin:'novo',      description:'Tags operacionais da oportunidade' },
    recomendacao:{ origin:'novo',      description:'Ação recomendada gerada automaticamente' },
    estado:      { origin:'derivado',  formula:'mapChanceToState(chance)' },
  },
};

export const COMMERCIAL_ENDPOINTS = [
  { method:'GET', path:'/api/v4/commercial/pipeline',         status:'novo',     description:'Estágios e resumo do funil' },
  { method:'GET', path:'/api/v4/commercial/opportunities',    status:'parcial',  description:'Lista de oportunidades com campos v4' },
  { method:'GET', path:'/api/v4/commercial/revenue/forecast', status:'novo',     description:'Projeção de receita mensal e trimestral' },
  { method:'GET', path:'/api/v4/commercial/performance',      status:'parcial',  description:'Desempenho regional e por vendedor' },
  { method:'GET', path:'/api/v4/intelligence/commercial',     status:'novo',     description:'Insights e recomendações comerciais' },
  { method:'GET', path:'/api/v4/commercial/targets',          status:'novo',     description:'Metas configuradas por período' },
];
