/* ═══════════════════════════════════════════════════════════════
   V4 PREVIEW PAGE — Painel de blueprint e governança
   Página especial de visualização do estado do v4-painel.
   Acessível via navegação interna — não exposta em produção.
═══════════════════════════════════════════════════════════════ */
import { memo, useState } from 'react';
import PreviewStatusPanel   from './PreviewStatusPanel.jsx';
import PreviewLauncher      from './PreviewLauncher.jsx';
import { PREVIEW_BUILD_INFO } from './previewMockState.js';
import { HARD_BOUNDARIES, SOFT_BOUNDARIES } from '../governance/integrationBoundaries.js';
import { getOverallQualityScore } from '../quality/index.js';
import { getLivePages } from '../governance/pageRegistry.js';
import '../styles/globals.css';

function BoundaryRow({ boundary, type }) {
  const color = type === 'hard' ? 'var(--v4p-danger)' : 'var(--v4p-warning)';
  return (
    <div style={{ padding:'8px 10px', borderRadius:'var(--v4p-r-md)', background:`${color}08`, border:`1px solid ${color}20`, marginBottom:6 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize:12, color }}>
          {type === 'hard' ? 'block' : 'warning'}
        </span>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--v4p-text-1)' }}>{boundary.id}</span>
        <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, color, textTransform:'uppercase' }}>{type === 'hard' ? 'BLOQUEANTE' : 'AVISO'}</span>
      </div>
      <p style={{ margin:0, fontSize:10, color:'var(--v4p-text-3)', lineHeight:1.5 }}>{boundary.rule}</p>
    </div>
  );
}

function V4PreviewPage({ onNavigate, activePageId }) {
  const [tab, setTab] = useState('status');
  const quality       = getOverallQualityScore();
  const livePages     = getLivePages();

  const TABS = [
    { id:'status',    label:'Status',     icon:'verified'    },
    { id:'launcher',  label:'Launcher',   icon:'rocket_launch'},
    { id:'boundaries',label:'Boundaries', icon:'security'    },
    { id:'quality',   label:'Qualidade',  icon:'fact_check'  },
  ];

  return (
    <div className="v4p-root" style={{ display:'flex', flexDirection:'column', gap:16, minHeight:'100vh', padding:24, background:'var(--v4p-bg-page)', animation:'v4p-fade-in 250ms var(--v4p-ease) both' }}>
      {/* Header */}
      <header style={{ paddingBottom:14, borderBottom:'1px solid var(--v4p-border-soft)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'var(--v4p-text-1)', letterSpacing:'-0.02em' }}>Blueprint V4</h1>
            <div style={{ fontSize:11, color:'var(--v4p-text-4)', marginTop:3 }}>
              {PREVIEW_BUILD_INFO.version} · {PREVIEW_BUILD_INFO.buildDate} · {PREVIEW_BUILD_INFO.totalFiles} arquivos · {livePages.length} páginas ativas
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:'var(--v4p-r-full)', background:'var(--v4p-intelligence-soft)', border:'1px solid rgba(139,92,246,0.25)', fontSize:11, fontWeight:600, color:'var(--v4p-intelligence)' }}>
            <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize:14 }}>schema</span>
            InMidia OOH — Futuro oficial
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginTop:14, background:'var(--v4p-bg-input)', borderRadius:'var(--v4p-r-md)', padding:'3px', border:'1px solid var(--v4p-border)', width:'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:'var(--v4p-r-sm)', border:'none', cursor:'pointer', fontSize:11, fontFamily:'var(--v4p-font)', fontWeight:500, background: tab === t.id ? 'var(--v4p-bg-card)' : 'transparent', color: tab === t.id ? 'var(--v4p-text-1)' : 'var(--v4p-text-4)', transition:'background var(--v4p-t-fast)' }}>
              <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize:14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab: Status */}
      {tab === 'status' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <PreviewStatusPanel />
          {/* Partes implementadas */}
          <div className="v4p-surface-card" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--v4p-text-2)', marginBottom:12, paddingBottom:10, borderBottom:'1px solid var(--v4p-border-soft)' }}>Partes implementadas</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8 }}>
              {[
                { part:'Parte 1', title:'Foundation',     desc:'Shell, tokens, estados, providers, navigation', done:true },
                { part:'Parte 2', title:'Dashboard',      desc:'KPIs, análise executiva, regional, alertas',    done:true },
                { part:'Parte 3', title:'Operação & Inv.', desc:'Operações, inventário, mapa operacional',      done:true },
                { part:'Parte 4', title:'Comercial',      desc:'Pipeline, contratos, relatórios, alertas',     done:true },
                { part:'Parte 5', title:'Governança',     desc:'Blueprint, contratos, quality, preview',        done:true },
              ].map(p => (
                <div key={p.part} style={{ padding:'10px 12px', borderRadius:'var(--v4p-r-md)', background: p.done ? 'var(--v4p-success-xsoft)' : 'rgba(0,0,0,0.12)', border:`1px solid ${p.done ? 'var(--v4p-success-border)' : 'var(--v4p-border)'}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                    <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize:14, color: p.done ? 'var(--v4p-success)' : 'var(--v4p-text-4)' }}>{p.done ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span style={{ fontSize:10, fontWeight:700, color: p.done ? 'var(--v4p-success)' : 'var(--v4p-text-4)' }}>{p.part}</span>
                  </div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--v4p-text-1)', marginBottom:2 }}>{p.title}</div>
                  <div style={{ fontSize:9, color:'var(--v4p-text-4)', lineHeight:1.4 }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Launcher */}
      {tab === 'launcher' && (
        <PreviewLauncher activePage={activePageId} onNavigate={onNavigate} />
      )}

      {/* Tab: Boundaries */}
      {tab === 'boundaries' && (
        <div className="v4p-surface-card" style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--v4p-text-2)', marginBottom:4 }}>Limites de integração</div>
          <div style={{ fontSize:10, color:'var(--v4p-text-4)', marginBottom:12, paddingBottom:10, borderBottom:'1px solid var(--v4p-border-soft)' }}>Política arquitetural formal — {HARD_BOUNDARIES.length} regras bloqueantes, {SOFT_BOUNDARIES.length} recomendações</div>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--v4p-danger)', marginBottom:8 }}>Hard Boundaries — Bloqueantes</div>
          {HARD_BOUNDARIES.map(b => <BoundaryRow key={b.id} boundary={b} type="hard" />)}
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--v4p-warning)', margin:'12px 0 8px' }}>Soft Boundaries — Recomendações</div>
          {SOFT_BOUNDARIES.map(b => <BoundaryRow key={b.id} boundary={b} type="soft" />)}
        </div>
      )}

      {/* Tab: Qualidade */}
      {tab === 'quality' && (
        <div className="v4p-surface-card" style={{ padding:'14px 16px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--v4p-text-2)', marginBottom:12, paddingBottom:10, borderBottom:'1px solid var(--v4p-border-soft)' }}>
            Score de qualidade — {quality.summary}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:8 }}>
            {Object.entries(quality.breakdown).map(([key, score]) => {
              const labels = { visual:'Visual', operational:'Operacional', accessibility:'Acessibilidade', consistency:'Consistência', responsiveness:'Responsividade' };
              const color  = score >= 90 ? 'var(--v4p-success)' : score >= 75 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';
              return (
                <div key={key} style={{ padding:'12px', borderRadius:'var(--v4p-r-md)', background:`${color}08`, border:`1px solid ${color}25`, textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:800, color, lineHeight:1 }}>{score}%</div>
                  <div style={{ fontSize:10, color:'var(--v4p-text-3)', marginTop:4 }}>{labels[key]}</div>
                  <div style={{ width:'100%', height:3, borderRadius:'var(--v4p-r-full)', background:'var(--v4p-border)', overflow:'hidden', marginTop:8 }}>
                    <div style={{ height:'100%', width:`${score}%`, background:color, borderRadius:'var(--v4p-r-full)', transition:'width 0.7s' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:14, padding:'10px 14px', borderRadius:'var(--v4p-r-md)', background: quality.readyForRollout ? 'var(--v4p-success-xsoft)' : 'var(--v4p-warning-xsoft)', border:`1px solid ${quality.readyForRollout ? 'var(--v4p-success-border)' : 'var(--v4p-warning-border)'}`, display:'flex', alignItems:'center', gap:10 }}>
            <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize:18, color: quality.readyForRollout ? 'var(--v4p-success)' : 'var(--v4p-warning)' }}>
              {quality.readyForRollout ? 'check_circle' : 'warning'}
            </span>
            <span style={{ fontSize:12, fontWeight:600, color: quality.readyForRollout ? 'var(--v4p-success)' : 'var(--v4p-warning)' }}>
              {quality.readyForRollout
                ? 'Blueprint aprovado para início do rollout (Fase 1).'
                : `${quality.criticalFailed} critérios críticos precisam ser resolvidos antes do rollout.`
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(V4PreviewPage);
