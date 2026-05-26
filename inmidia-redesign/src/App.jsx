/* global React, Sidebar, Topbar, PageOverview, PageInventory, PageReservations, PageHealth, PageAnalytics, PageAudit, PageUsers, PageMap, PageOrders, PageExports, PageStubFor, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakColor, TweakToggle, TweakSelect, NAV */
// InMidia · App entry

const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "default",
  "accent": "#6366f1",
  "syncBadge": "online"
}/*EDITMODE-END*/;

const NAV_BY_ID = {};
NAV.forEach(s => s.items.forEach(it => { NAV_BY_ID[it.id] = it; }));

const CRUMBS = {
  overview:     ["InMidia", "Operação", "Visão geral"],
  inventory:    ["InMidia", "Operação", "Inventário"],
  reservations: ["InMidia", "Operação", "Reservas"],
  map:          ["InMidia", "Operação", "Mapa de ocupação"],
  orders:       ["InMidia", "Operação", "Ordens de campo"],
  analytics:    ["InMidia", "Gestão", "BI & Analytics"],
  clients:      ["InMidia", "Gestão", "Clientes & contratos"],
  billing:      ["InMidia", "Gestão", "Faturamento"],
  exports:      ["InMidia", "Gestão", "Exportações"],
  health:       ["InMidia", "Diagnóstico", "Saúde do sistema"],
  audit:        ["InMidia", "Diagnóstico", "Auditoria"],
  incidents:    ["InMidia", "Diagnóstico", "Incidentes"],
  users:        ["InMidia", "Administração", "Usuários & RBAC"],
  settings:     ["InMidia", "Administração", "Configurações"],
  integrations: ["InMidia", "Administração", "Integrações"],
};

function App() {
  const [page, setPage] = useStateApp("overview");
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply density + accent globally
  useEffectApp(() => {
    document.body.setAttribute("data-density", tweaks.density);
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    // derive light/glow/soft/dim from chosen accent
    document.documentElement.style.setProperty("--accent-light", tweaks.accent);
    document.documentElement.style.setProperty("--accent-glow", tweaks.accent + "47");
    document.documentElement.style.setProperty("--accent-border", tweaks.accent + "47");
    document.documentElement.style.setProperty("--accent-soft", tweaks.accent + "1A");
    document.documentElement.style.setProperty("--accent-dim", tweaks.accent + "1F");
  }, [tweaks.density, tweaks.accent]);

  const lastSync = tweaks.syncBadge === "online" ? "ha 14s" : tweaks.syncBadge === "degraded" ? "ha 4m 12s" : "ha 1h";

  const renderPage = () => {
    switch (page) {
      case "overview":     return <PageOverview />;
      case "inventory":    return <PageInventory />;
      case "reservations": return <PageReservations />;
      case "map":          return <PageMap />;
      case "orders":       return <PageOrders />;
      case "analytics":    return <PageAnalytics />;
      case "health":       return <PageHealth />;
      case "audit":        return <PageAudit />;
      case "users":        return <PageUsers />;
      case "exports":      return <PageExports />;
      case "clients":      return PageStubFor("clients");
      case "billing":      return PageStubFor("billing");
      case "incidents":    return PageStubFor("incidents");
      case "settings":     return PageStubFor("settings");
      case "integrations": return PageStubFor("integrations");
      default:             return <PageOverview />;
    }
  };

  return (
    <div className="app" data-screen-label={`InMidia · ${(NAV_BY_ID[page] || {}).label || page}`}>
      <Sidebar page={page} onNav={setPage} />
      <div className="main-col">
        <Topbar
          crumbs={CRUMBS[page] || ["InMidia"]}
          syncState={tweaks.syncBadge}
          lastSync={lastSync}
        />
        <div className="page-scroll">{renderPage()}</div>
      </div>

      <TweaksPanel title="Tweaks · InMidia" defaultOpen={false}>
        <TweakSection label="Densidade operacional" hint="Aplica em tabelas e listas">
          <TweakRadio
            value={tweaks.density}
            onChange={v => setTweak("density", v)}
            options={[
              { value: "compact",     label: "Compact" },
              { value: "default",     label: "Default" },
              { value: "comfortable", label: "Conforto" },
            ]}
          />
        </TweakSection>

        <TweakSection label="Cor de acento" hint="Sistema neutro · acento único">
          <TweakColor
            value={tweaks.accent}
            onChange={v => setTweak("accent", v)}
            options={[
              "#6366f1",
              "#8b5cf6",
              "#22c55e",
              "#f59e0b",
              "#06b6d4",
              "#ec4899",
            ]}
          />
        </TweakSection>

        <TweakSection label="Estado de sincronização" hint="Simula confiança no sync runtime">
          <TweakRadio
            value={tweaks.syncBadge}
            onChange={v => setTweak("syncBadge", v)}
            options={[
              { value: "online",    label: "Online" },
              { value: "degraded",  label: "Degradado" },
              { value: "offline",   label: "Offline" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
