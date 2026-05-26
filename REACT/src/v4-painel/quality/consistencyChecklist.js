/* ═══════════════════════════════════════════════════════════════
   CONSISTENCY CHECKLIST — V4 PAINEL QUALITY
   Critérios de consistência do design system.
═══════════════════════════════════════════════════════════════ */

export const CONSISTENCY_CHECKLIST = [
  { id:'C-001', area:'Componentes',  item:'Todos os componentes leaf são envolvidos em React.memo()',           status:'pass', critical:true  },
  { id:'C-002', area:'Componentes',  item:'Nenhum componente aceita props genéricas (catch-all style/className sem limite)', status:'pass', critical:false },
  { id:'C-003', area:'Componentes',  item:'StatusBadge usado consistentemente para todos os estados',          status:'pass', critical:true  },
  { id:'C-004', area:'Componentes',  item:'ActionButton é a única fonte de botões de ação do sistema',         status:'pass', critical:false },
  { id:'C-005', area:'Componentes',  item:'SectionHeader usado em todas as seções com título',                 status:'pass', critical:false },

  { id:'C-006', area:'Dados',        item:'Datas relativas usam mesmo padrão ("há X min", "em X dias")',       status:'pass', critical:false },
  { id:'C-007', area:'Dados',        item:'Valores monetários sempre formatados em pt-BR (R$ 1.000)',          status:'pass', critical:true  },
  { id:'C-008', area:'Dados',        item:'Percentuais sempre com % e sem casas decimais desnecessárias',      status:'pass', critical:false },
  { id:'C-009', area:'Dados',        item:'Códigos de placa sempre em v4p-mono (SP-0001)',                     status:'pass', critical:false },

  { id:'C-010', area:'Layout',       item:'Todas as páginas têm header padronizado (título + subtítulo + ação)',status:'pass', critical:true  },
  { id:'C-011', area:'Layout',       item:'Section labels são sempre 9px uppercase letter-spacing 0.12em',     status:'pass', critical:false },
  { id:'C-012', area:'Layout',       item:'Gap entre seções é 20px em todas as páginas',                       status:'pass', critical:false },
  { id:'C-013', area:'Layout',       item:'Grids usam classes .v4p-dash-grid-* ou grid inline consistentes',   status:'pass', critical:false },

  { id:'C-014', area:'Animações',    item:'Barras animam com transition "width 0.6-0.7s var(--v4p-ease)"',    status:'pass', critical:false },
  { id:'C-015', area:'Animações',    item:'Páginas entram com v4p-fade-in 250ms',                              status:'pass', critical:false },
  { id:'C-016', area:'Animações',    item:'Hover states usam background card-hover com transition t-fast',     status:'pass', critical:false },

  { id:'C-017', area:'Isolamento',   item:'Nenhum arquivo v4-painel importa de fora de v4-painel/ (exceto react)', status:'pass', critical:true },
  { id:'C-018', area:'Isolamento',   item:'Todos os mocks estão em arquivos *MockData.js isolados',            status:'pass', critical:true  },
];

export function getConsistencyScore() {
  const total  = CONSISTENCY_CHECKLIST.length;
  const passed = CONSISTENCY_CHECKLIST.filter(c => c.status === 'pass').length;
  const criticalFailed = CONSISTENCY_CHECKLIST.filter(c => c.status !== 'pass' && c.critical).length;
  return { total, passed, score: Math.round((passed / total) * 100), criticalFailed, ready: criticalFailed === 0 };
}
