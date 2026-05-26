/* global React, Ic, Avatar */
// InMidia · App Shell (Sidebar + Topbar)

const { useState: useStateShell, useEffect: useEffectShell } = React;

const NAV = [
  {
    title: "Operação",
    items: [
      { id: "overview",    label: "Visão geral",       icon: "home" },
      { id: "inventory",   label: "Inventário",        icon: "boxes",   badge: "2.4k" },
      { id: "reservations",label: "Reservas",          icon: "calendar",badge: "47", badgeKind: "warn" },
      { id: "map",         label: "Mapa de ocupação",  icon: "map" },
      { id: "orders",      label: "Ordens de campo",   icon: "list",    badge: "12" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { id: "analytics",   label: "BI & Analytics",    icon: "chart" },
      { id: "clients",     label: "Clientes & contratos", icon: "building" },
      { id: "billing",     label: "Faturamento",       icon: "receipt" },
      { id: "exports",     label: "Exportações",       icon: "download",   badge: "3", badgeKind: "" },
    ],
  },
  {
    title: "Diagnóstico",
    items: [
      { id: "health",      label: "Saúde do sistema",  icon: "heart-pulse" },
      { id: "audit",       label: "Auditoria",         icon: "history" },
      { id: "incidents",   label: "Incidentes",        icon: "alert-tri", badge: "1", badgeKind: "danger" },
    ],
  },
  {
    title: "Administração",
    items: [
      { id: "users",       label: "Usuários & RBAC",   icon: "users" },
      { id: "settings",    label: "Configurações",     icon: "settings" },
      { id: "integrations",label: "Integrações",       icon: "link" },
    ],
  },
];

function Sidebar({ page, onNav, density }) {
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-mark">iM</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-brand-name">
            InMidia <span className="sb-brand-env">prod</span>
          </div>
        </div>
        <IconBtnLocal icon="side-toggle" />
      </div>

      <div className="sb-workspace" title="Trocar workspace">
        <div className="sb-ws-avatar">GO</div>
        <div style={{ minWidth: 0 }}>
          <div className="sb-ws-name ellipsis">Grupo Outlook</div>
          <div className="sb-ws-meta">14 marcas · 8.420 placas</div>
        </div>
        <Ic name="chev-down" size={12} style={{ color: "var(--text-3)" }} />
      </div>

      <div className="sb-scroll">
        {NAV.map(sec => (
          <div className="sb-section" key={sec.title}>
            <div className="sb-section-title">
              <span>{sec.title}</span>
            </div>
            {sec.items.map(it => (
              <button
                key={it.id}
                className={`sb-item ${page === it.id ? "active" : ""}`}
                onClick={() => onNav(it.id)}
              >
                <Ic name={it.icon} size={14} className="ico" />
                <span className="ellipsis">{it.label}</span>
                {it.badge && <span className={`sb-badge ${it.badgeKind || ""}`}>{it.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="sb-foot">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "4px 8px 8px", fontSize: 11, color: "var(--text-3)",
          borderBottom: "1px solid var(--border-faint)", marginBottom: 4,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="dotind success" />
            v4.18.2 · build c47e
          </span>
          <span className="kbd">?</span>
        </div>
        <div className="sb-foot-user">
          <div className="sb-foot-avatar">RC</div>
          <div style={{ minWidth: 0 }}>
            <div className="sb-foot-user-name ellipsis">Renato Camargo</div>
            <div className="sb-foot-user-role">Operações · Admin</div>
          </div>
          <Ic name="chev-up" size={12} style={{ color: "var(--text-3)" }} />
        </div>
      </div>
    </aside>
  );
}

function IconBtnLocal({ icon }) {
  return <button className="icon-btn"><Ic name={icon} size={14} /></button>;
}

function Topbar({ crumbs, syncState = "online", lastSync = "ha 14s", onCmd }) {
  return (
    <div className="tb">
      <div className="tb-crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="tb-crumb-sep">/</span>}
            <span className={`tb-crumb ${i === crumbs.length - 1 ? "now" : ""}`}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      <button className="tb-search" onClick={onCmd}>
        <Ic name="search" size={13} />
        <span className="tb-search-text">Buscar placa, cliente, reserva, contrato…</span>
        <span className="tb-kbd">⌘ K</span>
      </button>

      <div className="tb-right">
        <div className={`tb-sync ${syncState}`} title="Confiança de sincronização">
          <span className="tb-sync-dot" />
          <span style={{ fontWeight: 600, color: "var(--text-1)" }}>
            {syncState === "online" ? "Sincronizado" : syncState === "degraded" ? "Sync degradado" : "Offline"}
          </span>
          <span className="tb-sync-time">· {lastSync}</span>
        </div>
        <div className="tb-divider" />
        <IconBtn icon="play-circ" title="Iniciar tour operacional" />
        <IconBtn icon="bell" dot title="Notificações (3)" />
        <IconBtn icon="lifebuoy" title="Suporte" />
        <div className="tb-divider" />
        <button className="icon-btn" title="Conta" style={{ width: 28 }}>
          <Avatar name="Renato Camargo" size={22} />
        </button>
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.NAV = NAV;
