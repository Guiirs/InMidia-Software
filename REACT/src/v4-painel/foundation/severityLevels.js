/* ─── NÍVEIS DE SEVERIDADE — FOUNDATION V4 PAINEL ───────────── */

export const SEVERITY = {
  INFO:     'info',
  LOW:      'low',
  MEDIUM:   'medium',
  HIGH:     'high',
  CRITICAL: 'critical',
};

export const SEVERITY_META = {
  [SEVERITY.INFO]: {
    id:       'info',
    label:    'Informativo',
    short:    'Info',
    color:    'var(--v4p-info)',
    soft:     'var(--v4p-info-soft)',
    order:    0,
    escalate: false,
  },
  [SEVERITY.LOW]: {
    id:       'low',
    label:    'Baixa prioridade',
    short:    'Baixo',
    color:    'var(--v4p-text-3)',
    soft:     'var(--v4p-border)',
    order:    1,
    escalate: false,
  },
  [SEVERITY.MEDIUM]: {
    id:       'medium',
    label:    'Prioridade média',
    short:    'Médio',
    color:    'var(--v4p-warning)',
    soft:     'var(--v4p-warning-soft)',
    order:    2,
    escalate: false,
  },
  [SEVERITY.HIGH]: {
    id:       'high',
    label:    'Alta prioridade',
    short:    'Alto',
    color:    'var(--v4p-danger)',
    soft:     'var(--v4p-danger-soft)',
    order:    3,
    escalate: true,
  },
  [SEVERITY.CRITICAL]: {
    id:       'critical',
    label:    'Crítico — ação imediata',
    short:    'Crítico',
    color:    'var(--v4p-danger)',
    soft:     'var(--v4p-danger-soft)',
    order:    4,
    escalate: true,
  },
};

export function getSeverityMeta(severity) {
  return SEVERITY_META[severity] ?? SEVERITY_META[SEVERITY.INFO];
}

export function sortBySeverity(items, key = 'severity') {
  return [...items].sort(
    (a, b) => (SEVERITY_META[b[key]]?.order ?? 0) - (SEVERITY_META[a[key]]?.order ?? 0)
  );
}
