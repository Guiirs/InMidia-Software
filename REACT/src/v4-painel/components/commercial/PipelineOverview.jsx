import { memo } from 'react';

const EMPTY_PIPELINE_SUMMARY = {
  taxaConversaoGlobal: 0,
  cicloMedioVendas: 0,
  ticketMedioFechado: 0,
  receitaNoMes: 0,
  metaMensal: 0,
  crescimentoMoM: 0,
};

function StageBar({ stage, maxCount, isLast }) {
  const widthPct = (stage.count / maxCount) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 140, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v4p-text-2)' }}>{stage.label}</div>
          {stage.conversao && (
            <div style={{ fontSize: 9, color: 'var(--v4p-text-4)' }}>{Math.round(stage.conversao * 100)}% conversao</div>
          )}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ height: 32, borderRadius: 'var(--v4p-r-md)', background: 'var(--v4p-border-soft)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', width: `${widthPct}%`, minWidth: 40,
                background: stage.cor,
                opacity: 0.85,
                borderRadius: 'var(--v4p-r-md)',
                display: 'flex', alignItems: 'center', paddingLeft: 10,
                transition: 'width 0.7s var(--v4p-ease)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{stage.count}</span>
            </div>
          </div>
        </div>
        <div style={{ width: 100, textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--v4p-text-1)' }}>{stage.valor ?? '-'}</div>
        </div>
      </div>
      {!isLast && stage.conversao && (
        <div style={{ paddingLeft: 150, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 12, color: 'var(--v4p-text-4)' }}>south</span>
          <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{Math.round(stage.conversao * 100)}% avancam</span>
        </div>
      )}
    </div>
  );
}

function PipelineOverview({ stages = [], summary = EMPTY_PIPELINE_SUMMARY }) {
  const maxCount = stages[0]?.count || 1;
  const convGlobal = Math.round((summary.taxaConversaoGlobal ?? 0) * 100 * 10) / 10;
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Pipeline executivo</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Visao geral do funil comercial</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { l: 'Conversao global', v: `${convGlobal}%`, c: 'var(--v4p-accent)' },
            { l: 'Ciclo medio', v: `${summary.cicloMedioVendas}d`, c: 'var(--v4p-text-2)' },
            { l: 'Ticket medio', v: fmt(summary.ticketMedioFechado), c: 'var(--v4p-success)' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'var(--v4p-text-4)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stages.length === 0 && (
          <div className="v4p-list-item__copy">Nenhum estagio de pipeline encontrado.</div>
        )}
        {stages.map((stage, i) => (
          <StageBar key={stage.id} stage={stage} maxCount={maxCount} isLast={i === stages.length - 1} />
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--v4p-border-soft)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Receita no mes </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--v4p-success)' }}>{fmt(summary.receitaNoMes)}</span>
          <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}> de </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-3)' }}>{fmt(summary.metaMensal)} meta</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--v4p-success)', fontWeight: 600 }}>+{Math.round((summary.crescimentoMoM ?? 0) * 100)}% MoM</span>
        </div>
      </div>
    </div>
  );
}

export default memo(PipelineOverview);
