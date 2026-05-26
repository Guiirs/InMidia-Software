import { memo } from 'react';
import { getOverallQualityScore } from '../quality/index.js';
import { PAGE_ROLLOUT_SUMMARY, getLivePages, getPagesReadyForIntegration } from '../governance/pageRegistry.js';
import { COMPONENT_SUMMARY } from '../governance/componentRegistry.js';
import { PREVIEW_BUILD_INFO } from './previewMockState.js';

function ScoreRing({ score, label, size = 64 }) {
  const r    = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color= score >= 90 ? 'var(--v4p-success)' : score >= 70 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';
  const cx = size / 2;

  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--v4p-border)" strokeWidth={5} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.25} strokeLinecap="round"
          style={{ transition:'stroke-dasharray 0.7s' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:14, fontWeight:800, color, lineHeight:1 }}>{score}%</span>
        <span style={{ fontSize:8, color:'var(--v4p-text-4)', marginTop:1 }}>{label}</span>
      </div>
    </div>
  );
}

function StatChip({ label, value, color = 'var(--v4p-text-1)' }) {
  return (
    <div style={{ padding:'8px 12px', borderRadius:'var(--v4p-r-md)', background:'rgba(0,0,0,0.15)', border:'1px solid var(--v4p-border)', textAlign:'center' }}>
      <div style={{ fontSize:18, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:9, color:'var(--v4p-text-4)', marginTop:2 }}>{label}</div>
    </div>
  );
}

function PreviewStatusPanel() {
  const quality = getOverallQualityScore();
  const livePages = getLivePages();
  const readyPages = getPagesReadyForIntegration();

  return (
    <div className="v4p-surface-card" style={{ padding:'16px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:10, borderBottom:'1px solid var(--v4p-border-soft)' }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize:18, color:'var(--v4p-intelligence)' }}>verified</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--v4p-text-2)' }}>Status do blueprint</div>
          <div style={{ fontSize:10, color:'var(--v4p-text-4)' }}>{PREVIEW_BUILD_INFO.version} · {PREVIEW_BUILD_INFO.buildDate}</div>
        </div>
        <span style={{ padding:'3px 10px', borderRadius:'var(--v4p-r-full)', background: quality.readyForRollout ? 'var(--v4p-success-xsoft)' : 'var(--v4p-warning-xsoft)', color: quality.readyForRollout ? 'var(--v4p-success)' : 'var(--v4p-warning)', fontSize:10, fontWeight:700, border:`1px solid ${quality.readyForRollout ? 'var(--v4p-success-border)' : 'var(--v4p-warning-border)'}` }}>
          {quality.readyForRollout ? 'PRONTO PARA ROLLOUT' : 'EM VALIDAÇÃO'}
        </span>
      </div>

      {/* Score + stats */}
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:14 }}>
        <ScoreRing score={quality.overallScore} label="qualidade" size={72} />
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
          <StatChip label="Arquivos totais"    value={PREVIEW_BUILD_INFO.totalFiles} />
          <StatChip label="Páginas vivas"      value={livePages.length}              color="var(--v4p-success)" />
          <StatChip label="Prontas p/ integrar"value={readyPages.length}             color="var(--v4p-accent)"  />
          <StatChip label="Componentes"        value={COMPONENT_SUMMARY.total}       />
        </div>
      </div>

      {/* Breakdown de qualidade */}
      <div>
        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', color:'var(--v4p-text-4)', marginBottom:8 }}>Score por dimensão</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6 }}>
          {Object.entries(quality.breakdown).map(([key, score]) => {
            const labels = { visual:'Visual', operational:'Operacional', accessibility:'Acessibilidade', consistency:'Consistência', responsiveness:'Responsividade' };
            const color  = score >= 90 ? 'var(--v4p-success)' : score >= 75 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';
            return (
              <div key={key} style={{ textAlign:'center', padding:'6px 4px', borderRadius:'var(--v4p-r-sm)', background:'rgba(0,0,0,0.12)' }}>
                <div style={{ fontSize:15, fontWeight:700, color, lineHeight:1 }}>{score}%</div>
                <div style={{ fontSize:8, color:'var(--v4p-text-4)', marginTop:2, lineHeight:1.2 }}>{labels[key]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(PreviewStatusPanel);
