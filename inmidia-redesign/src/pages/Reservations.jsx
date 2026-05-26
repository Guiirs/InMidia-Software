/* global React, Ic, Btn, IconBtn, StatusBadge, Card, Tabs, Segments, KPI, Avatar, ActionMenu */
// InMidia · Reservas (workflow board)

const { useState: useStateRes } = React;

const COLS = [
  { id: "rascunho",  title: "Rascunho",       count: 8,  color: "var(--text-3)" },
  { id: "aprovacao", title: "Em aprovação",   count: 12, color: "var(--info-on)" },
  { id: "assinado",  title: "Assinado",       count: 9,  color: "var(--purple)" },
  { id: "veicul",    title: "Em veiculação",  count: 24, color: "var(--success-on)" },
  { id: "encerrado", title: "Encerrado",      count: 47, color: "var(--text-3)" },
];

const RESERVATIONS = {
  rascunho: [
    { id: "RS-7901", title: "Heineken · Verão estendido", client: "Heineken", placas: 42, value: "R$ 612.400", days: "30d", risk: "low", owner: "MS" },
    { id: "RS-7898", title: "Magalu · Black Friday teaser", client: "Magazine Luiza", placas: 86, value: "R$ 1,2 mi", days: "14d", risk: "med", owner: "PV" },
    { id: "RS-7894", title: "BTG · Always-on Q2", client: "Banco BTG", placas: 24, value: "R$ 462.000", days: "60d", risk: "low", owner: "AC" },
  ],
  aprovacao: [
    { id: "RS-7820", title: "Itaú · Cards Premium", client: "Itaú", placas: 8, value: "R$ 184.200", days: "30d", risk: "high", warn: "vence em 48h", owner: "PV" },
    { id: "RS-7815", title: "Stella Artois · Inverno", client: "Stella Artois", placas: 14, value: "R$ 268.000", days: "30d", risk: "high", warn: "sem contrato", owner: "MS" },
    { id: "RS-7811", title: "Carrefour · Volta às aulas", client: "Carrefour", placas: 32, value: "R$ 542.000", days: "45d", risk: "med", owner: "AC" },
    { id: "RS-7808", title: "Vivo · 5G Capitais", client: "Vivo", placas: 18, value: "R$ 312.000", days: "30d", risk: "low", owner: "RC" },
  ],
  assinado: [
    { id: "RS-7780", title: "Boticário · Inverno", client: "Boticário", placas: 118, value: "R$ 1,1 mi", days: "30d", risk: "low", start: "26/05", owner: "PV" },
    { id: "RS-7762", title: "Renner · Outono Couro", client: "Renner", placas: 64, value: "R$ 718.000", days: "21d", risk: "low", start: "27/05", owner: "AC" },
    { id: "RS-7748", title: "Coca-Cola · Refrigeração", client: "Coca-Cola", placas: 92, value: "R$ 942.000", days: "30d", risk: "low", start: "01/06", owner: "MS" },
  ],
  veicul: [
    { id: "RS-7620", title: "Magalu · Aquecimento", client: "Magazine Luiza", placas: 56, value: "R$ 612.000", days: "12/30", risk: "low", start: "07/05", owner: "AC" },
    { id: "RS-7612", title: "Itaú · Cards Premium", client: "Itaú", placas: 24, value: "R$ 412.800", days: "21/30", risk: "low", start: "28/04", owner: "PV" },
    { id: "RS-7588", title: "Petrobras · Comunicação 2026", client: "Petrobras", placas: 38, value: "R$ 684.000", days: "8/60", risk: "low", start: "11/05", owner: "RC" },
    { id: "RS-7541", title: "Stella Artois · Heineken Verão", client: "Stella Artois", placas: 83, value: "R$ 1,4 mi", days: "26/30", risk: "med", warn: "renovação?", owner: "MS" },
  ],
  encerrado: [
    { id: "RS-7402", title: "Brastemp · Q1 Eletro", client: "Brastemp", placas: 28, value: "R$ 384.000", days: "concluído", risk: "low", owner: "PV" },
    { id: "RS-7388", title: "Uber · Mobilidade SP", client: "Uber", placas: 14, value: "R$ 142.000", days: "concluído", risk: "low", owner: "AC" },
  ],
};

function PageReservations() {
  const [view, setView] = useStateRes("board");
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-sub">100 reservas ativas · 38 vencendo em 7d · Fluxo comercial integrado a contratos e faturamento.</p>
        </div>
        <div className="page-hd-actions">
          <Segments value={view} onChange={setView} options={[
            { value: "board", label: "Workflow" }, { value: "list", label: "Lista" }, { value: "calendar", label: "Calendário" }, { value: "timeline", label: "Timeline" },
          ]} />
          <Btn icon="filter">Filtros</Btn>
          <Btn icon="download">Exportar</Btn>
          <Btn variant="primary" icon="plus">Nova reserva</Btn>
        </div>
      </div>

      <div className="grid-4">
        <KPI label="Pipeline previsto" prefix="R$" value="8,42" unit="mi" delta="+18%" deltaDir="up" sub="60 dias · 100 reservas" />
        <KPI label="Conversão média" value="74,2" unit="%" delta="+2,1 p.p." deltaDir="up" sub="aprovação → assinado" />
        <KPI label="Tempo médio em aprovação" value="2,8" unit="d" delta="-0,4d" deltaDir="up" sub="meta SLA: 3d" />
        <KPI label="Reservas em risco" value="11" delta="+3" deltaDir="down" sub="vencimento <48h · sem contrato" />
      </div>

      {/* Board */}
      <div className="wf">
        {COLS.map(col => (
          <div className="wf-col" key={col.id}>
            <div className="wf-col-hd">
              <span className="wf-col-title">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.color, display: "inline-block" }} />
                {col.title}
                <span className="tnum" style={{ background: "var(--bg-input)", padding: "1px 6px", borderRadius: 999, fontSize: 10.5, color: "var(--text-3)" }}>{col.count}</span>
              </span>
              <IconBtn icon="more-h" />
            </div>
            <div className="wf-col-list">
              {(RESERVATIONS[col.id] || []).map(r => <ReservationCard key={r.id} r={r} colId={col.id} />)}
              <button className="btn ghost" style={{ height: 30, justifyContent: "center", marginTop: 4, color: "var(--text-3)" }}>
                <Ic name="plus" size={12} /> Adicionar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReservationCard({ r, colId }) {
  return (
    <div className="wf-card">
      <div className="between">
        <span className="wf-card-id">{r.id}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {r.warn && <StatusBadge kind="danger" size={undefined} dot={false}>{r.warn}</StatusBadge>}
          {colId === "assinado" && <StatusBadge kind="info" dot={false}>{r.start}</StatusBadge>}
          {colId === "veicul" && <span className="bd success" style={{ height: 18, fontSize: 10 }}>{r.days}</span>}
        </div>
      </div>
      <div className="wf-card-title">{r.title}</div>
      <div className="wf-card-meta">
        <span>{r.placas} placas · {r.value}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Avatar name={r.owner === "MS" ? "Mariana Souza" : r.owner === "PV" ? "Pedro Vidal" : r.owner === "AC" ? "Ana Carvalho" : "Renato Camargo"}
            size={16}
            tone={r.owner === "MS" ? "rose" : r.owner === "PV" ? "amber" : r.owner === "AC" ? "teal" : "indigo"} />
          {colId === "veicul" || colId === "encerrado" ? null :
            <span style={{ color: r.risk === "high" ? "var(--danger-on)" : r.risk === "med" ? "var(--warning-on)" : "var(--text-3)" }}>{r.days}</span>}
        </span>
      </div>
    </div>
  );
}

window.PageReservations = PageReservations;
