/* global React, Ic, Btn, IconBtn, StatusBadge, Card, KPI, Segments */
// InMidia · Saúde do sistema (Observability UX — SSE, polling, sync, recovery)

const { useState: useStateHe } = React;

function PageHealth() {
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">
            Saúde do sistema
            <StatusBadge kind="warn" size="lg">DEGRADADO</StatusBadge>
          </h1>
          <p className="page-sub">Confiança de sincronização operacional. 1 incidente ativo · Última reconciliação ha 14s · SLO atendido em 7 de 8 indicadores.</p>
        </div>
        <div className="page-hd-actions">
          <Btn icon="rotate">Reconciliar agora</Btn>
          <Btn icon="settings">Configurar limites</Btn>
        </div>
      </div>

      {/* Sync confidence hero */}
      <div className="card" style={{ background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)" }}>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 28 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Confiança de sincronização</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 56, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>94,2</span>
              <span style={{ fontSize: 22, color: "var(--text-3)" }}>%</span>
              <StatusBadge kind="warn" size="lg">↓ 3,8 p.p. vs base</StatusBadge>
            </div>
            <p className="dim" style={{ marginTop: 14, maxWidth: "52ch", fontSize: 13 }}>
              7 dos 8 canais de sincronização estão saudáveis. O canal SSE de Nordeste apresenta latência elevada
              e pode atrasar a propagação de eventos em até 4 minutos. O usuário operacional não percebe o atraso —
              os dados são consistentes ao recarregar.
            </p>
            <div className="row gap-2" style={{ marginTop: 18 }}>
              <Btn variant="primary" icon="rotate">Forçar reconciliação</Btn>
              <Btn icon="play-circ">Iniciar diagnóstico</Btn>
              <Btn icon="external">Runbook</Btn>
            </div>
          </div>

          <div>
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="eyebrow">Canais (últimos 60min)</span>
              <span className="kbd">latência média</span>
            </div>
            <div className="col" style={{ gap: 8 }}>
              {[
                { name: "SSE · eventos operacionais",        dot: "success", lat: "120ms", st: "saudável", bar: 9 },
                { name: "Polling · placas (30s)",             dot: "success", lat: "84ms",  st: "saudável", bar: 9 },
                { name: "Polling · reservas (45s)",           dot: "success", lat: "112ms", st: "saudável", bar: 9 },
                { name: "Sync runtime · contratos",           dot: "success", lat: "68ms",  st: "saudável", bar: 9 },
                { name: "Mapa · tile cache",                  dot: "success", lat: "44ms",  st: "saudável", bar: 9 },
                { name: "SSE · Nordeste (Recife / SSA)",      dot: "warn",    lat: "4,1m",  st: "degradado", bar: 4 },
                { name: "Export jobs · pipeline",             dot: "success", lat: "n/a",   st: "saudável", bar: 9 },
                { name: "Auditoria · ingestão",               dot: "success", lat: "92ms",  st: "saudável", bar: 9 },
              ].map((c, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "8px 1fr 70px 64px", gap: 10, alignItems: "center", fontSize: 12 }}>
                  <span className={`dotind ${c.dot}`} style={{ margin: 0 }} />
                  <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{c.name}</span>
                  <span className="meter" style={{ width: 70 }}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <span key={j} className={j < c.bar ? (c.dot === "warn" ? "warn" : "on") : ""} />
                    ))}
                  </span>
                  <span className="tnum" style={{ textAlign: "right", color: c.dot === "warn" ? "var(--warning-on)" : "var(--text-2)", fontWeight: 600 }}>{c.lat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-3">
        <KPI label="Eventos / seg (SSE)" value="184" delta="+12%" deltaDir="up" sub="pico hoje: 412/s · 14:22" spark={[120,140,150,160,170,180,184,182,178,180,184,184]} />
        <KPI label="Backlog reconciliação" value="312" sub="placas · estimativa 4m" delta="-58" deltaDir="up" footer={<><span className="dotind info" /> Lote rec-9f3a em execução</>} />
        <KPI label="Uptime API · 24h" value="99,94" unit="%" delta="ok" deltaDir="flat" sub="dentro do SLO (99,90%)" />
      </div>

      <div className="grid-2">
        {/* Incidents */}
        <Card title="Incidentes ativos & recuperação" subtitle="1 incidente em mitigação" eyebrow="INCIDENTES" actions={<Btn size="sm" iconRight="chev-right">Histórico</Btn>}>
          <div className="col" style={{ gap: 10 }}>
            <div style={{ padding: 12, background: "var(--status-degraded-dim)", border: "1px solid var(--status-degraded-border)", borderRadius: 8 }}>
              <div className="between">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Ic name="alert-tri" size={14} style={{ color: "var(--warning-on)" }} />
                    <span style={{ color: "var(--text-1)", fontWeight: 600, fontSize: 13 }}>INC-2026-0418 · SSE Nordeste intermitente</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Aberto ha 1h18m · sev2 · impacto: usuários de NE veem dados com até 4min de atraso</div>
                </div>
                <StatusBadge kind="warn">EM MITIGAÇÃO</StatusBadge>
              </div>
              <div className="divider" style={{ background: "var(--status-degraded-border)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11.5 }}>
                <div><span className="muted">Responsável</span><div style={{ color: "var(--text-1)", fontWeight: 600 }}>Plataforma</div></div>
                <div><span className="muted">ETA recuperação</span><div style={{ color: "var(--text-1)", fontWeight: 600 }} className="tnum">~12 min</div></div>
                <div><span className="muted">Sessões afetadas</span><div style={{ color: "var(--text-1)", fontWeight: 600 }} className="tnum">84</div></div>
              </div>
              <div className="row gap-2" style={{ marginTop: 10 }}>
                <Btn size="sm" icon="external">Abrir runbook</Btn>
                <Btn size="sm" icon="radio">Forçar failover SSE</Btn>
                <Btn size="sm" icon="rotate">Reabrir canal</Btn>
              </div>
            </div>

            <div style={{ padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-faint)", borderRadius: 8, opacity: 0.85 }}>
              <div className="between">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>INC-2026-0412 · Export pipeline lento</span>
                <StatusBadge kind="success">RESOLVIDO</StatusBadge>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Fechado ha 6h · MTTR 38min · runbook executado</div>
            </div>
            <div style={{ padding: 10, background: "var(--bg-input)", border: "1px solid var(--border-faint)", borderRadius: 8, opacity: 0.85 }}>
              <div className="between">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>INC-2026-0406 · Cache de mapa stale</span>
                <StatusBadge kind="success">RESOLVIDO</StatusBadge>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Fechado ontem · MTTR 14min · auto-recovery</div>
            </div>
          </div>
        </Card>

        {/* Stale data + recovery */}
        <Card title="Dados desatualizados (stale)" subtitle="Lotes que ultrapassaram a janela de frescor" eyebrow="STALENESS">
          <div className="col" style={{ gap: 8 }}>
            {[
              { region: "Nordeste", placas: 284, age: "4m 12s", thresh: "30s", tone: "warn" },
              { region: "Norte/CO", placas: 38,  age: "1m 48s", thresh: "30s", tone: "warn" },
              { region: "Sul",      placas: 12,  age: "42s",    thresh: "30s", tone: "info" },
              { region: "SP Capital", placas: 0, age: "ok",     thresh: "30s", tone: "success" },
              { region: "SP Interior", placas: 0, age: "ok",    thresh: "30s", tone: "success" },
              { region: "MG",       placas: 0,   age: "ok",     thresh: "30s", tone: "success" },
              { region: "RJ Grande", placas: 0,  age: "ok",     thresh: "30s", tone: "success" },
            ].map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", padding: "6px 10px", borderRadius: 6, background: s.tone === "success" ? "transparent" : "var(--bg-input)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span className={`dotind ${s.tone}`} style={{ margin: 0 }} />
                  <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{s.region}</span>
                  {s.placas > 0 && <span className="muted">· {s.placas} placas</span>}
                </span>
                <span className="tnum" style={{ fontSize: 11.5, color: s.tone === "warn" ? "var(--warning-on)" : "var(--text-3)" }}>{s.age}</span>
                <span className="kbd" style={{ marginLeft: 4 }}>th {s.thresh}</span>
              </div>
            ))}
          </div>
          <div className="divider mt-3" />
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <Btn size="sm" icon="rotate">Atualizar regiões stale</Btn>
            <Btn size="sm" icon="settings">Ajustar limites</Btn>
          </div>
        </Card>
      </div>

      {/* Job & runtime */}
      <Card title="Jobs de runtime" subtitle="Processos batch, exportação e reconciliação" eyebrow="JOBS" actions={<>
        <Btn size="sm" icon="filter">Filtrar</Btn>
        <Btn size="sm" icon="external">Logs</Btn>
      </>}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Job</th>
              <th>Tipo</th>
              <th>Status</th>
              <th className="num">Progresso</th>
              <th>Iniciado</th>
              <th className="num">Duração</th>
              <th>Disparado por</th>
              <th className="act"></th>
            </tr>
          </thead>
          <tbody>
            {[
              ["rec-9f3a", "Reconciliação inventário", "running", 64,  "ha 4m",  "—",     "auto · scheduler"],
              ["exp-7811","Export · Itaú Q2",          "running", 38,  "ha 1m",  "—",     "Ana Carvalho"],
              ["exp-7809","Export · BTG faturamento",  "queued",  0,   "—",      "—",     "Pedro Vidal"],
              ["sync-rt", "Sync runtime SSE",          "warn",    72,  "ha 14m", "—",     "auto"],
              ["rec-9e4d","Reconciliação contratos",   "ok",      100, "ha 18m", "1m 22s","auto · cron"],
              ["bk-5012", "Backup auditoria",          "ok",      100, "ha 42m", "8m 14s","auto · daily"],
              ["exp-7802","Export · Relatório mensal", "ok",      100, "ha 1h",  "47s",   "Mariana Souza"],
              ["rec-9d11","Reconciliação placas",      "ok",      100, "ha 2h",  "3m 02s","auto · cron"],
            ].map((j, i) => {
              const [id, type, status, prog, start, dur, by] = j;
              const sm = { running: { kind: "info", label: "EXECUTANDO" }, queued: { kind: "muted", label: "FILA" }, warn: { kind: "warn", label: "DEGRADADO" }, ok: { kind: "success", label: "OK" } }[status];
              return (
                <tr key={i}>
                  <td className="id">{id}</td>
                  <td className="lead">{type}</td>
                  <td><StatusBadge kind={sm.kind}>{sm.label}</StatusBadge></td>
                  <td className="num">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <span style={{ width: 64, height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}>
                        <span style={{ display: "block", width: `${prog}%`, height: "100%", background: status === "warn" ? "var(--warning-on)" : status === "ok" ? "var(--success-on)" : "var(--accent-light)" }} />
                      </span>
                      <span style={{ minWidth: 32, textAlign: "right" }}>{prog}%</span>
                    </div>
                  </td>
                  <td className="tnum muted">{start}</td>
                  <td className="num">{dur}</td>
                  <td>{by}</td>
                  <td className="act"><IconBtn icon="more-h" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

window.PageHealth = PageHealth;
