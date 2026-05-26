/* ═══════════════════════════════════════════════════════════════
   VISUAL CHECKLIST — V4 PAINEL QUALITY
   Critérios de qualidade visual enterprise.
═══════════════════════════════════════════════════════════════ */

export const VISUAL_CHECKLIST = [
  /* ── TOKENS ────────────────────────────────────────────────── */
  { id:'V-001', area:'Tokens',       item:'Todos os valores de cor usam variáveis --v4p-*',               status:'pass', critical:true  },
  { id:'V-002', area:'Tokens',       item:'Nenhuma cor hardcoded (hex/rgb) nos componentes',              status:'pass', critical:true  },
  { id:'V-003', area:'Tokens',       item:'Espaçamentos usam variáveis --v4p-sp-* ou múltiplos de 4px',  status:'pass', critical:false },
  { id:'V-004', area:'Tokens',       item:'Raios de borda usam --v4p-r-* consistentemente',              status:'pass', critical:false },
  { id:'V-005', area:'Tokens',       item:'Sombras usam --v4p-shadow-* do sistema de elevações',         status:'pass', critical:false },

  /* ── TIPOGRAFIA ─────────────────────────────────────────────── */
  { id:'V-006', area:'Tipografia',   item:'Fonte principal é Inter (--v4p-font)',                         status:'pass', critical:true  },
  { id:'V-007', area:'Tipografia',   item:'Hierarquia tipográfica clara (h1 > h2 > label > body)',        status:'pass', critical:true  },
  { id:'V-008', area:'Tipografia',   item:'Rótulos de seção usam classe v4p-label (uppercase + tracking)',status:'pass', critical:false },
  { id:'V-009', area:'Tipografia',   item:'Métricas grandes usam classe v4p-metric (700 weight)',        status:'pass', critical:false },
  { id:'V-010', area:'Tipografia',   item:'Códigos de placa e IDs usam classe v4p-mono',                 status:'pass', critical:false },

  /* ── ESTADOS ────────────────────────────────────────────────── */
  { id:'V-011', area:'Estados',      item:'Todos os 8 estados operacionais têm cor e badge distintos',   status:'pass', critical:true  },
  { id:'V-012', area:'Estados',      item:'Estados críticos têm animação de pulse',                      status:'pass', critical:false },
  { id:'V-013', area:'Estados',      item:'Border-left colorido indica estado em tabelas e listas',      status:'pass', critical:false },

  /* ── SUPERFÍCIES ────────────────────────────────────────────── */
  { id:'V-014', area:'Superfícies',  item:'Cards usam v4p-surface-card com borda e shadow corretos',     status:'pass', critical:true  },
  { id:'V-015', area:'Superfícies',  item:'Hierarquia de fundo: page > shell > card > inner',            status:'pass', critical:true  },
  { id:'V-016', area:'Superfícies',  item:'Sidebar é visivelmente mais escura que o shell',              status:'pass', critical:false },

  /* ── DENSIDADE ──────────────────────────────────────────────── */
  { id:'V-017', area:'Densidade',    item:'Padding interno dos cards é 14-16px (não mais que 24px)',     status:'pass', critical:false },
  { id:'V-018', area:'Densidade',    item:'Gap entre seções é 16-20px (não empilhamento excessivo)',     status:'pass', critical:false },
  { id:'V-019', area:'Densidade',    item:'Tabelas têm row height de 36-44px (alta densidade)',          status:'pass', critical:false },

  /* ── SCROLLBAR ──────────────────────────────────────────────── */
  { id:'V-020', area:'Scrollbar',    item:'Scrollbar premium: width 5px, thumb var(--v4p-border-strong)',status:'pass', critical:false },
];

export function getVisualScore() {
  const total  = VISUAL_CHECKLIST.length;
  const passed = VISUAL_CHECKLIST.filter(c => c.status === 'pass').length;
  const criticalFailed = VISUAL_CHECKLIST.filter(c => c.status !== 'pass' && c.critical).length;
  return { total, passed, score: Math.round((passed / total) * 100), criticalFailed, ready: criticalFailed === 0 };
}
