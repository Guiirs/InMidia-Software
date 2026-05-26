/* global React, Ic, Btn, IconBtn, StatusBadge, Card, KPI, Tabs, FilterChip, Pagination, ActionMenu, Check */
// InMidia · Páginas operacionais menores (Ordens, Exportações)
// Cada uma é um esqueleto enterprise pronto para porte/preenchimento.

const { useState: useStateMisc } = React;

// ─── Ordens de campo ──────────────────────────────────────
function PageOrders() {
  const [page, setPage] = useStateMisc(1);
  const rows = [
    ["OF-2026-0418", "Instalação · IM-SP-1284", "Av. Paulista 1500",       "SP",     "andamento", "Carla Lima",    "alta",    "hoje 18:00"],
    ["OF-2026-0417", "Manutenção · IM-RS-0420", "Av. Ipiranga 6680",        "Sul",    "atraso",    "Equipe RS",     "alta",    "ontem"],
    ["OF-2026-0416", "Inspeção · IM-MG-0712",   "Av. Contorno 4200 · BH",   "MG",     "agendado",  "Equipe MG",     "media",   "qui · 22/05"],
    ["OF-2026-0415", "Troca de mídia · IM-SP-2188", "Anhanguera km 22",     "SP-Int", "andamento", "Pedro Vidal",   "media",   "hoje 14:00"],
    ["OF-2026-0414", "Instalação · IM-PE-0188", "Av. Boa Viagem 3210",      "NE",     "agendado",  "Equipe NE",     "baixa",   "seg · 26/05"],
    ["OF-2026-0413", "Manutenção · IM-SP-4022", "Bandeirantes km 12",       "SP",     "concluido", "Carla Lima",    "media",   "ontem 16:42"],
    ["OF-2026-0412", "Vistoria · IM-RJ-2840",   "Niterói-Manilha km 8",     "RJ",     "concluido", "Equipe RJ",     "baixa",   "ontem"],
    ["OF-2026-0411", "Inspeção · IM-DF-0080",   "Eixo Monumental · DF",     "CO",     "concluido", "Equipe CO",     "media",   "anteontem"],
  ];
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Ordens de campo</h1>
          <p className="page-sub">Instalação, manutenção e inspeção de inventário · 12 em andamento · 3 com atraso</p>
        </div>
        <div className="page-hd-actions">
          <Btn icon="filter">Filtros</Btn>
          <Btn icon="download">Exportar</Btn>
          <Btn variant="primary" icon="plus">Nova ordem</Btn>
        </div>
      </div>

      <div className="grid-4">
        <KPI label="Em andamento" value="12" sub="6 com SLA crítico" delta="+2" deltaDir="down" />
        <KPI label="Em atraso" value="3" sub="média de atraso: 1,2d" delta="-1" deltaDir="up" />
        <KPI label="Concluídas 7d" value="48" delta="+18%" deltaDir="up" sub="MTTR: 2,4 dias" />
        <KPI label="Tempo médio campo" value="4,2" unit="h" delta="-0,3h" deltaDir="up" sub="por ordem" />
      </div>

      <div className="fbar">
        <div className="fbar-search">
          <Ic name="search" size={13} style={{ color: "var(--text-3)" }} />
          <input placeholder="Buscar por código, placa ou equipe…" />
        </div>
        <FilterChip label="Tipo" />
        <FilterChip label="Região" />
        <FilterChip label="Status" />
        <FilterChip label="Prioridade" />
        <FilterChip label="Equipe" />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th className="check"><Check /></th>
              <th>Código</th>
              <th>Tipo · alvo</th>
              <th>Local</th>
              <th>Região</th>
              <th>Status</th>
              <th>Equipe</th>
              <th>Prioridade</th>
              <th>SLA</th>
              <th className="act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const [code, tipo, local, reg, st, team, pri, sla] = r;
              const sm = { andamento: { kind: "info", label: "ANDAMENTO" }, atraso: { kind: "danger", label: "ATRASO" }, agendado: { kind: "muted", label: "AGENDADO" }, concluido: { kind: "success", label: "CONCLUÍDA" } }[st];
              const pm = { alta: { kind: "danger", label: "ALTA" }, media: { kind: "warn", label: "MÉDIA" }, baixa: { kind: "muted", label: "BAIXA" } }[pri];
              return (
                <tr key={i}>
                  <td className="check"><Check /></td>
                  <td className="id">{code}</td>
                  <td className="lead">{tipo}</td>
                  <td className="ellipsis" style={{ maxWidth: 220 }}>{local}</td>
                  <td>{reg}</td>
                  <td><StatusBadge kind={sm.kind}>{sm.label}</StatusBadge></td>
                  <td>{team}</td>
                  <td><StatusBadge kind={pm.kind} dot={false}>{pm.label}</StatusBadge></td>
                  <td className="tnum muted">{sla}</td>
                  <td className="act"><ActionMenu items={[
                    { label: "Abrir", icon: "eye", value: "open", kbd: "↵" },
                    { label: "Atribuir equipe", icon: "users", value: "assign" },
                    "-",
                    { label: "Cancelar", icon: "x", value: "cancel", danger: true },
                  ]} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination total={284} page={page} onPage={setPage} perPage={50} />
      </div>
    </div>
  );
}

// ─── Exportações ──────────────────────────────────────────
function PageExports() {
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Exportações</h1>
          <p className="page-sub">Jobs assíncronos de exportação · CSV, XLSX, PDF, JSON</p>
        </div>
        <div className="page-hd-actions">
          <Btn icon="settings">Templates</Btn>
          <Btn variant="primary" icon="download">Nova exportação</Btn>
        </div>
      </div>

      <div className="grid-3">
        <KPI label="Jobs nas últimas 24h" value="42" sub="38 concluídos · 3 em execução" delta="+8" deltaDir="up" />
        <KPI label="Volume exportado" value="184" unit="MB" sub="487k linhas" delta="+24%" deltaDir="up" />
        <KPI label="Tempo médio" value="38" unit="s" delta="-12s" deltaDir="up" sub="meta: <60s" />
      </div>

      <Card title="Jobs ativos & recentes" eyebrow="JOBS" actions={<Btn size="sm" icon="filter">Filtrar</Btn>}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Job</th>
              <th>Tipo</th>
              <th>Solicitante</th>
              <th>Status</th>
              <th className="num">Linhas</th>
              <th className="num">Tamanho</th>
              <th>Iniciado</th>
              <th className="num">Duração</th>
              <th className="act"></th>
            </tr>
          </thead>
          <tbody>
            {[
              ["exp-7811", "Inventário · Itaú Q2",    "Ana Carvalho",  "running", 0, "—",       "ha 1m",  "—"],
              ["exp-7809", "Faturamento · BTG",       "Pedro Vidal",   "queued",  0, "—",       "—",      "—"],
              ["exp-7802", "Relatório mensal",        "Mariana Souza", "ok",   8420, "4,2 MB",  "ha 1h",  "47s"],
              ["exp-7798", "Reservas · Heineken",     "Pedro Vidal",   "ok",    218, "82 KB",   "ha 2h",  "6s"],
              ["exp-7794", "Auditoria · LGPD",        "Diogo Pinheiro","ok",   12400,"38 MB",   "ha 3h",  "2m 14s"],
              ["exp-7790", "BI · receita por região", "Ana Carvalho",  "fail",  0,  "—",       "ha 4h",  "—"],
              ["exp-7785", "Placas SP · CSV",         "Pedro Vidal",   "ok",   2840, "1,1 MB",  "ha 6h",  "18s"],
            ].map((j, i) => {
              const [id, type, user, status, rows, size, start, dur] = j;
              const sm = { running: { kind: "info", label: "EXECUTANDO" }, queued: { kind: "muted", label: "FILA" }, fail: { kind: "danger", label: "FALHOU" }, ok: { kind: "success", label: "PRONTO" } }[status];
              return (
                <tr key={i}>
                  <td className="id">{id}</td>
                  <td className="lead">{type}</td>
                  <td>{user}</td>
                  <td><StatusBadge kind={sm.kind}>{sm.label}</StatusBadge></td>
                  <td className="num">{rows ? rows.toLocaleString("pt-BR") : "—"}</td>
                  <td className="num">{size}</td>
                  <td className="tnum muted">{start}</td>
                  <td className="num">{dur}</td>
                  <td className="act">
                    {status === "ok" ? <button className="btn sm ghost" style={{ height: 22, padding: "0 8px" }}><Ic name="download" size={11} /> Baixar</button> :
                     status === "fail" ? <button className="btn sm ghost" style={{ height: 22, padding: "0 8px", color: "var(--danger-on)" }}><Ic name="rotate" size={11} /> Retentar</button> :
                     <IconBtn icon="more-h" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Stub roadmap (Clientes, Faturamento, Incidentes, Config., Integrações) ─
function PageStub({ title, sub, icon, sections }) {
  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{sub}</p>
        </div>
        <div className="page-hd-actions">
          <StatusBadge kind="info">PRONTO PARA PORTE</StatusBadge>
        </div>
      </div>

      <Card eyebrow="ARQUITETURA" title={`Estrutura prevista de ${title}`} subtitle="Componentes a serem integrados — mantém contratos da auditoria e do blueprint">
        <div className="grid-3">
          {sections.map((s, i) => (
            <div key={i} style={{
              padding: 14,
              background: "var(--bg-input)", border: "1px solid var(--border-faint)",
              borderRadius: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent-soft)", color: "var(--accent-light)", display: "grid", placeItems: "center" }}>
                  <Ic name={s.icon || icon} size={13} />
                </span>
                <div style={{ color: "var(--text-1)", fontWeight: 600, fontSize: 13 }}>{s.title}</div>
              </div>
              <ul style={{ fontSize: 12, color: "var(--text-2)", display: "grid", gap: 4 }}>
                {s.items.map((it, j) => (
                  <li key={j} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <Ic name="dot" size={12} style={{ color: "var(--text-4)", marginTop: 4 }} />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card eyebrow="CONTRATOS PRESERVADOS" title="Endpoints & query keys que NÃO podem quebrar" actions={<Btn size="sm" icon="external">Audit doc</Btn>}>
        <div className="col gap-2">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
            <code style={{ padding: "6px 8px", background: "var(--bg-input)", borderRadius: 5, color: "var(--text-2)" }}>GET /v1/{title.toLowerCase().split(" ")[0]}</code>
            <code style={{ padding: "6px 8px", background: "var(--bg-input)", borderRadius: 5, color: "var(--text-2)" }}>queryKey: ["{title.toLowerCase().split(" ")[0]}", filters]</code>
            <code style={{ padding: "6px 8px", background: "var(--bg-input)", borderRadius: 5, color: "var(--text-2)" }}>syncService.subscribe()</code>
          </div>
        </div>
      </Card>
    </div>
  );
}

const STUBS = {
  clients: {
    title: "Clientes & contratos", icon: "building",
    sub: "Gestão de contas, contratos, renovações e janelas comerciais",
    sections: [
      { title: "Lista de clientes", icon: "building", items: ["Tabela densa de contas", "Cards de ticket médio e tenure", "Atribuição comercial", "Filtros por setor e LTV"] },
      { title: "Contratos", icon: "file-text", items: ["Versionamento", "Workflow de aprovação", "Anexos e assinatura", "Renovações e janelas"] },
      { title: "Relacionamento", icon: "users", items: ["Timeline por cliente", "Notas internas", "Saúde do relacionamento (NPS)"] },
    ],
  },
  billing: {
    title: "Faturamento", icon: "receipt",
    sub: "Geração de faturas, NF-e, conciliação e inadimplência",
    sections: [
      { title: "Faturas", icon: "receipt", items: ["Geração automática mensal", "Reemissão e cancelamento", "Anexos: NF-e, boletos, PIX"] },
      { title: "Conciliação", icon: "check", items: ["Match com extrato bancário", "Status de pagamento", "DRE por região"] },
      { title: "Inadimplência", icon: "alert-tri", items: ["Aging buckets", "Régua de cobrança", "Bloqueio automático"] },
    ],
  },
  incidents: {
    title: "Incidentes", icon: "alert-tri",
    sub: "Histórico completo de incidentes operacionais e técnicos",
    sections: [
      { title: "Lista de incidentes", icon: "alert-tri", items: ["Filtros por severidade, canal", "MTTR e MTBF", "Cards de impacto"] },
      { title: "Post-mortems", icon: "file-text", items: ["Templates RCA", "Action items linkadas", "Aprendizados"] },
      { title: "Runbooks", icon: "code", items: ["Procedimentos versionados", "Execução guiada", "Histórico de execuções"] },
    ],
  },
  settings: {
    title: "Configurações", icon: "settings",
    sub: "Preferências do workspace, política de dados e branding",
    sections: [
      { title: "Workspace", icon: "settings", items: ["Nome, timezone, moeda", "Logo e branding", "Domínio próprio"] },
      { title: "Dados", icon: "database", items: ["Retenção", "Backup", "Política LGPD", "Anonimização"] },
      { title: "Operação", icon: "panel", items: ["Limites de SLA", "Janelas operacionais", "Polling/SSE config"] },
    ],
  },
  integrations: {
    title: "Integrações", icon: "link",
    sub: "Webhooks, conectores e APIs externas",
    sections: [
      { title: "Conectores", icon: "link", items: ["Salesforce, HubSpot", "ERP (TOTVS, SAP)", "Mídia kit (DSPs, exchanges)"] },
      { title: "Webhooks", icon: "radio", items: ["Eventos de reserva, faturamento", "Assinatura HMAC", "Retry exponencial"] },
      { title: "API tokens", icon: "key", items: ["Scopes granulares", "Rate limit por token", "Rotação automática"] },
    ],
  },
};

function PageStubFor(key) {
  const s = STUBS[key] || STUBS.settings;
  return <PageStub {...s} />;
}

Object.assign(window, { PageOrders, PageExports, PageStubFor });
