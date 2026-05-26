/* ─── ESTADOS OPERACIONAIS — FOUNDATION V4 PAINEL ───────────── */

export const OPERATIONAL_STATE = {
  HEALTHY:  'healthy',
  WARNING:  'warning',
  CRITICAL: 'critical',
  DEGRADED: 'degraded',
  PENDING:  'pending',
  SYNCING:  'syncing',
  READONLY: 'readonly',
  OFFLINE:  'offline',
};

export const OPERATIONAL_STATE_META = {
  [OPERATIONAL_STATE.HEALTHY]: {
    id:          'healthy',
    label:       'Operacional',
    description: 'Todos os sistemas funcionando dentro dos parâmetros esperados.',
    cssClass:    'v4p-state-healthy',
    dotClass:    'v4p-state-healthy-dot',
    bgClass:     'v4p-state-healthy-bg',
    color:       'var(--v4p-success)',
    colorSoft:   'var(--v4p-success-soft)',
    icon:        'check_circle',
    priority:    0,
    canAlert:    false,
    canTransact: true,
  },

  [OPERATIONAL_STATE.WARNING]: {
    id:          'warning',
    label:       'Atenção',
    description: 'Situações que requerem monitoramento. Operações continuam com restrições.',
    cssClass:    'v4p-state-warning',
    dotClass:    'v4p-state-warning-dot',
    bgClass:     'v4p-state-warning-bg',
    color:       'var(--v4p-warning)',
    colorSoft:   'var(--v4p-warning-soft)',
    icon:        'warning',
    priority:    1,
    canAlert:    true,
    canTransact: true,
  },

  [OPERATIONAL_STATE.CRITICAL]: {
    id:          'critical',
    label:       'Crítico',
    description: 'Impacto direto nas operações. Ação imediata necessária.',
    cssClass:    'v4p-state-critical',
    dotClass:    'v4p-state-critical-dot',
    bgClass:     'v4p-state-critical-bg',
    color:       'var(--v4p-danger)',
    colorSoft:   'var(--v4p-danger-soft)',
    icon:        'error',
    priority:    2,
    canAlert:    true,
    canTransact: false,
  },

  [OPERATIONAL_STATE.DEGRADED]: {
    id:          'degraded',
    label:       'Lento',
    description: 'Desempenho abaixo do esperado. Funcionalidades parcialmente disponíveis.',
    cssClass:    'v4p-state-degraded',
    dotClass:    'v4p-state-degraded-dot',
    bgClass:     'v4p-state-degraded-bg',
    color:       'var(--v4p-warning)',
    colorSoft:   'var(--v4p-warning-soft)',
    icon:        'trending_down',
    priority:    1,
    canAlert:    true,
    canTransact: true,
  },

  [OPERATIONAL_STATE.PENDING]: {
    id:          'pending',
    label:       'Aguardando',
    description: 'Operação iniciada. Aguardando confirmação ou processamento.',
    cssClass:    'v4p-state-pending',
    dotClass:    'v4p-state-pending-dot',
    bgClass:     'v4p-state-pending-bg',
    color:       'var(--v4p-text-3)',
    colorSoft:   'var(--v4p-border)',
    icon:        'hourglass_empty',
    priority:    0,
    canAlert:    false,
    canTransact: false,
  },

  [OPERATIONAL_STATE.SYNCING]: {
    id:          'syncing',
    label:       'Atualizando',
    description: 'Dados em atualização. Resultado disponível em instantes.',
    cssClass:    'v4p-state-syncing',
    dotClass:    'v4p-state-syncing-dot',
    bgClass:     'v4p-state-syncing-bg',
    color:       'var(--v4p-accent)',
    colorSoft:   'var(--v4p-accent-soft)',
    icon:        'sync',
    priority:    0,
    canAlert:    false,
    canTransact: false,
  },

  [OPERATIONAL_STATE.READONLY]: {
    id:          'readonly',
    label:       'Somente leitura',
    description: 'Modo de visualização ativo. Alterações temporariamente desabilitadas.',
    cssClass:    'v4p-state-readonly',
    dotClass:    'v4p-state-readonly-dot',
    bgClass:     'v4p-state-readonly-bg',
    color:       'var(--v4p-info)',
    colorSoft:   'var(--v4p-info-soft)',
    icon:        'visibility',
    priority:    0,
    canAlert:    false,
    canTransact: false,
  },

  [OPERATIONAL_STATE.OFFLINE]: {
    id:          'offline',
    label:       'Indisponível',
    description: 'Conexão com o sistema interrompida. Tente novamente em instantes.',
    cssClass:    'v4p-state-offline',
    dotClass:    'v4p-state-offline-dot',
    bgClass:     'v4p-state-offline-bg',
    color:       'var(--v4p-text-4)',
    colorSoft:   'var(--v4p-border)',
    icon:        'cloud_off',
    priority:    2,
    canAlert:    true,
    canTransact: false,
  },
};

export function getStateMeta(state) {
  return OPERATIONAL_STATE_META[state] ?? OPERATIONAL_STATE_META[OPERATIONAL_STATE.PENDING];
}

export function isOperational(state) {
  return state === OPERATIONAL_STATE.HEALTHY || state === OPERATIONAL_STATE.DEGRADED;
}

export function isBlocking(state) {
  return state === OPERATIONAL_STATE.CRITICAL || state === OPERATIONAL_STATE.OFFLINE;
}
