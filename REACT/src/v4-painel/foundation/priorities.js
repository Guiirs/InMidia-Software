/* ─── PRIORIDADES OPERACIONAIS — FOUNDATION V4 PAINEL ───────── */

export const PRIORITY = {
  URGENT:  'urgent',
  HIGH:    'high',
  NORMAL:  'normal',
  LOW:     'low',
  BACKLOG: 'backlog',
};

export const PRIORITY_META = {
  [PRIORITY.URGENT]: {
    id:       'urgent',
    label:    'Urgente',
    badge:    'U',
    color:    'var(--v4p-danger)',
    soft:     'var(--v4p-danger-soft)',
    order:    0,
    sla:      '2h',
  },
  [PRIORITY.HIGH]: {
    id:       'high',
    label:    'Alta',
    badge:    'A',
    color:    'var(--v4p-warning)',
    soft:     'var(--v4p-warning-soft)',
    order:    1,
    sla:      '8h',
  },
  [PRIORITY.NORMAL]: {
    id:       'normal',
    label:    'Normal',
    badge:    'N',
    color:    'var(--v4p-accent)',
    soft:     'var(--v4p-accent-soft)',
    order:    2,
    sla:      '48h',
  },
  [PRIORITY.LOW]: {
    id:       'low',
    label:    'Baixa',
    badge:    'B',
    color:    'var(--v4p-text-3)',
    soft:     'var(--v4p-border)',
    order:    3,
    sla:      '7d',
  },
  [PRIORITY.BACKLOG]: {
    id:       'backlog',
    label:    'Backlog',
    badge:    '-',
    color:    'var(--v4p-text-4)',
    soft:     'var(--v4p-border-soft)',
    order:    4,
    sla:      null,
  },
};

export function getPriorityMeta(priority) {
  return PRIORITY_META[priority] ?? PRIORITY_META[PRIORITY.NORMAL];
}
