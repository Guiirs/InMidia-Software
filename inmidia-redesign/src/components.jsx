/* global React, Ic */
// InMidia · Shared primitives & shell building blocks

const { useState, useRef, useEffect, useMemo } = React;

// ─── Status badge ─────────────────────────────────────────
function StatusBadge({ kind = "muted", children, size, dot = true }) {
  return (
    <span className={`bd ${kind} ${size === "lg" ? "lg" : ""}`}>
      {dot && <span className="bd-dot" />}
      {children}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────
function Btn({ icon, iconRight, variant, size, children, onClick, title, disabled }) {
  const cls = ["btn"];
  if (variant) cls.push(variant);
  if (size) cls.push(size);
  return (
    <button className={cls.join(" ")} onClick={onClick} title={title} disabled={disabled}>
      {icon && <Ic name={icon} size={13} />}
      {children}
      {iconRight && <Ic name={iconRight} size={13} />}
    </button>
  );
}

function IconBtn({ icon, dot, onClick, title, size = 15 }) {
  return (
    <button className="icon-btn" onClick={onClick} title={title}>
      <Ic name={icon} size={size} />
      {dot && <span className="dot" />}
    </button>
  );
}

// ─── Segmented control (in-page) ─────────────────────────
function Segments({ value, onChange, options }) {
  return (
    <div className="btn-group">
      {options.map(o => (
        <button
          key={o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >{o.label}{o.count != null && <span className="tnum" style={{ opacity: 0.7, marginLeft: 6 }}>{o.count}</span>}</button>
      ))}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────
function KPI({ label, value, unit, prefix, delta, deltaDir, sub, spark, footer }) {
  const dirClass = deltaDir === "up" ? "up" : deltaDir === "down" ? "down" : "flat";
  return (
    <div className="kpi">
      <div className="kpi-label">
        <span>{label}</span>
        {spark && <Ic name="more-h" size={14} style={{ color: "var(--text-4)" }} />}
      </div>
      <div className="kpi-value">
        {prefix && <span className="unit">{prefix}</span>}
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="kpi-meta">
        {delta != null && (
          <span className={`kpi-delta ${dirClass}`}>
            <Ic name={deltaDir === "up" ? "arrow-up" : deltaDir === "down" ? "arrow-down" : "minus"} size={11} stroke={2} />
            {delta}
          </span>
        )}
        {sub && <span>{sub}</span>}
      </div>
      {spark && (
        <svg className="kpi-spark" width="80" height="22" viewBox="0 0 80 22">
          <polyline
            points={spark.map((v, i) => `${(i / (spark.length - 1)) * 78 + 1},${20 - ((v - Math.min(...spark)) / (Math.max(...spark) - Math.min(...spark) || 1)) * 18}`).join(" ")}
            fill="none" stroke={deltaDir === "down" ? "var(--danger-on)" : "var(--accent-light)"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )}
      {footer && <div className="kpi-foot">{footer}</div>}
    </div>
  );
}

// ─── Exception card ───────────────────────────────────────
function ExceptionCard({ tone = "warn", icon = "alert-tri", title, meta, count, action }) {
  return (
    <div className={`ex-card ${tone}`}>
      <div className="ex-icon"><Ic name={icon} size={15} /></div>
      <div>
        <div className="ex-title">{title}</div>
        <div className="ex-meta">{meta}</div>
      </div>
      <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
        {count != null && <span className="ex-count">{count}</span>}
        {action && <button className="btn ghost sm" onClick={action.onClick} style={{ height: 22, padding: "0 6px", fontSize: 11 }}>
          {action.label} <Ic name="chev-right" size={11} />
        </button>}
      </div>
    </div>
  );
}

// ─── Card primitive ───────────────────────────────────────
function Card({ title, subtitle, eyebrow, actions, children, bodyClass = "", noBody = false, hint }) {
  return (
    <div className="card">
      {(title || actions || subtitle || eyebrow) && (
        <div className="card-hd">
          <div className="card-hd-left">
            <div>
              {eyebrow && <div className="eyebrow" style={{ marginBottom: 3 }}>{eyebrow}</div>}
              {title && <h3 className="card-title">{title}</h3>}
              {subtitle && <p className="card-sub">{subtitle}</p>}
            </div>
            {hint && <span className="bd muted" style={{ marginLeft: 4 }}>{hint}</span>}
          </div>
          {actions && <div className="row gap-1">{actions}</div>}
        </div>
      )}
      {!noBody && <div className={`card-bd ${bodyClass}`}>{children}</div>}
      {noBody && children}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────
function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.value}
          className={`tab ${value === t.value ? "on" : ""}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count != null && <span className="tab-count tnum">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────
function FilterChip({ label, value, onClick, active }) {
  return (
    <button className={`fbar-chip ${active ? "on" : ""}`} onClick={onClick}>
      <Ic name={active ? "x-circ" : "plus"} size={12} />
      <span>{label}</span>
      {value && <span className="fbar-chip-val">{value}</span>}
    </button>
  );
}

// ─── Checkbox ─────────────────────────────────────────────
function Check({ state = false, onClick }) {
  // state: false | true | "partial"
  const cls = state === true ? "on" : state === "partial" ? "partial" : "";
  return <span className={`chk ${cls}`} role="checkbox" aria-checked={state} onClick={onClick} />;
}

// ─── Pagination ───────────────────────────────────────────
function Pagination({ total, page, perPage = 25, onPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  return (
    <div className="pag">
      <div>
        Exibindo <span className="tnum" style={{ color: "var(--text-1)", fontWeight: 600 }}>{start}–{end}</span>
        {" "}de <span className="tnum" style={{ color: "var(--text-1)", fontWeight: 600 }}>{total.toLocaleString("pt-BR")}</span> resultados
      </div>
      <div className="pag-controls">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}><Ic name="chev-left" size={12} /></button>
        {Array.from({ length: pages }).slice(0, 5).map((_, i) => (
          <button key={i} className={page === i + 1 ? "on" : ""} onClick={() => onPage(i + 1)}>{i + 1}</button>
        ))}
        {pages > 5 && <span style={{ padding: "0 4px", color: "var(--text-4)" }}>…</span>}
        {pages > 5 && <button onClick={() => onPage(pages)}>{pages}</button>}
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}><Ic name="chev-right" size={12} /></button>
      </div>
    </div>
  );
}

// ─── Mini bar chart (SVG) ─────────────────────────────────
function MiniBar({ data, width = 280, height = 80, colors }) {
  const max = Math.max(...data.map(d => d.value));
  const bw = width / data.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 18);
        return (
          <g key={i} transform={`translate(${i * bw}, 0)`}>
            <rect
              x={3} y={height - h - 14} width={bw - 6} height={h}
              fill={colors?.[i] || "var(--accent)"} opacity={d.dim ? 0.4 : 1}
              rx={2}
            />
            <text x={bw / 2} y={height - 3} textAnchor="middle"
              fontSize={9} fill="var(--text-4)" fontFamily="var(--font-sans)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Line chart (SVG) ─────────────────────────────────────
function LineChart({ series, width = 720, height = 200, yTicks = 4, xLabels }) {
  // series: [{ name, color, data: [number] }]
  const len = series[0]?.data.length || 0;
  const all = series.flatMap(s => s.data);
  const max = Math.max(...all);
  const min = Math.min(...all, 0);
  const pad = { l: 36, r: 12, t: 14, b: 22 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const x = i => pad.l + (i / (len - 1)) * W;
  const y = v => pad.t + (1 - (v - min) / (max - min || 1)) * H;
  const grids = Array.from({ length: yTicks }).map((_, i) => {
    const v = min + (i / (yTicks - 1)) * (max - min);
    return { y: y(v), v };
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <g className="chart-grid">
        {grids.map((g, i) => <line key={i} x1={pad.l} x2={width - pad.r} y1={g.y} y2={g.y} />)}
      </g>
      <g className="chart-axis">
        {grids.map((g, i) => (
          <text key={i} x={pad.l - 6} y={g.y + 3} textAnchor="end">{Math.round(g.v)}</text>
        ))}
        {(xLabels || []).map((l, i) => (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle">{l}</text>
        ))}
      </g>
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        const area = `M ${pad.l},${pad.t + H} L ${s.data.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${width - pad.r},${pad.t + H} Z`;
        return (
          <g key={si}>
            {si === 0 && (
              <path d={area} fill={s.color} opacity={0.10} />
            )}
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Stacked bar (region) ─────────────────────────────────
function StackBar({ rows, width = 320 }) {
  // rows: [{ label, segs: [{value, color}], total }]
  const max = Math.max(...rows.map(r => r.total));
  return (
    <div className="col" style={{ gap: 6 }}>
      {rows.map((r, i) => {
        const w = (r.total / max) * 100;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "82px 1fr 60px", gap: 10, alignItems: "center", fontSize: 12 }}>
            <span className="muted ellipsis">{r.label}</span>
            <div style={{ height: 8, display: "flex", borderRadius: 2, overflow: "hidden", background: "var(--bg-input)" }}>
              <div style={{ display: "flex", width: `${w}%`, gap: 1 }}>
                {r.segs.map((s, j) => (
                  <div key={j} style={{ flex: s.value, background: s.color }} />
                ))}
              </div>
            </div>
            <span className="tnum" style={{ textAlign: "right", color: "var(--text-1)", fontWeight: 600 }}>{r.total.toLocaleString("pt-BR")}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut chart ──────────────────────────────────────────
function Donut({ data, size = 160, thickness = 18 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const r = size / 2 - thickness / 2 - 2;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-input)" strokeWidth={thickness} />
      {data.map((d, i) => {
        const len = (d.value / total) * (2 * Math.PI * r);
        const off = (acc / total) * (2 * Math.PI * r);
        acc += d.value;
        return (
          <circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${2 * Math.PI * r}`}
            strokeDashoffset={-off}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text-1)" style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }} fontVariant="tabular-nums">{total.toLocaleString("pt-BR")}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="var(--text-3)" style={{ fontFamily: "var(--font-sans)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Total</text>
    </svg>
  );
}

// ─── Action menu (dropdown stub) ──────────────────────────
function ActionMenu({ items = [], onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(v => !v)} title="Ações"><Ic name="more-h" size={14} /></button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: 30,
          minWidth: 180, background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 8, padding: 4,
          boxShadow: "var(--shadow-md)", zIndex: 20,
        }}>
          {items.map((it, i) => (
            it === "-" ? <div key={i} style={{ height: 1, background: "var(--border-faint)", margin: "4px 2px" }} /> :
            <button key={i} onClick={() => { onSelect?.(it.value); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "6px 8px",
                background: "transparent", border: 0, borderRadius: 5,
                fontSize: 12.5, color: it.danger ? "var(--danger-on)" : "var(--text-2)",
                textAlign: "left",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {it.icon && <Ic name={it.icon} size={13} />}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.kbd && <span className="kbd">{it.kbd}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────
function Avatar({ name, size = 24, tone = "indigo" }) {
  const init = (name || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const bgs = {
    indigo: "linear-gradient(135deg, #6366f1, #4f46e5)",
    purple: "linear-gradient(135deg, #a855f7, #7e22ce)",
    teal:   "linear-gradient(135deg, #14b8a6, #0d9488)",
    amber:  "linear-gradient(135deg, #f59e0b, #b45309)",
    rose:   "linear-gradient(135deg, #f43f5e, #be123c)",
    sky:    "linear-gradient(135deg, #38bdf8, #0284c7)",
    slate:  "linear-gradient(135deg, #475569, #1e293b)",
  };
  return (
    <span style={{
      width: size, height: size, borderRadius: size > 30 ? 8 : 6,
      background: bgs[tone] || bgs.indigo,
      display: "inline-grid", placeItems: "center",
      color: "#fff", fontWeight: 700,
      fontSize: Math.max(9, size * 0.42),
      letterSpacing: "-0.01em",
      flexShrink: 0,
    }}>{init}</span>
  );
}

Object.assign(window, {
  StatusBadge, Btn, IconBtn, Segments, KPI, ExceptionCard, Card, Tabs,
  FilterChip, Check, Pagination, MiniBar, LineChart, StackBar, Donut,
  ActionMenu, Avatar,
});
