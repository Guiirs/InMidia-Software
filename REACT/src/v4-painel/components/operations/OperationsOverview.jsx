import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';

function StatPill({ label, value, color, icon }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '12px 16px', borderRadius: 'var(--v4p-r-lg)',
      background: 'var(--v4p-bg-card)', border: '1px solid var(--v4p-border)',
      flex: 1, minWidth: 110,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 14, color, lineHeight: 1 }}>{icon}</span>
        <span className="v4p-label">{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function OperationsOverview({ overview = {} }) {
  const meta = getStateMeta(overview.sincronizacao ?? 'healthy');
  const pct  = Math.round((overview.ocupacaoGlobal ?? 0) * 100);

  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status global + uptime bar */}
      <div className="v4p-surface-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 18, color: meta.color }}>display_settings</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-1)' }}>Central Operacional</div>
            <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Atualizado {overview.ultimaAtualizacao}</div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">{overview.alertasRegionais} alertas regionais</span>
          <div className="v4p-status-pill" style={{
            color: meta.color,
            borderColor: `color-mix(in srgb, ${meta.color} 34%, transparent)`,
            background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
            {meta.label}
          </div>
        </div>
      </div>

      {/* Barra de ocupação global */}
      <div className="v4p-surface-card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Ocupação global do inventário</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--v4p-success)' }}>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 'var(--v4p-r-full)', background: 'var(--v4p-border)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--v4p-accent), var(--v4p-success))', borderRadius: 'var(--v4p-r-full)', transition: 'width 0.8s var(--v4p-ease)' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { l: 'Ativos', v: overview.pontosAtivos,      c: 'var(--v4p-success)' },
            { l: 'Disponíveis', v: overview.pontosDisponiveis, c: 'var(--v4p-accent)' },
            { l: 'Manutenção', v: overview.emManutencao,  c: 'var(--v4p-warning)' },
            { l: 'Reservados', v: overview.reservados,    c: 'var(--v4p-info)' },
            { l: 'Total', v: overview.totalPontos,        c: 'var(--v4p-text-3)' },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--v4p-text-4)' }}>{s.l}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{s.v}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--v4p-success)' }}>
            {fmt(overview.receitaAtiva)}
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--v4p-text-4)', marginLeft: 4 }}>receita ativa</span>
          </div>
        </div>
      </div>

      {/* Pills de métricas */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatPill label="Pontos ativos"    value={overview.pontosAtivos}    color="var(--v4p-success)" icon="check_circle"            />
        <StatPill label="Disponíveis"      value={overview.pontosDisponiveis} color="var(--v4p-accent)"  icon="radio_button_unchecked" />
        <StatPill label="Em manutenção"    value={overview.emManutencao}    color="var(--v4p-warning)" icon="build"                   />
        <StatPill label="Alertas regionais"value={overview.alertasRegionais}color="var(--v4p-danger)"  icon="notifications_active"    />
      </div>
    </div>
  );
}

export default memo(OperationsOverview);
