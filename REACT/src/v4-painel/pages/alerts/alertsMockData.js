/* ═══════════════════════════════════════════════════════════════
   ALERTS MOCK DATA — V4 PAINEL
   Central de alertas operacionais enterprise.
═══════════════════════════════════════════════════════════════ */
import { OPERATIONAL_STATE } from '../../foundation/operationalStates.js';
import { SEVERITY }          from '../../foundation/severityLevels.js';
import { PRIORITY }          from '../../foundation/priorities.js';

export const ALERT_CATEGORY = {
  OPERACIONAL:  'operacional',
  COMERCIAL:    'comercial',
  SISTEMA:      'sistema',
  REGIONAL:     'regional',
  CONTRATO:     'contrato',
  MANUTENCAO:   'manutenção',
};

/* ── ALERTS COMPLETOS ────────────────────────────────────────── */
export const ALERTS_FULL = [
  {
    id:'alrt-001', titulo:'Ponto SP-2241 sem sinal há 48h',
    descricao:'Comunicação interrompida com o ponto SP-2241 (Paulista — MASP). Campanha ativa perdendo veiculação. Equipe de campo acionada às 07:14.',
    categoria:ALERT_CATEGORY.OPERACIONAL, severidade:SEVERITY.CRITICAL, estado:OPERATIONAL_STATE.CRITICAL,
    prioridade:PRIORITY.URGENT, sla:'2h', owner:'Ops São Paulo',
    impacto:'R$ 4.200/mês — campanha Grupo Fast Moda parada', status:'Em andamento',
    regioesAfetadas:['São Paulo'], lido:false,
    acao:'Verificação de campo acionada — retorno previsto em 4h',
    historico:[
      { tempo:'07:14', evento:'Alerta criado — sem sinal detectado'   },
      { tempo:'07:22', evento:'Escalado para Ops SP'                  },
      { tempo:'07:45', evento:'Equipe de campo notificada'            },
      { tempo:'08:30', evento:'Técnico a caminho — ETA 2h'            },
    ],
    timestamp:'2026-05-19T07:14:00Z',
  },
  {
    id:'alrt-002', titulo:'3 contratos vencem nos próximos 10 dias',
    descricao:'CTR-2847, CTR-2901 e CTR-1500 vencem entre 26/Mai e 03/Jun. Receita combinada de R$ 34.400/mês sem confirmação de renovação. Risco de churn significativo.',
    categoria:ALERT_CATEGORY.CONTRATO, severidade:SEVERITY.HIGH, estado:OPERATIONAL_STATE.WARNING,
    prioridade:PRIORITY.HIGH, sla:'8h', owner:'Comercial',
    impacto:'R$ 34.400/mês — R$ 412.800/ano em risco', status:'Em andamento',
    regioesAfetadas:['São Paulo', 'Rio de Janeiro', 'Rio Grande do Sul'], lido:false,
    acao:'Reuniões agendadas: Azul (amanhã), FastFood (hoje), Vitalis (esta semana)',
    historico:[
      { tempo:'06:00', evento:'Alerta automático de vencimento gerado'    },
      { tempo:'08:00', evento:'Notificado ao time Comercial'              },
      { tempo:'08:30', evento:'Reuniões agendadas para os 3 clientes'     },
    ],
    timestamp:'2026-05-19T06:00:00Z',
  },
  {
    id:'alrt-003', titulo:'RS — Ocupação 7,6pp abaixo da meta',
    descricao:'Rio Grande do Sul registra 67,4% de ocupação, com meta de 75%. 29 posições disponíveis sem pipeline ativo. Tendência de queda pelo 2º mês consecutivo.',
    categoria:ALERT_CATEGORY.REGIONAL, severidade:SEVERITY.MEDIUM, estado:OPERATIONAL_STATE.DEGRADED,
    prioridade:PRIORITY.HIGH, sla:'48h', owner:'Comercial RS',
    impacto:'R$ 8.200 de receita potencial parado / mês', status:'Monitorando',
    regioesAfetadas:['Rio Grande do Sul'], lido:false,
    acao:'Campanha de ativação regional iniciada — 3 leads qualificados identificados',
    historico:[
      { tempo:'ontem 09:00', evento:'Queda identificada no relatório semanal' },
      { tempo:'ontem 14:00', evento:'Comercial RS notificado'                 },
      { tempo:'hoje 08:00',  evento:'Campanha de ativação iniciada'           },
    ],
    timestamp:'2026-05-19T08:00:00Z',
  },
  {
    id:'alrt-004', titulo:'Módulo de inteligência regional operando lento',
    descricao:'Tempo de resposta do módulo de análise regional está em 890ms — 3x acima do normal. Relatórios regionais podem apresentar atraso de até 5 minutos.',
    categoria:ALERT_CATEGORY.SISTEMA, severidade:SEVERITY.MEDIUM, estado:OPERATIONAL_STATE.DEGRADED,
    prioridade:PRIORITY.NORMAL, sla:'4h', owner:'Sistema',
    impacto:'Baixo — análise regional com atraso', status:'Monitorando',
    regioesAfetadas:['Todos'], lido:false,
    acao:'Otimização automática iniciada — monitorando melhora',
    historico:[
      { tempo:'há 2h', evento:'Performance degradada detectada'           },
      { tempo:'há 1h', evento:'Rotina de otimização iniciada automaticamente' },
    ],
    timestamp:'2026-05-19T07:30:00Z',
  },
  {
    id:'alrt-005', titulo:'Consolidação de relatório mensal em andamento',
    descricao:'Relatório mensal de maio está sendo consolidado. Processamento iniciado às 09:00. Estimativa de conclusão: 15 minutos.',
    categoria:ALERT_CATEGORY.SISTEMA, severidade:SEVERITY.INFO, estado:OPERATIONAL_STATE.SYNCING,
    prioridade:PRIORITY.LOW, sla:null, owner:'Sistema',
    impacto:'Nenhum', status:'Sincronizando',
    regioesAfetadas:['Todos'], lido:true,
    acao:null,
    historico:[
      { tempo:'09:00', evento:'Consolidação iniciada' },
      { tempo:'09:08', evento:'50% processado' },
    ],
    timestamp:'2026-05-19T09:00:00Z',
  },
  {
    id:'alrt-006', titulo:'RJ-0412 em manutenção — iluminação',
    descricao:'Ponto Presidente Vargas com falha de iluminação confirmada. Técnico agendado para hoje às 14h. Campanha suspensa preventivamente.',
    categoria:ALERT_CATEGORY.MANUTENCAO, severidade:SEVERITY.MEDIUM, estado:OPERATIONAL_STATE.DEGRADED,
    prioridade:PRIORITY.HIGH, sla:'24h', owner:'Ops Rio de Janeiro',
    impacto:'R$ 2.800/mês — campanha suspensa', status:'Em andamento',
    regioesAfetadas:['Rio de Janeiro'], lido:false,
    acao:'Manutenção agendada para 14h — retorno previsto: 48h',
    historico:[
      { tempo:'há 3h', evento:'Falha reportada pelo gestor de campo' },
      { tempo:'há 2h', evento:'Campanha suspensa preventivamente'    },
      { tempo:'há 1h', evento:'Técnico agendado para 14h'           },
    ],
    timestamp:'2026-05-19T06:30:00Z',
  },
];

/* ── DISTRIBUIÇÃO POR SEVERIDADE ─────────────────────────────── */
export const ALERTS_SEVERITY_OVERVIEW = {
  critical: { count:1, cor:'var(--v4p-danger)',      label:'Crítico'    },
  high:     { count:3, cor:'var(--v4p-warning)',     label:'Alto'       },
  medium:   { count:2, cor:'var(--v4p-accent)',      label:'Médio'      },
  low:      { count:0, cor:'var(--v4p-text-4)',      label:'Baixo'      },
  info:     { count:1, cor:'var(--v4p-info)',        label:'Informativo'},
};

/* ── ALERT TIMELINE ──────────────────────────────────────────── */
export const ALERT_TIMELINE_ITEMS = [
  { tempo:'09:00', evento:'Consolidação mensal iniciada',           tipo:'info',    id:'alrt-005' },
  { tempo:'08:30', evento:'Reuniões de renovação confirmadas',      tipo:'success', id:'alrt-002' },
  { tempo:'08:00', evento:'Alerta comercial — 3 contratos críticos',tipo:'warning', id:'alrt-002' },
  { tempo:'07:45', evento:'Técnico de campo acionado SP-2241',      tipo:'danger',  id:'alrt-001' },
  { tempo:'07:30', evento:'Módulo regional com baixo desempenho',   tipo:'warning', id:'alrt-004' },
  { tempo:'07:14', evento:'Ponto SP-2241 — sem comunicação',        tipo:'danger',  id:'alrt-001' },
  { tempo:'06:30', evento:'RJ-0412 falha de iluminação reportada',  tipo:'warning', id:'alrt-006' },
  { tempo:'06:00', evento:'Alertas de vencimento gerados (3)',       tipo:'warning', id:'alrt-002' },
  { tempo:'ontem 22:00', evento:'Sincronização diária concluída',   tipo:'info',    id:null        },
  { tempo:'ontem 15:00', evento:'Alerta RS — ocupação abaixo meta', tipo:'warning', id:'alrt-003' },
];

/* ── ALERT RECOMMENDATIONS ───────────────────────────────────── */
export const ALERT_RECOMMENDATIONS = [
  { id:'ar-1', icone:'crisis_alert',   titulo:'Verificar SP-2241 imediatamente',       descricao:'Ponto premium sem sinal há 48h. Técnico a caminho. Atualizar cliente sobre suspensão preventiva da campanha.', prazo:'Hoje',          cor:'var(--v4p-danger)' },
  { id:'ar-2', icone:'autorenew',      titulo:'Finalizar renovações antes do vencimento',descricao:'CTR-2847 vence em 7 dias. Reunião confirmada para amanhã. Preparar proposta com bundle expandido.',           prazo:'Amanhã',        cor:'var(--v4p-warning)'},
  { id:'ar-3', icone:'map',            titulo:'Acionar carteira RS com urgência',       descricao:'29 posições ociosas. Pipeline insuficiente. Marcos Viana deve iniciar abordagem ativa imediatamente.',         prazo:'Esta semana',   cor:'var(--v4p-accent)' },
  { id:'ar-4', icone:'build',          titulo:'Monitorar RJ-0412 após manutenção',      descricao:'Técnico confirma disponibilidade em 48h. Validar reativação da campanha junto ao cliente.',                   prazo:'Em 48h',        cor:'var(--v4p-info)'   },
];
