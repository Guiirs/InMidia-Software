/* ═══════════════════════════════════════════════════════════════
   OPERATIONAL CATEGORIES — V4 PAINEL GOVERNANCE
   Taxonomia oficial de categorias operacionais do InMidia OOH.
═══════════════════════════════════════════════════════════════ */

/* Categorias de inventário (pontos/placas) */
export const BOARD_CATEGORY = {
  PREMIUM_A_PLUS: { id:'premium_a_plus', label:'Premium A+', priceMultiplier:1.5, minVisibility:'muito alta' },
  PREMIUM_A:      { id:'premium_a',      label:'Premium A',  priceMultiplier:1.3, minVisibility:'alta'       },
  STANDARD_B_PLUS:{ id:'standard_b+',   label:'Standard B+',priceMultiplier:1.1, minVisibility:'alta'       },
  STANDARD_B:     { id:'standard_b',     label:'Standard B', priceMultiplier:1.0, minVisibility:'média'      },
  ECONOMICO_C:    { id:'economico_c',    label:'Econômico C',priceMultiplier:0.7, minVisibility:'média'      },
};

/* Categorias de alerta */
export const ALERT_CATEGORY = {
  OPERACIONAL: { id:'operacional', label:'Operacional', icon:'display_settings',  priority:1 },
  COMERCIAL:   { id:'comercial',   label:'Comercial',   icon:'trending_up',       priority:2 },
  SISTEMA:     { id:'sistema',     label:'Sistema',     icon:'settings',          priority:3 },
  REGIONAL:    { id:'regional',    label:'Regional',    icon:'map',               priority:2 },
  CONTRATO:    { id:'contrato',    label:'Contrato',    icon:'description',       priority:1 },
  MANUTENCAO:  { id:'manutencao',  label:'Manutenção',  icon:'build',             priority:2 },
};

/* Categorias de atividade no feed */
export const ACTIVITY_CATEGORY = {
  OCUPACAO:      { id:'ocupacao',    label:'Ocupação',     icon:'check_circle',            color:'var(--v4p-success)' },
  LIBERACAO:     { id:'liberacao',   label:'Liberação',    icon:'radio_button_unchecked',  color:'var(--v4p-text-3)'  },
  CAMPANHA:      { id:'campanha',    label:'Campanha',     icon:'campaign',                color:'var(--v4p-accent)'  },
  MANUTENCAO:    { id:'manutencao',  label:'Manutenção',   icon:'build',                   color:'var(--v4p-warning)' },
  SINCRONIZACAO: { id:'sync',        label:'Sincronização',icon:'sync',                    color:'var(--v4p-accent)'  },
  CONTRATO:      { id:'contrato',    label:'Contrato',     icon:'description',             color:'var(--v4p-success)' },
  ALERTA:        { id:'alerta',      label:'Alerta',       icon:'warning',                 color:'var(--v4p-danger)'  },
  RELATORIO:     { id:'relatorio',   label:'Relatório',    icon:'bar_chart',               color:'var(--v4p-info)'    },
};

/* Categorias de oportunidade comercial */
export const OPPORTUNITY_CATEGORY = {
  RENOVACAO:     { id:'renovacao',   label:'Renovação',    weight:0.9 },
  EXPANSAO:      { id:'expansao',    label:'Expansão',     weight:1.2 },
  NOVA_VENDA:    { id:'nova_venda',  label:'Nova venda',   weight:1.0 },
  ATIVACAO:      { id:'ativacao',    label:'Ativação',     weight:0.8 },
  BUNDLE:        { id:'bundle',      label:'Bundle',       weight:1.1 },
};

/* Categorias de relatório */
export const REPORT_CATEGORY = {
  OCUPACAO:      { id:'ocupacao',    label:'Ocupação',     format:['pdf','xlsx'] },
  RECEITA:       { id:'receita',     label:'Receita',      format:['pdf','xlsx'] },
  REGIONAL:      { id:'regional',    label:'Regional',     format:['pdf','xlsx','csv'] },
  CAMPANHAS:     { id:'campanhas',   label:'Campanhas',    format:['pdf','csv']  },
  CONTRATOS:     { id:'contratos',   label:'Contratos',    format:['xlsx','csv'] },
  DESEMPENHO:    { id:'desempenho',  label:'Desempenho',   format:['pdf']        },
};
