/* global React, Ic, Btn, IconBtn, StatusBadge, Card, KPI, Segments, FilterChip */
// InMidia · Mapa de ocupação (full-bleed inside page)

const { useState: useStateMp } = React;

const DOTS = [
  // x%, y%, size, tone, label?
  [22, 22, "lg", "success", "Belém"],
  [32, 30, "sm", "success"],
  [40, 26, "sm", "success"],
  [62, 30, "lg", "warn",    "Fortaleza"],
  [70, 38, "lg", "warn",    "Recife"],
  [74, 46, "sm", "warn"],
  [72, 52, "lg", "warn",    "Salvador"],
  [50, 52, "sm", "success"],
  [48, 60, "lg", "success", "Brasília"],
  [44, 62, "sm", "success"],
  [38, 66, "lg", "success", "Goiânia"],
  [36, 72, "sm", "success"],
  [44, 74, "sm", "danger"],
  [50, 74, "lg", "success", "BH"],
  [54, 78, "lg", "success", "Rio"],
  [44, 80, "sm", "success"],
  [42, 82, "sm", "warn"],
  [40, 84, "lg", "success", "SP Capital"],
  [38, 86, "sm", "success"],
  [36, 86, "sm", "success"],
  [34, 84, "sm", "danger"],
  [38, 92, "lg", "success", "Curitiba"],
  [34, 94, "sm", "success"],
  [32, 96, "lg", "success", "Porto Alegre"],
];

function PageMap() {
  const [tone, setTone] = useStateMp("ocupacao");
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Mapa de ocupação</h1>
          <p className="page-sub">8.420 placas geolocalizadas · 7 regiões · Atualização em tempo real via SSE</p>
        </div>
        <div className="page-hd-actions">
          <Segments value={tone} onChange={setTone} options={[
            { value: "ocupacao", label: "Ocupação" }, { value: "receita", label: "Receita" }, { value: "saude", label: "Saúde" }, { value: "stale", label: "Stale" },
          ]} />
          <Btn icon="filter">Recorte</Btn>
          <Btn icon="expand">Tela cheia</Btn>
        </div>
      </div>

      <div className="grid-4">
        <KPI label="Ocupação SP" value="82,4" unit="%" delta="+2,1 p.p." deltaDir="up" sub="3.860 placas" />
        <KPI label="Ocupação RJ/MG" value="76,8" unit="%" delta="+0,8 p.p." deltaDir="up" sub="2.160 placas" />
        <KPI label="Ocupação Sul" value="71,2" unit="%" delta="-0,4 p.p." deltaDir="down" sub="1.180 placas" />
        <KPI label="Ocupação N/NE/CO" value="62,8" unit="%" delta="-3,8 p.p." deltaDir="down" sub="1.220 placas · sync degradado" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
        <Card eyebrow="MAPA · BRASIL" title="Distribuição operacional" subtitle="Cor representa ocupação · clique para detalhar" noBody>
          <div style={{ padding: 14 }}>
            <div className="map-canvas">
              <div className="map-grid" />
              {/* abstract brazil outline */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M 30 18 L 52 14 L 68 18 L 76 28 L 78 38 L 82 48 L 78 58 L 70 66 L 64 74 L 56 82 L 46 92 L 36 96 L 28 92 L 24 82 L 18 70 L 16 56 L 18 42 L 22 30 Z"
                  fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" strokeDasharray="0.6 0.6"
                />
              </svg>
              {DOTS.map(([x, y, size, t, label], i) => (
                <React.Fragment key={i}>
                  <span className={`map-dot ${t} ${size === "lg" ? "lg" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} />
                  {label && <span className="map-label" style={{ left: `${x}%`, top: `${y}%` }}>{label}</span>}
                </React.Fragment>
              ))}
              {/* legend */}
              <div style={{
                position: "absolute", left: 14, bottom: 14,
                background: "rgba(11,13,20,0.72)", backdropFilter: "blur(10px)",
                border: "1px solid var(--border-faint)", borderRadius: 8,
                padding: "8px 12px", display: "grid", gap: 6,
                fontSize: 11,
              }}>
                <div className="eyebrow" style={{ fontSize: 9 }}>OCUPAÇÃO</div>
                <div style={{ display: "flex", gap: 14 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="map-dot success" style={{ position: "relative", width: 8, height: 8 }} />{">"}80%</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="map-dot warn" style={{ position: "relative", width: 8, height: 8 }} />50–80%</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="map-dot danger" style={{ position: "relative", width: 8, height: 8 }} />{"<"}50% / manutenção</span>
                </div>
              </div>
              {/* live counter */}
              <div style={{
                position: "absolute", right: 14, top: 14,
                background: "rgba(11,13,20,0.72)", backdropFilter: "blur(10px)",
                border: "1px solid var(--border-faint)", borderRadius: 8,
                padding: "8px 12px",
                fontSize: 11.5,
                display: "grid", gap: 4,
              }}>
                <div className="eyebrow" style={{ fontSize: 9 }}>AO VIVO</div>
                <div className="tnum"><span className="dotind success" />8.420 placas</div>
                <div className="tnum"><span className="dotind warn" />284 atenção</div>
                <div className="tnum"><span className="dotind danger" />112 manutenção</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="col">
          <Card title="Por região" eyebrow="DRILLDOWN" actions={<IconBtn icon="more-h" />}>
            <div className="col" style={{ gap: 6 }}>
              {[
                ["SP Capital",   2840, 82, "success"],
                ["SP Interior",  1610, 79, "success"],
                ["RJ Grande",    1240, 76, "success"],
                ["MG",           920,  74, "warn"],
                ["Sul",          850,  71, "warn"],
                ["Nordeste",     640,  62, "danger"],
                ["Norte/CO",     320,  58, "danger"],
              ].map((r, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr auto", gap: 6,
                  padding: "8px 10px",
                  background: "var(--bg-input)", borderRadius: 6,
                  fontSize: 12,
                }}>
                  <div>
                    <div style={{ color: "var(--text-1)", fontWeight: 500 }}>{r[0]}</div>
                    <div className="muted tnum" style={{ fontSize: 11 }}>{r[1].toLocaleString("pt-BR")} placas</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tnum" style={{ color: r[3] === "danger" ? "var(--danger-on)" : r[3] === "warn" ? "var(--warning-on)" : "var(--success-on)", fontWeight: 700, fontSize: 13 }}>{r[2]}%</div>
                    <div className="muted" style={{ fontSize: 10 }}>ocupação</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Eventos de mapa" eyebrow="LIVE" subtitle="Últimos 30 min">
            <div className="col" style={{ gap: 0 }}>
              <div className="tl-item">
                <span className="tl-dot success" />
                <div className="tl-content">
                  <div><span className="tl-actor">SP-1284</span> <span className="tl-action">instalada</span></div>
                  <div className="tl-detail">Av. Paulista 1500</div>
                </div>
                <span className="tl-time">38m</span>
              </div>
              <div className="tl-item">
                <span className="tl-dot warn" />
                <div className="tl-content">
                  <div><span className="tl-actor">PE-0188</span> <span className="tl-action">stale</span></div>
                  <div className="tl-detail">Recife · sync atrasado 4m</div>
                </div>
                <span className="tl-time">22m</span>
              </div>
              <div className="tl-item">
                <span className="tl-dot danger" />
                <div className="tl-content">
                  <div><span className="tl-actor">RS-0420</span> <span className="tl-action">manutenção</span></div>
                  <div className="tl-detail">Porto Alegre · LED queimado</div>
                </div>
                <span className="tl-time">1h</span>
              </div>
              <div className="tl-item">
                <span className="tl-dot info" />
                <div className="tl-content">
                  <div><span className="tl-actor">DF-0080</span> <span className="tl-action">reservada</span></div>
                  <div className="tl-detail">Brasília · Gov. Federal</div>
                </div>
                <span className="tl-time">1h</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.PageMap = PageMap;
