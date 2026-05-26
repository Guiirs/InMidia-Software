/* ═══════════════════════════════════════════════════════════════
   RESPONSIVENESS CHECKLIST — V4 PAINEL QUALITY
   Critérios de responsividade e densidade enterprise.
═══════════════════════════════════════════════════════════════ */

export const RESPONSIVENESS_CHECKLIST = [
  /* ── WIDESCREEN (> 1280px) — target principal ───────────────── */
  { id:'R-001', breakpoint:'> 1280px', item:'Layout de 2-3 colunas ativo em todas as páginas',               status:'pass', critical:true  },
  { id:'R-002', breakpoint:'> 1280px', item:'KPI Grid exibe 4 colunas',                                       status:'pass', critical:true  },
  { id:'R-003', breakpoint:'> 1280px', item:'Sidebar expandida (220px) visível',                              status:'pass', critical:true  },
  { id:'R-004', breakpoint:'> 1280px', item:'Topbar exibe todos os controles (período, região, busca, status)',status:'pass', critical:true  },

  /* ── DESKTOP (1100px - 1280px) ──────────────────────────────── */
  { id:'R-005', breakpoint:'1100-1280px', item:'Grids "main" colapsam para 1 coluna',                        status:'pass', critical:true  },
  { id:'R-006', breakpoint:'1100-1280px', item:'KPI Grid mantém 4 colunas ou colapsa para 2',                 status:'pass', critical:false },
  { id:'R-007', breakpoint:'1100-1280px', item:'Sidebars de detalhe (Inventário, Mapa) se ocultam',           status:'pass', critical:false },

  /* ── TABLET (900px - 1100px) ────────────────────────────────── */
  { id:'R-008', breakpoint:'900-1100px',  item:'Grids de 2 colunas colapsam para 1',                          status:'pass', critical:true  },
  { id:'R-009', breakpoint:'900-1100px',  item:'Sidebar pode ser colapsada manualmente',                      status:'pass', critical:true  },

  /* ── DENSIDADE ───────────────────────────────────────────────── */
  { id:'R-010', breakpoint:'geral',       item:'Padding de cards: 12-16px (nunca > 24px)',                    status:'pass', critical:true  },
  { id:'R-011', breakpoint:'geral',       item:'Fonte base: 14px (nunca > 15px para body)',                   status:'pass', critical:false },
  { id:'R-012', breakpoint:'geral',       item:'Elementos da topbar não quebram linha em telas > 1100px',     status:'pass', critical:true  },
  { id:'R-013', breakpoint:'geral',       item:'Tabelas têm scroll horizontal quando necessário',             status:'pass', critical:true  },
  { id:'R-014', breakpoint:'geral',       item:'Day-brief chips têm overflow-x: auto com scrollbar oculta',   status:'pass', critical:false },

  /* ── MOBILE EXPLÍCITO (não é target principal) ───────────────── */
  { id:'R-015', breakpoint:'< 900px',     item:'Sistema não é mobile-first — degradação aceitável',           status:'warn', critical:false },
  { id:'R-016', breakpoint:'< 900px',     item:'Conteúdo crítico legível mesmo em mobile (texto, KPIs)',       status:'warn', critical:false },
];

export function getResponsivenessScore() {
  const total  = RESPONSIVENESS_CHECKLIST.length;
  const passed = RESPONSIVENESS_CHECKLIST.filter(c => c.status === 'pass').length;
  const criticalFailed = RESPONSIVENESS_CHECKLIST.filter(c => c.status !== 'pass' && c.critical).length;
  return { total, passed, score: Math.round((passed / total) * 100), criticalFailed, ready: criticalFailed === 0 };
}
