import { memo } from 'react';
import { PAGE_REGISTRY, PAGE_STATUS, INTEGRATION_STATUS } from '../governance/pageRegistry.js';
import { NAV_ITEM_ID } from '../foundation/navigation.js';

const STATUS_COLOR = {
  [PAGE_STATUS.MOCK]:        'var(--v4p-success)',
  [PAGE_STATUS.LIVE]:        'var(--v4p-success)',
  [PAGE_STATUS.COMING_SOON]: 'var(--v4p-text-4)',
  [PAGE_STATUS.DEPRECATED]:  'var(--v4p-danger)',
};

const INTEGRATION_COLOR = {
  [INTEGRATION_STATUS.READY]:   'var(--v4p-success)',
  [INTEGRATION_STATUS.PARTIAL]: 'var(--v4p-warning)',
  [INTEGRATION_STATUS.NONE]:    'var(--v4p-text-4)',
  [INTEGRATION_STATUS.FULL]:    'var(--v4p-accent)',
};

const INTEGRATION_LABEL = {
  [INTEGRATION_STATUS.READY]:   'Pronta p/ integrar',
  [INTEGRATION_STATUS.PARTIAL]: 'Parcial',
  [INTEGRATION_STATUS.NONE]:    'Apenas mock',
  [INTEGRATION_STATUS.FULL]:    'Integrada',
};

function PageCard({ page, isActive, onClick }) {
  const statusColor      = STATUS_COLOR[page.status] ?? 'var(--v4p-text-4)';
  const integrationColor = INTEGRATION_COLOR[page.integration] ?? 'var(--v4p-text-4)';
  const isAvailable      = page.status === PAGE_STATUS.MOCK || page.status === PAGE_STATUS.LIVE;

  return (
    <div
      onClick={() => isAvailable && onClick(page.id)}
      style={{
        padding:'10px 12px', borderRadius:'var(--v4p-r-md)',
        background: isActive ? 'var(--v4p-accent-xsoft)' : 'rgba(0,0,0,0.12)',
        border: isActive ? '1px solid var(--v4p-border-accent)' : '1px solid var(--v4p-border)',
        cursor: isAvailable ? 'pointer' : 'not-allowed',
        opacity: isAvailable ? 1 : 0.45,
        transition: 'background var(--v4p-t-fast), border-color var(--v4p-t-fast)',
      }}
      onMouseEnter={e => isAvailable && !isActive && (e.currentTarget.style.background = 'var(--v4p-bg-card)')}
      onMouseLeave={e => isAvailable && !isActive && (e.currentTarget.style.background = 'rgba(0,0,0,0.12)')}
    >
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:statusColor, flexShrink:0 }} />
        <span style={{ fontSize:12, fontWeight:600, color: isActive ? 'var(--v4p-accent)' : 'var(--v4p-text-1)' }}>{page.label}</span>
        <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, color:'var(--v4p-text-4)' }}>F{page.rolloutPhase}</span>
      </div>
      <div style={{ fontSize:9, color:'var(--v4p-text-4)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{page.description}</div>
      <div style={{ display:'flex', gap:6 }}>
        <span style={{ fontSize:9, fontWeight:600, color:statusColor }}>
          {page.status === PAGE_STATUS.MOCK ? 'Mock ativo' : page.status === PAGE_STATUS.COMING_SOON ? 'Em breve' : page.status}
        </span>
        <span style={{ fontSize:9, color:integrationColor }}>· {INTEGRATION_LABEL[page.integration]}</span>
      </div>
    </div>
  );
}

function PreviewLauncher({ activePage, onNavigate }) {
  const groups = {
    'Fase 1': PAGE_REGISTRY.filter(p => p.rolloutPhase === 1),
    'Fase 2': PAGE_REGISTRY.filter(p => p.rolloutPhase === 2),
    'Fase 3': PAGE_REGISTRY.filter(p => p.rolloutPhase === 3),
    'Fase 4': PAGE_REGISTRY.filter(p => p.rolloutPhase === 4),
    'Fase 5': PAGE_REGISTRY.filter(p => p.rolloutPhase === 5),
  };

  return (
    <div className="v4p-surface-card" style={{ padding:'14px 16px' }}>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--v4p-text-2)', marginBottom:12, paddingBottom:10, borderBottom:'1px solid var(--v4p-border-soft)' }}>
        Launcher de páginas
      </div>

      {Object.entries(groups).map(([phase, pages]) => (
        <div key={phase} style={{ marginBottom:12 }}>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--v4p-text-4)', marginBottom:6 }}>{phase}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:6 }}>
            {pages.map(page => (
              <PageCard key={page.id} page={page} isActive={page.id === activePage} onClick={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(PreviewLauncher);
