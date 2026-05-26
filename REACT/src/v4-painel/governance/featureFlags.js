/* ═══════════════════════════════════════════════════════════════
   FEATURE FLAGS — V4 PAINEL GOVERNANCE
   Sistema de controle de rollout progressivo.
   Em produção: conectar ao sistema de feature flags da empresa.
   Nesta etapa: todos os flags são locais e estáticos.
═══════════════════════════════════════════════════════════════ */

export const FLAG_STATUS = {
  DISABLED:    'disabled',   // Desativado para todos os usuários
  INTERNAL:    'internal',   // Ativo apenas para equipe interna
  BETA:        'beta',       // Ativo para usuários beta selecionados
  REGIONAL:    'regional',   // Ativo para regiões específicas
  FULL:        'full',       // Ativo para 100% dos usuários
};

/* Definição de todos os feature flags do v4-painel */
export const FEATURE_FLAGS = {
  /* ── Shell e Foundation ─────────────────────────────────────── */
  v4_shell: {
    id:          'v4_shell',
    label:       'Shell V4',
    description: 'Ativa o shell visual premium v4 (sidebar, topbar, layout)',
    status:      FLAG_STATUS.INTERNAL,
    phase:       1,
    rolloutTarget: '2026-06-01',
    dependencies: [],
    team:        'Frontend',
    risk:        'medium',
  },

  /* ── Páginas Fase 1 ──────────────────────────────────────────── */
  v4_dashboard: {
    id:          'v4_dashboard',
    label:       'Dashboard Executivo',
    description: 'Ativa a nova dashboard com KPIs, análise executiva e alertas',
    status:      FLAG_STATUS.INTERNAL,
    phase:       1,
    rolloutTarget: '2026-06-15',
    dependencies: ['v4_shell'],
    team:        'Frontend + Data',
    risk:        'medium',
  },

  /* ── Páginas Fase 2 ──────────────────────────────────────────── */
  v4_operations: {
    id:          'v4_operations',
    label:       'Operações',
    description: 'Central operacional com runtime de módulos e feed ao vivo',
    status:      FLAG_STATUS.DISABLED,
    phase:       2,
    rolloutTarget: '2026-07-01',
    dependencies: ['v4_dashboard'],
    team:        'Frontend + Ops',
    risk:        'high',
  },

  v4_inventory: {
    id:          'v4_inventory',
    label:       'Inventário',
    description: 'Painel de ativos OOH com filtros, tabela e detalhe de placa',
    status:      FLAG_STATUS.DISABLED,
    phase:       2,
    rolloutTarget: '2026-07-01',
    dependencies: ['v4_dashboard'],
    team:        'Frontend + Backend',
    risk:        'medium',
  },

  V4_INVENTORY_REAL_DATA: {
    id:          'V4_INVENTORY_REAL_DATA',
    label:       'Inventário — Dados Reais',
    description: 'Liga integração real com /placas da API no Inventário v4. Ativar via VITE_V4_INVENTORY_REAL_DATA=true ou localStorage v4_inv_real=true.',
    status:      FLAG_STATUS.INTERNAL,
    phase:       2,
    rolloutTarget: '2026-07-01',
    dependencies: ['v4_inventory'],
    team:        'Frontend + Backend',
    risk:        'medium',
    runtimeOverride: 'localStorage:v4_inv_real | env:VITE_V4_INVENTORY_REAL_DATA',
  },

  v4_alerts: {
    id:          'v4_alerts',
    label:       'Central de Alertas',
    description: 'Central de alertas com severidade, detalhe e recomendações',
    status:      FLAG_STATUS.DISABLED,
    phase:       2,
    rolloutTarget: '2026-07-15',
    dependencies: ['v4_dashboard'],
    team:        'Frontend + DevOps',
    risk:        'medium',
  },

  /* ── Páginas Fase 3 ──────────────────────────────────────────── */
  v4_commercial: {
    id:          'v4_commercial',
    label:       'Comercial',
    description: 'Pipeline, oportunidades, receita e inteligência comercial',
    status:      FLAG_STATUS.DISABLED,
    phase:       3,
    rolloutTarget: '2026-08-01',
    dependencies: ['v4_dashboard', 'v4_inventory'],
    team:        'Frontend + Comercial + Data',
    risk:        'medium',
  },

  v4_contracts: {
    id:          'v4_contracts',
    label:       'Contratos',
    description: 'Gestão de contratos com risco, renovação e impacto financeiro',
    status:      FLAG_STATUS.DISABLED,
    phase:       3,
    rolloutTarget: '2026-08-01',
    dependencies: ['v4_commercial'],
    team:        'Frontend + Backend',
    risk:        'high',
  },

  /* ── Páginas Fase 4 ──────────────────────────────────────────── */
  v4_reports: {
    id:          'v4_reports',
    label:       'Relatórios',
    description: 'Analytics executivos com visualizações e exportação',
    status:      FLAG_STATUS.DISABLED,
    phase:       4,
    rolloutTarget: '2026-09-01',
    dependencies: ['v4_commercial', 'v4_inventory'],
    team:        'Frontend + Data',
    risk:        'low',
  },

  v4_map: {
    id:          'v4_map',
    label:       'Mapa Operacional',
    description: 'Mapa visual enterprise com heatmap regional e oportunidades',
    status:      FLAG_STATUS.DISABLED,
    phase:       4,
    rolloutTarget: '2026-09-15',
    dependencies: ['v4_inventory', 'v4_operations'],
    team:        'Frontend + GIS',
    risk:        'medium',
  },

  /* ── Páginas Fase 5 ──────────────────────────────────────────── */
  v4_campaigns: {
    id:          'v4_campaigns',
    label:       'Campanhas',
    description: 'Gestão de campanhas em veiculação e agendamentos',
    status:      FLAG_STATUS.DISABLED,
    phase:       5,
    rolloutTarget: '2026-11-01',
    dependencies: ['v4_commercial', 'v4_inventory'],
    team:        'Frontend + Ops',
    risk:        'medium',
  },

  v4_legacy_removal: {
    id:          'v4_legacy_removal',
    label:       'Remoção do sistema legado',
    description: 'Desativa rotas e componentes do sistema anterior',
    status:      FLAG_STATUS.DISABLED,
    phase:       5,
    rolloutTarget: '2027-01-01',
    dependencies: ['v4_campaigns', 'v4_reports', 'v4_map'],
    team:        'Tech Lead + Frontend + QA',
    risk:        'critical',
  },
};

/* Verificações de flag */
export function isFlagEnabled(flagId, userRole = 'viewer', overrides = {}) {
  if (overrides[flagId] !== undefined) return overrides[flagId];
  const flag = FEATURE_FLAGS[flagId];
  if (!flag) return false;
  if (flag.status === FLAG_STATUS.FULL) return true;
  if (flag.status === FLAG_STATUS.INTERNAL && userRole === 'admin') return true;
  if (flag.status === FLAG_STATUS.BETA && ['admin', 'manager'].includes(userRole)) return true;
  return false;
}

export function getFlagsByPhase(phase) {
  return Object.values(FEATURE_FLAGS).filter(f => f.phase === phase);
}

export function getEnabledFlags(userRole = 'viewer') {
  return Object.values(FEATURE_FLAGS).filter(f => isFlagEnabled(f.id, userRole));
}
