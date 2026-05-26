/* global React, Ic, Btn, IconBtn, StatusBadge, Card, KPI, Tabs, Avatar, ActionMenu, Check, FilterChip */
// InMidia · Usuários & RBAC

const { useState: useStateUs } = React;

const USERS = [
  ["Renato Camargo",   "renato.camargo@inmidia.com",      "admin",        "Administração",  "ativo",   "ha 2 min",   ["users.*", "billing.*", "settings.*", "audit.read"], "indigo"],
  ["Mariana Souza",    "mariana.souza@inmidia.com",       "comercial_sr", "Comercial",      "ativo",   "ha 4 min",   ["res.*", "contracts.approve", "clients.*"], "rose"],
  ["Pedro Vidal",      "pedro.vidal@inmidia.com",         "operacional",  "Operações",      "ativo",   "ha 22 min",  ["res.read", "res.write", "res.approve", "inv.read"], "amber"],
  ["Ana Carvalho",     "ana.carvalho@inmidia.com",        "bi",           "BI",             "ativo",   "ha 1h",      ["bi.*", "exports.*", "audit.read"], "teal"],
  ["Carla Lima",       "carla.lima+sp@inmidia.com",       "campo",        "Campo · SP",     "ativo",   "ha 38 min",  ["inv.read", "inv.update.status"], "purple"],
  ["Lucas Bernardes",  "lucas.b@inmidia.com",             "financeiro",   "Financeiro",     "ativo",   "ha 3h",      ["billing.read", "billing.write", "contracts.read"], "sky"],
  ["Júlio Tavares",    "julio.tavares@inmidia.com",       "operacional",  "Operações",      "convite", "—",          ["res.read"], "amber"],
  ["Beatriz Marques",  "bea.marques@inmidia.com",         "campo",        "Campo · RJ",     "pausado", "ha 14d",     ["inv.read"], "slate"],
  ["Diogo Pinheiro",   "diogo.p@inmidia.com",             "auditoria",    "Auditoria",      "ativo",   "ha 2h",      ["audit.read", "audit.export"], "rose"],
  ["Sofia Andrade",    "sofia.andrade@inmidia.com",       "comercial",    "Comercial",      "ativo",   "ha 18 min",  ["res.read", "res.write", "clients.read"], "teal"],
];

const ROLES = {
  admin:        { label: "Admin",          tone: "purple" },
  comercial_sr: { label: "Comercial Sr.",  tone: "info" },
  comercial:    { label: "Comercial",      tone: "info" },
  operacional:  { label: "Operacional",    tone: "muted" },
  bi:           { label: "BI / Analytics", tone: "info" },
  campo:        { label: "Campo",          tone: "warn" },
  financeiro:   { label: "Financeiro",     tone: "info" },
  auditoria:    { label: "Auditoria",      tone: "muted" },
};

function PageUsers() {
  const [tab, setTab] = useStateUs("ativos");
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Usuários & RBAC</h1>
          <p className="page-sub">Controle de acesso baseado em papéis · 142 usuários · 8 papéis · 47 capabilities</p>
        </div>
        <div className="page-hd-actions">
          <Btn icon="key">Política RBAC</Btn>
          <Btn icon="import">SSO / SCIM</Btn>
          <Btn variant="primary" icon="user-plus">Convidar usuário</Btn>
        </div>
      </div>

      <div className="grid-4">
        <KPI label="Usuários ativos" value="138" sub="142 cadastrados · 4 convites" delta="+3" deltaDir="up" />
        <KPI label="Papéis" value="8" sub="3 customizados" delta="estável" deltaDir="flat" />
        <KPI label="Sessões agora" value="42" sub="online · 7 mobile" delta="+8" deltaDir="up" />
        <KPI label="MFA habilitado" value="96,4" unit="%" sub="política exige >95%" delta="+1,2 p.p." deltaDir="up" />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "ativos",  label: "Ativos",     count: 138 },
        { value: "conv",    label: "Convites",   count: 4 },
        { value: "paus",    label: "Pausados",   count: 3 },
        { value: "papeis",  label: "Papéis & Capabilities", count: 8 },
      ]} />

      <div className="fbar">
        <div className="fbar-search">
          <Ic name="search" size={13} style={{ color: "var(--text-3)" }} />
          <input placeholder="Buscar por nome, email ou capability…" />
        </div>
        <FilterChip label="Papel" />
        <FilterChip label="Departamento" />
        <FilterChip label="MFA" />
        <FilterChip label="Último acesso" />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th className="check"><Check /></th>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Departamento</th>
              <th>Status</th>
              <th>Último acesso</th>
              <th>Capabilities</th>
              <th>MFA</th>
              <th className="act"></th>
            </tr>
          </thead>
          <tbody>
            {USERS.map((u, i) => {
              const [name, email, role, dept, status, last, caps, tone] = u;
              const r = ROLES[role];
              const sm = status === "ativo" ? { kind: "success", label: "ATIVO" } : status === "convite" ? { kind: "info", label: "CONVITE" } : { kind: "muted", label: "PAUSADO" };
              return (
                <tr key={i}>
                  <td className="check"><Check /></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={name} size={26} tone={tone} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "var(--text-1)", fontWeight: 500, fontSize: 13 }}>{name}</div>
                        <div className="muted mono" style={{ fontSize: 11 }}>{email}</div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge kind={r.tone} dot={false}>{r.label}</StatusBadge></td>
                  <td>{dept}</td>
                  <td><StatusBadge kind={sm.kind}>{sm.label}</StatusBadge></td>
                  <td className="tnum muted">{last}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {caps.slice(0, 3).map((c, j) => (
                        <span key={j} className="mono" style={{
                          background: "var(--bg-input)", border: "1px solid var(--border-faint)",
                          borderRadius: 4, padding: "1px 6px", fontSize: 10.5, color: "var(--text-2)",
                        }}>{c}</span>
                      ))}
                      {caps.length > 3 && <span className="muted" style={{ fontSize: 11 }}>+{caps.length - 3}</span>}
                    </div>
                  </td>
                  <td>
                    {i !== 6 && i !== 7 ? <Ic name="shieldcheck" size={14} style={{ color: "var(--success-on)" }} /> :
                                            <Ic name="shield" size={14} style={{ color: "var(--text-4)" }} />}
                  </td>
                  <td className="act"><ActionMenu items={[
                    { label: "Editar permissões", icon: "edit", value: "edit" },
                    { label: "Resetar MFA",       icon: "key",  value: "mfa" },
                    { label: "Encerrar sessões",  icon: "logout", value: "kill" },
                    "-",
                    { label: "Pausar usuário",    icon: "pause", value: "pause" },
                    { label: "Remover",           icon: "trash", value: "del", danger: true },
                  ]} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Capabilities matrix */}
      <Card title="Matriz de capabilities" subtitle="Permissões por papel · clique para editar" eyebrow="RBAC" actions={<Btn size="sm" icon="external">Documentação</Btn>}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Capability</th>
                <th style={{ textAlign: "center" }}>Admin</th>
                <th style={{ textAlign: "center" }}>Com. Sr.</th>
                <th style={{ textAlign: "center" }}>Comercial</th>
                <th style={{ textAlign: "center" }}>Operacional</th>
                <th style={{ textAlign: "center" }}>Campo</th>
                <th style={{ textAlign: "center" }}>BI</th>
                <th style={{ textAlign: "center" }}>Financeiro</th>
                <th style={{ textAlign: "center" }}>Auditoria</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["inv.read",          [1,1,1,1,1,1,1,1]],
                ["inv.write",         [1,0,0,1,0,0,0,0]],
                ["inv.update.status", [1,0,0,1,1,0,0,0]],
                ["res.read",          [1,1,1,1,0,1,1,1]],
                ["res.write",         [1,1,1,1,0,0,0,0]],
                ["res.approve",       [1,1,0,0,0,0,0,0]],
                ["contracts.read",    [1,1,1,1,0,1,1,1]],
                ["contracts.approve", [1,1,0,0,0,0,0,0]],
                ["billing.read",      [1,1,0,0,0,1,1,1]],
                ["billing.write",     [1,0,0,0,0,0,1,0]],
                ["bi.dashboards",     [1,1,1,0,0,1,1,1]],
                ["exports.create",    [1,1,0,0,0,1,1,1]],
                ["audit.read",        [1,0,0,0,0,1,0,1]],
                ["audit.export",      [1,0,0,0,0,0,0,1]],
                ["users.write",       [1,0,0,0,0,0,0,0]],
                ["settings.write",    [1,0,0,0,0,0,0,0]],
              ].map((row, i) => (
                <tr key={i}>
                  <td className="mono lead">{row[0]}</td>
                  {row[1].map((v, j) => (
                    <td key={j} style={{ textAlign: "center" }}>
                      {v ? <Ic name="check" size={13} style={{ color: "var(--success-on)" }} /> : <span style={{ color: "var(--text-4)" }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

window.PageUsers = PageUsers;
