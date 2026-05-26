/* ═══════════════════════════════════════════════════════════════
   INVENTORY — CONTRATO DE INTEGRAÇÃO FUTURA
   Formato esperado de dados para a InventoryPage.
═══════════════════════════════════════════════════════════════ */

export const BOARD_DATA_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/inventory/boards',
  _pagination: { pageSize:50, cursor:true },
  shape: {
    id:                { origin:'existente', field:'id_placa'          },
    codigo:            { origin:'existente', field:'codigo_placa'      },
    nome:              { origin:'existente', field:'nome_ponto'        },
    localizacao:       { origin:'existente', field:'endereco_completo' },
    regiao:            { origin:'existente', field:'regiao_nome'       },
    siglaRegiao:       { origin:'derivado',  formula:'mapRegiaoToSigla(regiao)' },
    status:            { origin:'derivado',  formula:'mapBoardStatus(ocupado, em_manutencao, reservado, sem_sinal)', enum:['occupied','available','maintenance','reserved','critical'] },
    estado:            { origin:'derivado',  formula:'mapStatusToOperationalState(status)' },
    categoria:         { origin:'existente', field:'categoria_placa',  enum:['Premium A+','Premium A','Standard B+','Standard B','Econômico C'] },
    ocupacao:          { origin:'derivado',  formula:'ocupado ? 1 : 0' },
    ocupado:           { origin:'existente', field:'ocupado',          type:'boolean' },
    receitaEstimada:   { origin:'existente', field:'valor_mensal',     type:'number'  },
    receitaFormatada:  { origin:'derivado',  formula:'formatCurrency(receitaEstimada)' },
    prioridade:        { origin:'derivado',  formula:'mapToPriority(receitaEstimada, diasOcioso, risco)' },
    diasOcioso:        { origin:'derivado',  formula:'!ocupado ? daysSince(ultimo_contrato_fim) : null' },
    ultimaAtividade:   { origin:'derivado',  formula:'formatRelativeTime(updated_at)' },
    campanha:          { origin:'existente', field:'campanha_ativa_nome', nullable:true },
    cliente:           { origin:'existente', field:'cliente_ativo_nome',  nullable:true },
    statusDetalhe:     { origin:'novo',      description:'Texto operacional descrevendo o status atual' },
    recomendacao:      { origin:'novo',      description:'Ação recomendada gerada automaticamente' },
    visibilidade:      { origin:'existente', field:'nivel_visibilidade' },
    risco:             { origin:'derivado',  formula:'mapToSeverity(dias_sem_sinal, contrato_vencendo)' },
    lat:               { origin:'existente', field:'latitude'          },
    lng:               { origin:'existente', field:'longitude'         },
  },
};

export const INVENTORY_SUMMARY_CONTRACT = {
  _origin: 'endpoint: GET /api/v4/inventory/summary',
  shape: {
    total:         { origin:'existente' },
    ocupadas:      { origin:'existente' },
    disponiveis:   { origin:'derivado' },
    manutencao:    { origin:'existente' },
    reservadas:    { origin:'existente' },
    criticas:      { origin:'novo', description:'Pontos com estado critical (sem sinal + campanha ativa)' },
    taxaOcupacao:  { origin:'derivado' },
    receitaTotal:  { origin:'derivado' },
  },
};

export const INVENTORY_ENDPOINTS = [
  { method:'GET',  path:'/api/v4/inventory/boards',                 status:'parcial', description:'Lista paginada de placas com campos v4' },
  { method:'GET',  path:'/api/v4/inventory/boards/:id',             status:'parcial', description:'Detalhe completo de uma placa' },
  { method:'GET',  path:'/api/v4/inventory/summary',                status:'existente', description:'Resumo do inventário' },
  { method:'GET',  path:'/api/v4/inventory/boards/:id/activity',    status:'novo',    description:'Atividade recente de uma placa' },
  { method:'GET',  path:'/api/v4/inventory/boards/:id/recommendations', status:'novo',description:'Recomendações automáticas para a placa' },
];
