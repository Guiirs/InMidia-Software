/* global React, Ic, KPI, Card, Btn, IconBtn, StatusBadge, ExceptionCard, Avatar, MiniBar, LineChart, StackBar, Donut, Segments */
// InMidia · Visão Geral (cockpit operacional)

const { useState: useStateOv } = React;

function PageOverview() {
  const [range, setRange] = useStateOv("30d");
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">
            Visão geral
            <StatusBadge kind="success" size="lg">OPERACIONAL</StatusBadge>
          </h1>
          <p className="page-sub">Cockpit operacional. Exceções, sincronização e movimentação dos últimos {range === "7d" ? "7 dias" : range === "30d" ? "30 dias" : "90 dias"}.</p>
        </div>
        <div className="page-hd-actions">
          <Segments value={range} onChange={setRange} options={[
            { value: "7d", label: "7d" }, { value: "30d", label: "30d" }, { value: "90d", label: "90d" }, { value: "ytd", label: "YTD" },
          ]} />
          <Btn icon="download">Exportar</Btn>
          <Btn icon="refresh" title="Reprocessar">Recalcular</Btn>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid-4">
        <KPI
          label="Receita prevista"
          prefix="R$"
          value="4,28"
          unit="mi"
          delta="+12,4%"
          deltaDir="up"
          sub="vs período anterior"
          spark={[3.2, 3.5, 3.4, 3.8, 3.9, 4.0, 4.1, 4.0, 4.2, 4.3, 4.2, 4.28]}
        />
        <KPI
          label="Ocupação inventário"
          value="78,6"
          unit="%"
          delta="+3,1 p.p."
          deltaDir="up"
          sub="6.621 de 8.420 placas"
          spark={[71, 72, 73, 75, 74, 76, 76, 77, 77, 78, 78, 78.6]}
        />
        <KPI
          label="Reservas ativas"
          value="1.247"
          delta="-2,8%"
          deltaDir="down"
          sub="38 vencendo em 7d"
          spark={[1290, 1310, 1305, 1280, 1270, 1265, 1260, 1255, 1250, 1248, 1245, 1247]}
        />
        <KPI
          label="Faturamento MTD"
          prefix="R$"
          value="2,91"
          unit="mi"
          delta="+8,7%"
          deltaDir="up"
          sub="84,2% da meta · 19 dias"
          spark={[1.2, 1.5, 1.8, 2.0, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.85, 2.91]}
        />
      </div>

      {/* Exceptions — exception-first principle */}
      <Card
        title="Itens que precisam de atenção"
        subtitle="Anomalias e bloqueios operacionais. Ordenado por impacto na receita."
        eyebrow="EXCEÇÕES"
        actions={<>
          <Btn size="sm" icon="filter">Filtrar</Btn>
          <Btn size="sm" icon="external">Ver todos (23)</Btn>
        </>}
      >
        <div className="col" style={{ gap: 8 }}>
          <ExceptionCard
            tone="danger" icon="alert-tri"
            title="3 reservas vencendo em 48h sem assinatura de contrato"
            meta="Cliente: Stella Artois · Heineken · Itaú · Impacto: R$ 384.200"
            count="3"
            action={{ label: "Revisar reservas" }}
          />
          <ExceptionCard
            tone="warn" icon="package"
            title="12 placas com instalação pendente há mais de 7 dias"
            meta="Equipe SP-Sul · Bloqueia veiculação de 8 campanhas"
            count="12"
            action={{ label: "Abrir ordens" }}
          />
          <ExceptionCard
            tone="warn" icon="radio"
            title="Sync degradado · região Nordeste · canal SSE intermitente"
            meta="Tempo médio de propagação: 4m12s (esperado: <30s) · Iniciado ha 1h18m"
            count="1"
            action={{ label: "Diagnosticar" }}
          />
          <ExceptionCard
            tone="info" icon="file-text"
            title="5 contratos aguardando aprovação financeira"
            meta="Última movimentação: 2 dias · Janela contratual: 14 dias"
            count="5"
            action={{ label: "Encaminhar" }}
          />
        </div>
      </Card>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
        {/* Left: revenue chart + region table */}
        <div className="col" style={{ gap: 12 }}>
          <Card
            title="Receita realizada x prevista"
            subtitle="Comparativo diário · R$ mil"
            eyebrow="FINANCEIRO"
            actions={<>
              <span className="bd muted" style={{ background: "transparent" }}>
                <span className="bd-dot" style={{ background: "var(--accent-light)" }} />Previsto
              </span>
              <span className="bd muted" style={{ background: "transparent" }}>
                <span className="bd-dot" style={{ background: "var(--success-on)" }} />Realizado
              </span>
              <IconBtn icon="more-h" />
            </>}
          >
            <LineChart
              width={760} height={210}
              series={[
                { name: "Previsto", color: "#818cf8", data: [120,128,135,142,140,150,155,162,168,172,175,180,184,188,192,196,200,205,210,214,218,222,226,230,234,238,242,245,248,251] },
                { name: "Realizado", color: "#4ade80", data: [118,124,130,138,142,148,152,158,164,170,176,182,186,190,195,200,206,212,218,224,228,232,238,242,246,252,256,261,266,271] },
              ]}
              xLabels={["01","","","","05","","","","","10","","","","","15","","","","","20","","","","","25","","","","","30"]}
              yTicks={5}
            />
          </Card>

          <Card
            title="Ocupação por região"
            subtitle="Distribuição de status do inventário"
            eyebrow="INVENTÁRIO"
            actions={<Btn size="sm" iconRight="chev-right">Detalhar</Btn>}
          >
            <StackBar rows={[
              { label: "SP Capital", total: 2840, segs: [
                { value: 2240, color: "var(--success)" },
                { value: 380,  color: "var(--warning)" },
                { value: 140,  color: "var(--danger)" },
                { value: 80,   color: "var(--text-4)" },
              ]},
              { label: "SP Interior", total: 1610, segs: [
                { value: 1280, color: "var(--success)" },
                { value: 210,  color: "var(--warning)" },
                { value: 90,   color: "var(--danger)" },
                { value: 30,   color: "var(--text-4)" },
              ]},
              { label: "RJ Grande", total: 1240, segs: [
                { value: 940,  color: "var(--success)" },
                { value: 180,  color: "var(--warning)" },
                { value: 80,   color: "var(--danger)" },
                { value: 40,   color: "var(--text-4)" },
              ]},
              { label: "MG", total: 920, segs: [
                { value: 720,  color: "var(--success)" },
                { value: 130,  color: "var(--warning)" },
                { value: 50,   color: "var(--danger)" },
                { value: 20,   color: "var(--text-4)" },
              ]},
              { label: "Sul", total: 850, segs: [
                { value: 690,  color: "var(--success)" },
                { value: 110,  color: "var(--warning)" },
                { value: 30,   color: "var(--danger)" },
                { value: 20,   color: "var(--text-4)" },
              ]},
              { label: "Nordeste", total: 640, segs: [
                { value: 420,  color: "var(--success)" },
                { value: 140,  color: "var(--warning)" },
                { value: 60,   color: "var(--danger)" },
                { value: 20,   color: "var(--text-4)" },
              ]},
              { label: "Norte/CO", total: 320, segs: [
                { value: 230,  color: "var(--success)" },
                { value: 50,   color: "var(--warning)" },
                { value: 30,   color: "var(--danger)" },
                { value: 10,   color: "var(--text-4)" },
              ]},
            ]} />
            <div className="row" style={{ marginTop: 14, gap: 16, fontSize: 11.5, color: "var(--text-3)" }}>
              <span><span className="bd-dot" style={{ background: "var(--success)", display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 5 }} />Veiculando</span>
              <span><span className="bd-dot" style={{ background: "var(--warning)", display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 5 }} />Pendente</span>
              <span><span className="bd-dot" style={{ background: "var(--danger)", display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 5 }} />Manutenção</span>
              <span><span className="bd-dot" style={{ background: "var(--text-4)", display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 5 }} />Inativo</span>
            </div>
          </Card>
        </div>

        {/* Right: mix donut + activity */}
        <div className="col" style={{ gap: 12 }}>
          <Card
            title="Mix de formato"
            subtitle="Reservas ativas"
            eyebrow="MIX"
          >
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "center" }}>
              <Donut size={144} thickness={16} data={[
                { value: 542, color: "#6366f1", label: "Frontlight" },
                { value: 286, color: "#a855f7", label: "Backlight" },
                { value: 198, color: "#38bdf8", label: "Painel LED" },
                { value: 142, color: "#22c55e", label: "Empena" },
                { value: 79,  color: "#eab308", label: "Mobiliário" },
              ]} />
              <div className="col" style={{ gap: 6 }}>
                {[
                  { label: "Frontlight", value: 542, pct: 43, color: "#6366f1" },
                  { label: "Backlight", value: 286, pct: 23, color: "#a855f7" },
                  { label: "Painel LED", value: 198, pct: 16, color: "#38bdf8" },
                  { label: "Empena", value: 142, pct: 11, color: "#22c55e" },
                  { label: "Mobiliário urbano", value: 79, pct: 6, color: "#eab308" },
                ].map((d, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "8px 1fr auto auto", gap: 8, alignItems: "center", fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, background: d.color, borderRadius: 2 }} />
                    <span className="muted ellipsis">{d.label}</span>
                    <span className="tnum" style={{ color: "var(--text-1)", fontWeight: 600 }}>{d.value}</span>
                    <span className="tnum muted" style={{ minWidth: 32, textAlign: "right" }}>{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title="Atividade recente"
            subtitle="Auditoria operacional"
            eyebrow="ATIVIDADE"
            actions={<Btn size="sm" iconRight="chev-right">Auditoria</Btn>}
          >
            <div className="col" style={{ gap: 0 }}>
              <Activity tone="success" actor="Mariana Souza" action="aprovou contrato CT-2026-0481" detail="Stella Artois · 14 placas · R$ 184.200" time="ha 4 min" />
              <Activity tone="info" actor="Sync runtime" action="reconciliou 312 placas" detail="Lote rec-9f3a · regiões SP, RJ" time="ha 9 min" />
              <Activity tone="warn" actor="Pedro Vidal" action="moveu reserva RS-7820 para Em aprovação" detail="Pré-venda Itaú · 8 placas" time="ha 22 min" />
              <Activity tone="success" actor="Carla Lima" action="instalou placa #SP-1284" detail="Av. Paulista 1500 · Frontlight 9x3" time="ha 38 min" />
              <Activity tone="danger" actor="Sistema" action="detectou anomalia de sync" detail="Canal SSE NE-Recife · timeout 30s" time="ha 1h" />
              <Activity tone="info" actor="Ana Carvalho" action="exportou relatório mensal" detail="ER-2026-04 · 4.2MB · 60s" time="ha 1h" />
            </div>
          </Card>

          <Card
            title="Próximas obrigações"
            eyebrow="AGENDA"
            actions={<IconBtn icon="more-h" />}
          >
            <div className="col" style={{ gap: 8 }}>
              <Obligation date="HOJE" dateMeta="20:30" title="Renovação · Heineken Verão" meta="83 placas · R$ 612.400" tone="warn" />
              <Obligation date="QUI" dateMeta="22/05" title="Vencimento · Carrefour Q2" meta="42 placas · R$ 184.000" tone="muted" />
              <Obligation date="SEG" dateMeta="26/05" title="Aprovação · Boticário Inverno" meta="118 placas · R$ 1,1mi" tone="info" />
              <Obligation date="QUA" dateMeta="28/05" title="Início veiculação · Magalu" meta="56 placas · 30 dias" tone="success" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Activity({ tone, actor, action, detail, time }) {
  return (
    <div className="tl-item">
      <span className={`tl-dot ${tone}`} />
      <div className="tl-content">
        <div><span className="tl-actor">{actor}</span> <span className="tl-action">{action}</span></div>
        <div className="tl-detail">{detail}</div>
      </div>
      <span className="tl-time">{time}</span>
    </div>
  );
}

function Obligation({ date, dateMeta, title, meta, tone }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "54px 1fr auto", gap: 12, alignItems: "center",
      padding: "8px 10px",
      background: "var(--bg-input)",
      border: "1px solid var(--border-faint)",
      borderRadius: 7,
    }}>
      <div style={{ textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: tone === "warn" ? "var(--warning-on)" : tone === "info" ? "var(--info-on)" : tone === "success" ? "var(--success-on)" : "var(--text-3)", letterSpacing: "0.08em" }}>{date}</div>
        <div className="tnum" style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 2 }}>{dateMeta}</div>
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>{title}</div>
        <div className="muted" style={{ fontSize: 11.5 }}>{meta}</div>
      </div>
      <Ic name="chev-right" size={14} style={{ color: "var(--text-4)" }} />
    </div>
  );
}

window.PageOverview = PageOverview;
