/**
 * V4DebugPanel — painel temporário de debug de integração (DEV-only).
 *
 * Visível SOMENTE em import.meta.env.DEV.
 * Permite ligar/desligar flags de dados reais, ver API URL, token JWT e status.
 *
 * Uso no console do navegador:
 *   localStorage.setItem('v4_inv_real', 'true')  → ativa inventário real
 *   localStorage.removeItem('v4_inv_real')        → volta para mock
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const FLAGS = [
  { key: 'v4_inv_real',         label: 'Inventory',  domain: 'InventoryProvider',  api: '/api/v4/inventory/summary + /placas' },
  { key: 'v4_contracts_real',   label: 'Contracts',  domain: 'ContractsProvider',  api: '/api/v4/contracts/summary + /contracts' },
  { key: 'v4_commercial_real',  label: 'Commercial', domain: 'CommercialProvider', api: 'Agrega Inventory + Contracts' },
  { key: 'v4_operations_real',  label: 'Operations', domain: 'OperationsProvider', api: 'Agrega boards + contracts + inventory' },
  { key: 'v4_alerts_real',      label: 'Alerts',     domain: 'AlertsProvider',     api: 'Agrega boards + contracts + inventory' },
  { key: 'v4_reports_real',     label: 'Reports',    domain: 'ReportsProvider',    api: 'Agrega todos os domínios' },
];

function readFlag(key) {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}

function setFlag(key, value) {
  try {
    if (value) localStorage.setItem(key, 'true');
    else localStorage.removeItem(key);
  } catch { /* sem acesso */ }
}

function readUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u ? { nome: u.nome ?? u.name ?? '?', empresa: u.empresaId ?? '?' } : null;
  } catch { return null; }
}

export default function V4DebugPanel() {
  const [open, setOpen]     = useState(false);
  const [flags, setFlags]   = useState(() => Object.fromEntries(FLAGS.map(f => [f.key, readFlag(f.key)])));
  const [pending, setPending] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const [probing, setProbing]         = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFlags(Object.fromEntries(FLAGS.map(f => [f.key, readFlag(f.key)])));
  }, [open]);

  const handleToggle = useCallback((key) => {
    setFlags(prev => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
    setPending(true);
  }, []);

  const handleApply = useCallback(() => {
    FLAGS.forEach(f => setFlag(f.key, flags[f.key]));
    setPending(false);
    window.location.reload();
  }, [flags]);

  const handleReset = useCallback(() => {
    FLAGS.forEach(f => setFlag(f.key, false));
    setPending(false);
    window.location.reload();
  }, []);

  const handleEnableAll = useCallback(() => {
    setFlags(Object.fromEntries(FLAGS.map(f => [f.key, true])));
    setPending(true);
  }, []);

  const handleProbe = useCallback(async () => {
    setProbing(true);
    setProbeResult(null);
    const devtools = window.__INMIDIA_SYNC_DEVTOOLS__;
    const core = window.__INMIDIA_SYNC_CORE__;
    setProbeResult([
      { label: 'timeline', ok: Boolean(devtools?.getTimeline), value: devtools?.getTimeline?.().length ?? 0 },
      { label: 'resources', ok: Boolean(core?.getResource), value: Object.keys(core?.registry ?? {}).length },
      { label: 'queue', ok: Boolean(core?.refreshQueue), value: core?.refreshQueue?.snapshot?.().length ?? 0 },
    ]);
    setProbing(false);
  }, []);

  const user  = readUser();
  const activeCount = Object.values(flags).filter(Boolean).length;

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, fontFamily: 'monospace' }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="V4 Debug Panel"
        style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: activeCount > 0 ? '#22c55e' : '#6366f1',
          color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'background 0.2s',
        }}
      >
        {open ? '✕' : '🔧'}
        {pending && (
          <span style={{
            position: 'absolute', top: 0, right: 0, width: 10, height: 10,
            borderRadius: '50%', background: '#f59e0b', border: '2px solid #0f172a',
          }} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 52, right: 0, width: 380,
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }} ref={panelRef}>
          {/* Header */}
          <div style={{ padding: '10px 14px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em' }}>V4 DEBUG PANEL — DEV ONLY</span>
            <span style={{ fontSize: 10, color: activeCount > 0 ? '#22c55e' : '#6366f1' }}>
              {activeCount}/{FLAGS.length} flags ativas
            </span>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* API info */}
            <div style={{ fontSize: 10, color: '#475569', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div><span style={{ color: '#64748b' }}>SYNC_CORE:</span> <span style={{ color: window.__INMIDIA_SYNC_CORE__ ? '#22c55e' : '#ef4444' }}>{window.__INMIDIA_SYNC_CORE__ ? 'ativo' : 'ausente'}</span></div>
              <div><span style={{ color: '#64748b' }}>DEVTOOLS:</span>  <span style={{ color: window.__INMIDIA_SYNC_DEVTOOLS__ ? '#22c55e' : '#ef4444' }}>{window.__INMIDIA_SYNC_DEVTOOLS__ ? 'ativo' : 'ausente'}</span></div>
              {user && <div><span style={{ color: '#64748b' }}>USER:</span> <span style={{ color: '#94a3b8' }}>{user.nome} · empresa={user.empresa}</span></div>}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: 0 }} />

            {/* Flags */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>Feature Flags</div>
              {FLAGS.map(f => {
                const active = flags[f.key];
                return (
                  <div key={f.key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px',
                    borderRadius: 6, background: active ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? 'rgba(34,197,94,0.2)' : '#1e293b'}`,
                    cursor: 'pointer',
                  }} onClick={() => handleToggle(f.key)}>
                    <div style={{
                      width: 32, height: 18, borderRadius: 9, flexShrink: 0,
                      background: active ? '#22c55e' : '#334155',
                      position: 'relative', transition: 'background 0.2s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: active ? 15 : 3,
                        width: 12, height: 12, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.15s',
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#22c55e' : '#94a3b8' }}>{f.label}</span>
                        <span style={{ fontSize: 9, color: '#475569' }}>{f.key}</span>
                      </div>
                      <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{f.domain}</div>
                      <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>{f.api}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Probe result */}
            {probeResult && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Probe de Rede</div>
                  {probeResult.map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', padding: '3px 0' }}>
                      <span style={{ color: '#94a3b8' }}>{r.label}</span>
                      <span style={{ color: r.ok ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                        {r.ok ? `OK ${r.value}` : 'INDISPONIVEL'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Actions */}
            <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pending && (
                <div style={{ fontSize: 10, color: '#f59e0b', textAlign: 'center', padding: '4px 0' }}>
                  ⚠ Alterações pendentes — clique em Aplicar para recarregar
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleEnableAll} style={btnStyle('#6366f1')}>Ligar tudo</button>
                <button onClick={handleReset} style={btnStyle('#ef4444')}>Desligar tudo</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleProbe} disabled={probing} style={btnStyle('#0ea5e9')}>
                  {probing ? 'Lendo…' : 'Probe Sync'}
                </button>
                <button onClick={handleApply} disabled={!pending} style={btnStyle(pending ? '#22c55e' : '#1e293b', !pending)}>
                  Aplicar + Reload
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div style={{ fontSize: 9, color: '#334155', lineHeight: 1.6, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
              <strong style={{ color: '#475569' }}>Como validar:</strong><br />
              1. Ligar flags desejadas → Aplicar + Reload<br />
              2. Verificar badge <span style={{ color: '#22c55e' }}>DADOS REAIS</span> em cada página<br />
              3. Probe Sync usa window.__INMIDIA_SYNC_CORE__ e DevTools oficiais<br />
              4. Token ausente → auth guard do Sync Core preserva ultimo dado valido
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg, disabled = false) {
  return {
    flex: 1, padding: '6px 10px', borderRadius: 6, border: 'none', cursor: disabled ? 'default' : 'pointer',
    background: disabled ? '#1e293b' : bg, color: disabled ? '#334155' : '#fff',
    fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em',
    opacity: disabled ? 0.5 : 1, transition: 'opacity 0.2s',
  };
}
