/* global React, Ic, Btn, IconBtn, StatusBadge, Card, KPI, Segments, LineChart, Donut, StackBar */
// InMidia · BI & Analytics

const { useState: useStateAn } = React;

function PageAnalytics() {
  const [range, setRange] = useStateAn("90d");
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">BI & Analytics</h1>
          <p className="page-sub">Análise comparativa de receita, ocupação e mix por região, formato e cliente.</p>
        </div>
        <div className="page-hd-actions">
          <Segments value={range} onChange={setRange} options={[
            { value: "30d", label: "30d" }, { value: "90d", label: "90d" }, { value: "ytd", label: "YTD" }, { value: "12m", label: "12m" },
          ]} />
          <Btn icon="filter">Recorte</Btn>
          <Btn icon="download">Exportar dataset</Btn>
        </div>
      </div>

      <div className="grid-4">
        <KPI label="Receita 90d" prefix="R$" value="12,84" unit="mi" delta="+22,1%" deltaDir="up" sub="vs período anterior" spark={[8.2,9,9.4,10,10.5,11,11.3,11.8,12.1,12.4,12.6,12.84]} />
        <KPI label="Ticket médio" prefix="R$" value="184,2" unit="k" delta="+6,4%" deltaDir="up" sub="por contrato fechado" spark={[170,172,175,178,180,181,182,183,183,184,184,184]} />
        <KPI label="Sell-through" value="76,8" unit="%" delta="+4,2 p.p." deltaDir="up" sub="placas vendidas / disponíveis" spark={[70,71,72,73,73,74,75,75,76,76,76,76.8]} />
        <KPI label="Churn de contratos" value="3,8" unit="%" delta="-0,4 p.p." deltaDir="up" sub="anualizado · meta: <5%" spark={[5,4.8,4.6,4.4,4.2,4.1,4.0,4.0,3.9,3.9,3.8,3.8]} />
      </div>

      <Card
        title="Receita por região"
        subtitle="Comparativo entre realizado e previsto · R$ mil · 90 dias"
        eyebrow="RECEITA"
        actions={<>
          <span className="bd muted" style={{ background: "transparent" }}><span className="bd-dot" style={{ background: "var(--accent-light)" }} />Previsto</span>
          <span className="bd muted" style={{ background: "transparent" }}><span className="bd-dot" style={{ background: "var(--success-on)" }} />Realizado</span>
          <span className="bd muted" style={{ background: "transparent" }}><span className="bd-dot" style={{ background: "var(--info-on)" }} />Pipeline</span>
          <IconBtn icon="more-h" />
        </>}
      >
        <LineChart
          width={1200} height={260}
          series={[
            { name: "Previsto",   color: "#818cf8", data: gen(45, 2400, 280, 0.06) },
            { name: "Realizado",  color: "#4ade80", data: gen(45, 2200, 320, 0.10) },
            { name: "Pipeline",   color: "#60a5fa", data: gen(45, 1600, 220, 0.04) },
          ]}
          xLabels={Array.from({ length: 45 }).map((_, i) => i % 5 === 0 ? `S${Math.floor(i / 5) + 1}` : "")}
          yTicks={5}
        />
      </Card>

      <div className="grid-2">
        <Card title="Por formato" subtitle="Distribuição de receita · 90d" eyebrow="FORMATO">
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center" }}>
            <Donut size={180} thickness={20} data={[
              { value: 5240, color: "#6366f1" },
              { value: 2860, color: "#a855f7" },
              { value: 1980, color: "#38bdf8" },
              { value: 1420, color: "#22c55e" },
              { value: 790,  color: "#eab308" },
            ]} />
            <div className="col" style={{ gap: 8 }}>
              {[
                { label: "Frontlight",   v: "R$ 5,24 mi", pct: 41, c: "#6366f1", d: "+12%" },
                { label: "Backlight",    v: "R$ 2,86 mi", pct: 22, c: "#a855f7", d: "+6%" },
                { label: "Painel LED",   v: "R$ 1,98 mi", pct: 15, c: "#38bdf8", d: "+34%" },
                { label: "Empena",       v: "R$ 1,42 mi", pct: 11, c: "#22c55e", d: "+4%" },
                { label: "Mobiliário",   v: "R$ 0,79 mi", pct: 6,  c: "#eab308", d: "-2%" },
              ].map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "8px 1fr auto auto auto", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                  <span style={{ width: 8, height: 8, background: r.c, borderRadius: 2 }} />
                  <span style={{ color: "var(--text-1)" }}>{r.label}</span>
                  <span className="tnum muted">{r.v}</span>
                  <span className="tnum" style={{ color: "var(--text-1)", fontWeight: 600, minWidth: 30, textAlign: "right" }}>{r.pct}%</span>
                  <span className="tnum" style={{ color: r.d.startsWith("+") ? "var(--success-on)" : "var(--danger-on)", fontWeight: 600, minWidth: 38, textAlign: "right" }}>{r.d}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Top 10 clientes" subtitle="Receita realizada · 90 dias" eyebrow="CLIENTES" actions={<Btn size="sm" iconRight="chev-right">Ver todos</Btn>}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>Cliente</th>
                <th>Setor</th>
                <th className="num">Contratos</th>
                <th className="num">Receita</th>
                <th className="num">YoY</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Stella Artois", "Bebidas",      8,  1280, "+18%"],
                ["Itaú",          "Financeiro",   14, 1140, "+8%"],
                ["Magazine Luiza","Varejo",       6,  942,  "+34%"],
                ["Boticário",     "Beleza",       4,  812,  "+22%"],
                ["Carrefour",     "Varejo",       9,  724,  "+4%"],
                ["Banco BTG",     "Financeiro",   3,  618,  "+62%"],
                ["Coca-Cola",     "Bebidas",      5,  584,  "-2%"],
                ["Renner",        "Varejo",       7,  462,  "+12%"],
                ["Vivo",          "Telecom",      4,  412,  "+6%"],
                ["Petrobras",     "Energia",      2,  384,  "+1%"],
              ].map((c, i) => (
                <tr key={i}>
                  <td className="muted tnum" style={{ paddingLeft: 14 }}>{i + 1}</td>
                  <td className="lead">{c[0]}</td>
                  <td className="muted">{c[1]}</td>
                  <td className="num">{c[2]}</td>
                  <td className="num">R$ {c[3]} k</td>
                  <td className="num" style={{ color: c[4].startsWith("+") ? "var(--success-on)" : "var(--danger-on)", fontWeight: 600 }}>{c[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Receita por região · YoY" subtitle="Mil reais · comparativo 2025 vs 2026" eyebrow="GEO">
        <StackBar rows={[
          { label: "SP Capital",   total: 4280, segs: [{ value: 2840, color: "var(--accent-light)" }, { value: 1440, color: "var(--success)" }] },
          { label: "SP Interior",  total: 2120, segs: [{ value: 1280, color: "var(--accent-light)" }, { value: 840,  color: "var(--success)" }] },
          { label: "RJ Grande",    total: 1820, segs: [{ value: 1140, color: "var(--accent-light)" }, { value: 680,  color: "var(--success)" }] },
          { label: "MG",           total: 1180, segs: [{ value: 720,  color: "var(--accent-light)" }, { value: 460,  color: "var(--success)" }] },
          { label: "Sul",          total: 1080, segs: [{ value: 680,  color: "var(--accent-light)" }, { value: 400,  color: "var(--success)" }] },
          { label: "Nordeste",     total: 880,  segs: [{ value: 540,  color: "var(--accent-light)" }, { value: 340,  color: "var(--success)" }] },
          { label: "Norte/CO",     total: 480,  segs: [{ value: 280,  color: "var(--accent-light)" }, { value: 200,  color: "var(--success)" }] },
        ]} />
        <div className="row" style={{ marginTop: 14, gap: 16, fontSize: 11.5, color: "var(--text-3)" }}>
          <span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--accent-light)", marginRight: 5 }} />2026 YTD</span>
          <span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "var(--success)", marginRight: 5 }} />2025 mesmo período</span>
        </div>
      </Card>
    </div>
  );
}

function gen(n, base, amp, growth) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.round(base + amp * Math.sin(i / 3.2) + i * base * growth / n + (i % 7) * amp * 0.12));
  }
  return out;
}

window.PageAnalytics = PageAnalytics;
