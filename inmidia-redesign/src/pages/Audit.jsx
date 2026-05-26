/* global React, Ic, Btn, IconBtn, StatusBadge, Card, FilterChip, Avatar, Segments, Tabs */
// InMidia · Auditoria (rastreabilidade de eventos operacionais)

const { useState: useStateAu } = React;

const EVENTS = [
  { t: "ha 4 min",  actor: "Mariana Souza", role: "Comercial Sr.", act: "approved",  obj: "contrato CT-2026-0481", scope: "Stella Artois · Inverno", diff: [
    { f: "status",        from: "em_aprovacao", to: "aprovado" },
    { f: "approved_by",   from: null,           to: "mariana.souza" },
    { f: "approved_at",   from: null,           to: "2026-05-18T15:42:18Z" },
  ], ip: "200.18.42.18", session: "se_4f81-9a..." },
  { t: "ha 9 min",  actor: "Sistema · runtime", role: "auto", act: "synced", obj: "lote rec-9f3a", scope: "reconciliação de 312 placas (SP, RJ)", diff: [
    { f: "reconciled_count",   from: 0,   to: 312 },
    { f: "diverged_count",     from: 0,   to: 4 },
    { f: "duration_ms",        from: null, to: 4218 },
  ], ip: "—", session: "system" },
  { t: "ha 22 min", actor: "Pedro Vidal", role: "Operacional", act: "moved", obj: "reserva RS-7820", scope: "Itaú · Cards Premium", diff: [
    { f: "stage", from: "rascunho", to: "em_aprovacao" },
    { f: "owner", from: "pedro.vidal", to: "mariana.souza" },
  ], ip: "189.40.22.108", session: "se_2c91-bb..." },
  { t: "ha 38 min", actor: "Carla Lima", role: "Campo · SP", act: "installed", obj: "placa IM-SP-1284", scope: "Av. Paulista 1500 · Frontlight 9x3", diff: [
    { f: "status",         from: "pendente",   to: "ativa" },
    { f: "installed_at",   from: null,         to: "2026-05-18T15:08:42Z" },
    { f: "installed_by",   from: null,         to: "carla.lima" },
  ], ip: "187.114.18.42", session: "se_mob-71..." },
  { t: "ha 1h 4m",  actor: "Sistema · monitor", role: "auto", act: "detected", obj: "incidente INC-2026-0418", scope: "anomalia SSE Nordeste", diff: [
    { f: "severity",   from: null, to: "sev2" },
    { f: "channels",   from: null, to: ["sse.recife", "sse.salvador"] },
  ], ip: "—", session: "system" },
  { t: "ha 1h 18m", actor: "Ana Carvalho", role: "BI", act: "exported", obj: "relatório ER-2026-04", scope: "faturamento mensal · CSV 4.2MB", diff: [
    { f: "format", from: null, to: "csv" },
    { f: "rows",   from: null, to: 8420 },
  ], ip: "200.18.42.61", session: "se_8b21-04..." },
  { t: "ha 2h 12m", actor: "Renato Camargo", role: "Admin", act: "updated", obj: "permissões usuário pedro.vidal", scope: "RBAC", diff: [
    { f: "capabilities", from: ["res.read", "res.write"], to: ["res.read", "res.write", "res.approve"] },
  ], ip: "200.18.42.18", session: "se_admin-..." },
  { t: "ontem 14:48", actor: "Pedro Vidal", role: "Operacional", act: "deleted", obj: "reserva RS-7754", scope: "Brastemp · Q1 rev3 (rascunho)", diff: [
    { f: "status", from: "rascunho", to: "removido" },
  ], ip: "189.40.22.108", session: "se_2c91-aa..." },
];

const ACTS = {
  approved:  { tone: "success", label: "APROVOU",      icon: "check-circ" },
  moved:     { tone: "info",    label: "MOVEU",        icon: "git-branch" },
  installed: { tone: "success", label: "INSTALOU",     icon: "package" },
  synced:    { tone: "info",    label: "SINCRONIZOU",  icon: "refresh" },
  detected:  { tone: "warn",    label: "DETECTOU",     icon: "alert-tri" },
  exported:  { tone: "info",    label: "EXPORTOU",     icon: "download" },
  updated:   { tone: "purple",  label: "ATUALIZOU",    icon: "edit" },
  deleted:   { tone: "danger",  label: "REMOVEU",      icon: "trash" },
};

function PageAudit() {
  const [tab, setTab] = useStateAu("all");
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Auditoria</h1>
          <p className="page-sub">Trilha imutável de eventos operacionais. Retenção 24 meses · Hash SHA-256 por evento · Conformidade LGPD.</p>
        </div>
        <div className="page-hd-actions">
          <Btn icon="download">Exportar trilha</Btn>
          <Btn icon="settings">Configurar retenção</Btn>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "all",    label: "Todos eventos", count: "12.4k" },
        { value: "ops",    label: "Operacionais",  count: "8.2k" },
        { value: "admin",  label: "Administrativos", count: "284" },
        { value: "sys",    label: "Sistema",       count: "3.9k" },
        { value: "sec",    label: "Segurança",     count: "42" },
      ]} />

      <div className="fbar">
        <div className="fbar-search">
          <Ic name="search" size={13} style={{ color: "var(--text-3)" }} />
          <input placeholder="Buscar por ator, objeto, ID de sessão ou IP…" />
        </div>
        <FilterChip label="Ator" />
        <FilterChip label="Tipo" />
        <FilterChip label="Período" value="últ. 24h" active />
        <FilterChip label="IP" />
        <FilterChip label="+ Filtro" />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-bd flush">
          {EVENTS.map((e, i) => {
            const a = ACTS[e.act];
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "90px 28px 1fr auto", gap: 14, alignItems: "flex-start",
                padding: "14px 16px",
                borderBottom: i < EVENTS.length - 1 ? "1px solid var(--border-faint)" : "none",
              }}>
                <span className="tnum muted" style={{ fontSize: 11.5, paddingTop: 3 }}>{e.t}</span>
                <span style={{
                  width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center",
                  background: `var(--status-${a.tone === "success" ? "online" : a.tone === "warn" ? "degraded" : a.tone === "danger" ? "offline" : "info"}-dim)`,
                  color: `var(--${a.tone === "success" ? "success" : a.tone === "warn" ? "warning" : a.tone === "danger" ? "danger" : a.tone === "purple" ? "purple" : "info"}-on)`,
                }}><Ic name={a.icon} size={14} /></span>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--text-1)", fontWeight: 600, fontSize: 13 }}>{e.actor}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{e.role}</span>
                    <StatusBadge kind={a.tone} dot={false}>{a.label}</StatusBadge>
                    <span className="mono" style={{ color: "var(--text-1)", fontSize: 12 }}>{e.obj}</span>
                    <span className="muted" style={{ fontSize: 12 }}>· {e.scope}</span>
                  </div>

                  {/* diff */}
                  <div style={{ marginTop: 8, background: "var(--bg-input)", borderRadius: 6, padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6 }}>
                    {e.diff.map((d, j) => (
                      <div key={j} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
                        <span style={{ color: "var(--text-3)" }}>{d.f}</span>
                        <span>
                          <span style={{ color: "var(--danger-on)", textDecoration: "line-through", opacity: 0.8 }}>{fmt(d.from)}</span>
                          <span style={{ color: "var(--text-4)" }}> → </span>
                          <span style={{ color: "var(--success-on)" }}>{fmt(d.to)}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--text-4)", display: "flex", gap: 14 }}>
                    <span><Ic name="globe" size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />IP {e.ip}</span>
                    <span><Ic name="key" size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />sessão <span className="mono">{e.session}</span></span>
                    <span><Ic name="check" size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />hash <span className="mono">sha256:{(Math.random().toString(16).slice(2, 10))}…</span></span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <IconBtn icon="external" title="Ver objeto" />
                  <IconBtn icon="copy" title="Copiar JSON" />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-faint)", textAlign: "center" }}>
          <Btn size="sm" icon="chev-down">Carregar mais (12.392 eventos)</Btn>
        </div>
      </div>
    </div>
  );
}

function fmt(v) {
  if (v == null) return "∅";
  if (Array.isArray(v)) return "[" + v.join(", ") + "]";
  if (typeof v === "string" && v.length > 38) return v.slice(0, 38) + "…";
  return String(v);
}

window.PageAudit = PageAudit;
