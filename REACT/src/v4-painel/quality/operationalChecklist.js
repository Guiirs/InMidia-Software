/* ═══════════════════════════════════════════════════════════════
   OPERATIONAL CHECKLIST — V4 PAINEL QUALITY
   Critérios de qualidade operacional e de produto.
═══════════════════════════════════════════════════════════════ */

export const OPERATIONAL_CHECKLIST = [
  /* ── LINGUAGEM ──────────────────────────────────────────────── */
  { id:'O-001', area:'Linguagem',    item:'Nenhum termo técnico exposto na UI (payload, endpoint, cache, bridge)',   status:'pass', critical:true  },
  { id:'O-002', area:'Linguagem',    item:'Todos os textos de status usam linguagem operacional (Sincronizando, Ocupado, etc.)', status:'pass', critical:true  },
  { id:'O-003', area:'Linguagem',    item:'Alertas descrevem impacto em termos de negócio (R$, placas, regiões)',    status:'pass', critical:true  },
  { id:'O-004', area:'Linguagem',    item:'Recomendações são acionáveis e em primeira pessoa operacional',          status:'pass', critical:false },
  { id:'O-005', area:'Linguagem',    item:'Períodos são expressos de forma humana ("há 42 segundos", "em 7 dias")', status:'pass', critical:false },

  /* ── ESTADOS GLOBAIS ────────────────────────────────────────── */
  { id:'O-006', area:'Estados',      item:'Status global sempre visível no topbar',                                 status:'pass', critical:true  },
  { id:'O-007', area:'Estados',      item:'Mudança de estado propagada para todos os componentes dependentes',      status:'pass', critical:true  },
  { id:'O-008', area:'Estados',      item:'Estado crítico resulta em destaque visual imediato na sidebar/topbar',   status:'pass', critical:true  },

  /* ── DADOS ──────────────────────────────────────────────────── */
  { id:'O-009', area:'Dados',        item:'Todos os dados são mockados localmente (nenhuma chamada de rede)',       status:'pass', critical:true  },
  { id:'O-010', area:'Dados',        item:'Dados mockados refletem realidade operacional do InMidia OOH',          status:'pass', critical:false },
  { id:'O-011', area:'Dados',        item:'Mocks incluem casos de borda (alertas críticos, vencimento iminente)',   status:'pass', critical:false },

  /* ── ISOLAMENTO ─────────────────────────────────────────────── */
  { id:'O-012', area:'Isolamento',   item:'Nenhum import de services/ reais ou contextos globais',                 status:'pass', critical:true  },
  { id:'O-013', area:'Isolamento',   item:'Nenhum uso de React Query ou @tanstack',                                status:'pass', critical:true  },
  { id:'O-014', area:'Isolamento',   item:'v4-painel funciona completamente standalone',                           status:'pass', critical:true  },

  /* ── INTELIGÊNCIA ───────────────────────────────────────────── */
  { id:'O-015', area:'Inteligência', item:'Insights e recomendações têm impacto financeiro quantificado',         status:'pass', critical:false },
  { id:'O-016', area:'Inteligência', item:'Recomendações têm prazo e responsável definidos',                       status:'pass', critical:false },
  { id:'O-017', area:'Inteligência', item:'Badge "IA ATIVA" presente nos painéis de inteligência',                 status:'pass', critical:false },
];

export function getOperationalScore() {
  const total  = OPERATIONAL_CHECKLIST.length;
  const passed = OPERATIONAL_CHECKLIST.filter(c => c.status === 'pass').length;
  const criticalFailed = OPERATIONAL_CHECKLIST.filter(c => c.status !== 'pass' && c.critical).length;
  return { total, passed, score: Math.round((passed / total) * 100), criticalFailed, ready: criticalFailed === 0 };
}
