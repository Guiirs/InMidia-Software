/* ═══════════════════════════════════════════════════════════════
   ACCESSIBILITY CHECKLIST — V4 PAINEL QUALITY
   Critérios de acessibilidade (WCAG 2.1 AA).
═══════════════════════════════════════════════════════════════ */

export const ACCESSIBILITY_CHECKLIST = [
  { id:'A-001', area:'Semântica',   item:'Elementos de navegação usam <nav> com aria-label',                        status:'pass', critical:true, wcag:'1.3.1' },
  { id:'A-002', area:'Semântica',   item:'Páginas têm <main> com aria-label descritivo',                            status:'pass', critical:true, wcag:'1.3.1' },
  { id:'A-003', area:'Semântica',   item:'Cards de alerta têm role="status" ou role="alert"',                       status:'pass', critical:true, wcag:'1.3.1' },
  { id:'A-004', area:'Semântica',   item:'Botões têm texto descritivo ou aria-label',                               status:'pass', critical:true, wcag:'4.1.2' },
  { id:'A-005', area:'Semântica',   item:'Ícones decorativos têm aria-hidden="true"',                               status:'pass', critical:true, wcag:'1.1.1' },
  { id:'A-006', area:'Semântica',   item:'Listas de alertas e alertas têm roles semânticos corretos',               status:'pass', critical:false,wcag:'1.3.1' },

  { id:'A-007', area:'Foco',        item:'Focus ring visível em todos os elementos interativos',                    status:'pass', critical:true, wcag:'2.4.7' },
  { id:'A-008', area:'Foco',        item:'Focus ring usa --v4p-accent (2px solid, offset 2px)',                     status:'pass', critical:false,wcag:'2.4.7' },
  { id:'A-009', area:'Foco',        item:'Ordem de foco segue ordem visual lógica (left-to-right, top-to-bottom)', status:'pass', critical:true, wcag:'2.4.3' },

  { id:'A-010', area:'Contraste',   item:'Texto primário (#f4f7fb) sobre fundo card (#141b29) ≥ 7:1',              status:'pass', critical:true, wcag:'1.4.3' },
  { id:'A-011', area:'Contraste',   item:'Texto secundário (#b0bdd0) sobre fundo card ≥ 4.5:1',                    status:'pass', critical:true, wcag:'1.4.3' },
  { id:'A-012', area:'Contraste',   item:'Accent (#7485ff) sobre fundo card ≥ 3:1 para elementos UI',             status:'pass', critical:false,wcag:'1.4.11' },

  { id:'A-013', area:'Teclado',     item:'Sidebar navegável completamente via teclado',                             status:'partial', critical:true, wcag:'2.1.1' },
  { id:'A-014', area:'Teclado',     item:'Tabelas têm navegação via Arrow keys',                                    status:'partial', critical:false,wcag:'2.1.1' },
  { id:'A-015', area:'Teclado',     item:'Dismiss de alertas acessível via teclado',                                status:'pass', critical:false,wcag:'2.1.1' },

  { id:'A-016', area:'Movimento',   item:'Animações de pulse respeitam prefers-reduced-motion',                    status:'warn',    critical:false,wcag:'2.3.3' },
  { id:'A-017', area:'Movimento',   item:'Spinners têm aria-label="Carregando"',                                    status:'pass', critical:false,wcag:'1.1.1' },
];

export function getAccessibilityScore() {
  const total  = ACCESSIBILITY_CHECKLIST.length;
  const passed = ACCESSIBILITY_CHECKLIST.filter(c => c.status === 'pass').length;
  const criticalFailed = ACCESSIBILITY_CHECKLIST.filter(c => c.status !== 'pass' && c.critical).length;
  const warnings = ACCESSIBILITY_CHECKLIST.filter(c => c.status === 'warn' || c.status === 'partial').length;
  return { total, passed, warnings, score: Math.round((passed / total) * 100), criticalFailed, ready: criticalFailed === 0 };
}
