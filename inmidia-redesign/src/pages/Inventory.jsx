/* global React, Ic, Btn, IconBtn, StatusBadge, Card, FilterChip, Check, Pagination, Segments, ActionMenu, Tabs, Avatar */
// InMidia · Inventário (tabela operacional enterprise)

const { useState: useStateInv, useMemo: useMemoInv } = React;

const PLACAS = [
  ["IM-SP-1284", "Av. Paulista, 1500 · Bela Vista", "SP · Capital",   "Frontlight 9x3",  "active",   92, "12/05/2026", 184200, "Stella Artois", "Heineken Verão"],
  ["IM-SP-2041", "Marginal Tietê km 18 · sentido SP", "SP · Capital", "Painel LED 32m²", "active",   88, "08/05/2026", 412800, "Itaú", "Cards Premium"],
  ["IM-SP-0327", "Av. Eng. Luís Carlos Berrini, 720", "SP · Capital", "Backlight 6x3",   "pending",  0,  "—",         96400,  "—", "—"],
  ["IM-RJ-1908", "Av. Brasil, km 12 · Bonsucesso",  "RJ · Grande",     "Frontlight 12x4", "active",   95, "30/04/2026", 268000, "Magazine Luiza", "Aquecimento"],
  ["IM-MG-0712", "Av. do Contorno, 4200 · BH",       "MG",             "Empena lateral 80m²", "warn", 76, "22/04/2026", 142000, "Boticário", "Inverno"],
  ["IM-SP-2188", "Rod. Anhanguera, km 22",           "SP · Interior",  "Painel LED 24m²", "active",  84, "11/05/2026", 318600, "Carrefour", "Q2 Família"],
  ["IM-RS-0420", "Av. Ipiranga, 6680 · Porto Alegre","Sul",            "Frontlight 9x3",  "down",    0,  "07/05/2026", 96400,  "—", "—"],
  ["IM-PE-0188", "Av. Boa Viagem, 3210 · Recife",    "Nordeste",       "Backlight 6x3",   "pending", 0,  "—",         84200,  "—", "—"],
  ["IM-SP-3306", "Av. Faria Lima, 4200 · Itaim",     "SP · Capital",   "Painel LED 40m²", "active",  98, "14/05/2026", 462800, "Banco BTG", "Sempre on"],
  ["IM-RJ-2840", "Rod. Niterói-Manilha km 8",        "RJ · Grande",    "Frontlight 12x4", "active",  72, "29/04/2026", 184000, "Petrobras", "Comunicação 2026"],
  ["IM-DF-0080", "Eixo Monumental · DF",             "Norte/CO",       "Painel LED 24m²", "active",  91, "10/05/2026", 224800, "Governo Federal", "Campanha CN"],
  ["IM-SP-4022", "Av. dos Bandeirantes, km 12",      "SP · Capital",   "Frontlight 9x3",  "warn",    62, "18/04/2026", 138200, "Coca-Cola", "Verão Fim"],
  ["IM-MG-1144", "BR-381 km 488 · Betim",            "MG",             "Backlight 6x3",   "active",  82, "06/05/2026", 78200,  "Vivo", "5G Cidades"],
  ["IM-PR-0922", "Av. Iguaçu, 2400 · Curitiba",      "Sul",            "Empena lateral 60m²", "active", 78, "02/05/2026", 122000, "Renner", "Outono Couro" ],
  ["IM-BA-0608", "Av. Tancredo Neves, 1000 · SSA",   "Nordeste",       "Frontlight 9x3",  "warn",    58, "20/04/2026", 78400,  "Brastemp", "Eletro+" ],
  ["IM-SP-5101", "Av. Sumaré, 1830",                 "SP · Capital",   "Mobiliário",      "active",  88, "13/05/2026", 24800,  "Uber", "Mobilidade SP"],
];

const STATUS = {
  active:  { kind: "success",  label: "VEICULANDO" },
  pending: { kind: "warn",     label: "PENDENTE" },
  warn:    { kind: "warn",     label: "ATENÇÃO" },
  down:    { kind: "danger",   label: "MANUTENÇÃO" },
  off:     { kind: "muted",    label: "INATIVO" },
};

function PageInventory() {
  const [tab, setTab] = useStateInv("todos");
  const [view, setView] = useStateInv("table");
  const [selected, setSelected] = useStateInv(new Set([1, 5]));
  const [page, setPage] = useStateInv(1);
  const [filters, setFilters] = useStateInv({
    regiao: "SP · Capital", formato: null, cliente: null, status: null,
  });

  const rows = PLACAS;
  const toggle = (i) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };
  const allOn = selected.size === rows.length;
  const partial = selected.size > 0 && !allOn;

  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Inventário de placas</h1>
          <p className="page-sub">8.420 placas · 7 regiões · Sincronizado ha 14s · Polling 30s · SSE ativo</p>
        </div>
        <div className="page-hd-actions">
          <Btn icon="filter">Salvar visão</Btn>
          <Btn icon="upload">Importar</Btn>
          <Btn icon="download">Exportar</Btn>
          <Btn variant="primary" icon="plus">Nova placa</Btn>
        </div>
      </div>

      <Tabs
        value={tab} onChange={setTab}
        tabs={[
          { value: "todos",   label: "Todas",        count: "8.420" },
          { value: "ativas",  label: "Veiculando",   count: "6.621" },
          { value: "atencao", label: "Atenção",      count: "284"   },
          { value: "manut",   label: "Manutenção",   count: "112"   },
          { value: "pend",    label: "Pendentes",    count: "318"   },
          { value: "inativas",label: "Inativas",     count: "1.085" },
        ]}
      />

      {/* Filter bar */}
      <div className="fbar">
        <div className="fbar-search">
          <Ic name="search" size={13} style={{ color: "var(--text-3)" }} />
          <input placeholder="Buscar por código, endereço, cliente ou contrato…" />
          <span className="kbd">⌘ F</span>
        </div>
        <FilterChip label="Região" value={filters.regiao} active onClick={() => setFilters({ ...filters, regiao: null })} />
        <FilterChip label="Formato" />
        <FilterChip label="Cliente" />
        <FilterChip label="Tarifa" />
        <FilterChip label="Inspeção" />
        <FilterChip label="+ Filtro" />
        <div style={{ flex: 1 }} />
        <div className="btn-group">
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Ic name="list" size={13} /></button>
          <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}><Ic name="grid" size={13} /></button>
          <button className={view === "map" ? "on" : ""} onClick={() => setView("map")}><Ic name="map" size={13} /></button>
        </div>
        <IconBtn icon="settings" title="Colunas e densidade" />
      </div>

      {/* Bulk action bar (when selected) */}
      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-border)",
          borderRadius: 8, marginTop: -8,
        }}>
          <span style={{ fontSize: 12.5, color: "var(--text-1)", fontWeight: 600 }}>
            {selected.size} placa{selected.size > 1 ? "s" : ""} selecionada{selected.size > 1 ? "s" : ""}
          </span>
          <span className="vdivider" />
          <Btn size="sm" icon="tag">Etiquetar</Btn>
          <Btn size="sm" icon="calendar">Reservar</Btn>
          <Btn size="sm" icon="edit">Editar tarifa</Btn>
          <Btn size="sm" icon="external">Atribuir ordem</Btn>
          <div style={{ flex: 1 }} />
          <Btn size="sm" icon="x" onClick={() => setSelected(new Set())}>Limpar</Btn>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="check"><Check state={allOn ? true : partial ? "partial" : false} onClick={() => allOn ? setSelected(new Set()) : setSelected(new Set(rows.map((_, i) => i)))} /></th>
                <th>Código <Ic name="chev-down" size={10} style={{ display: "inline", verticalAlign: -1 }} /></th>
                <th>Localização</th>
                <th>Região</th>
                <th>Formato</th>
                <th>Status</th>
                <th className="num">Ocupação 30d</th>
                <th>Última inspeção</th>
                <th>Cliente atual</th>
                <th className="num">Tarifa diária</th>
                <th className="act"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const [code, loc, region, format, status, occ, insp, tariff, client, campaign] = r;
                const s = STATUS[status];
                const isSel = selected.has(i);
                const fmtBRL = (n) => "R$ " + n.toLocaleString("pt-BR");
                return (
                  <tr key={i} className={isSel ? "selected" : ""}>
                    <td className="check"><Check state={isSel} onClick={() => toggle(i)} /></td>
                    <td className="id">{code}</td>
                    <td className="lead ellipsis" style={{ maxWidth: 260 }}>{loc}</td>
                    <td>{region}</td>
                    <td>{format}</td>
                    <td><StatusBadge kind={s.kind}>{s.label}</StatusBadge></td>
                    <td className="num">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <span style={{ width: 56, height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}>
                          <span style={{ display: "block", width: `${occ}%`, height: "100%", background: occ >= 80 ? "var(--success-on)" : occ >= 50 ? "var(--warning-on)" : occ === 0 ? "var(--text-4)" : "var(--danger-on)" }} />
                        </span>
                        <span style={{ minWidth: 30, textAlign: "right" }}>{occ}%</span>
                      </div>
                    </td>
                    <td className="tnum muted">{insp}</td>
                    <td className="ellipsis" style={{ maxWidth: 140 }}>
                      {client === "—" ? <span className="muted">—</span> : <>
                        <span style={{ color: "var(--text-1)" }}>{client}</span>
                        <span className="muted" style={{ display: "block", fontSize: 11 }}>{campaign}</span>
                      </>}
                    </td>
                    <td className="num">{fmtBRL(tariff)}</td>
                    <td className="act"><ActionMenu items={[
                      { label: "Ver detalhe",      icon: "eye",   value: "view", kbd: "↵" },
                      { label: "Editar placa",     icon: "edit",  value: "edit" },
                      { label: "Abrir no mapa",    icon: "map",   value: "map" },
                      "-",
                      { label: "Reservar",         icon: "calendar", value: "reserve" },
                      { label: "Abrir ordem",     icon: "external", value: "order" },
                      "-",
                      { label: "Pausar veiculação",icon: "pause", value: "pause", danger: true },
                    ]} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination total={8420} page={page} onPage={setPage} perPage={50} />
      </div>
    </div>
  );
}

window.PageInventory = PageInventory;
