import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/apiClient.js';
import './LandingPage.css';

/* ─── Meta tags SEO/OG ─────────────────────────────────────── */
function useLandingMeta() {
  useEffect(() => {
    const prev = {
      title:       document.title,
      description: document.querySelector('meta[name="description"]')?.content ?? '',
      ogTitle:     document.querySelector('meta[property="og:title"]')?.content ?? '',
      ogDesc:      document.querySelector('meta[property="og:description"]')?.content ?? '',
      ogType:      document.querySelector('meta[property="og:type"]')?.content ?? '',
      twitterCard: document.querySelector('meta[name="twitter:card"]')?.content ?? '',
    };

    function setMeta(selector, attr, value) {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [key, val] = attr.split('=');
        el.setAttribute(key.replace('[', '').replace(']', ''), val.replace(/"/g, ''));
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    }

    document.title = 'InMidia V4.1 — O sistema operacional da mídia exterior';
    setMeta('meta[name="description"]',          'name=description',       'Plataforma enterprise para gestão completa de mídia OOH: inventário de placas, engine temporal, contratos, operações e dashboard executivo em um único sistema.');
    setMeta('meta[property="og:title"]',         'property=og:title',      'InMidia V4.1 — O sistema operacional da mídia exterior');
    setMeta('meta[property="og:description"]',   'property=og:description','Controle placas, contratos, regiões, operações e disponibilidade temporal em uma única plataforma inteligente.');
    setMeta('meta[property="og:type"]',          'property=og:type',       'website');
    setMeta('meta[property="og:site_name"]',     'property=og:site_name',  'InMidia');
    setMeta('meta[name="twitter:card"]',         'name=twitter:card',      'summary_large_image');
    setMeta('meta[name="twitter:title"]',        'name=twitter:title',     'InMidia V4.1 — O sistema operacional da mídia exterior');
    setMeta('meta[name="twitter:description"]',  'name=twitter:description','Gestão enterprise de mídia OOH: placas, contratos, regiões e engine temporal integrados.');

    return () => {
      document.title = prev.title;
      ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]',
       'meta[property="og:type"]', 'meta[name="twitter:card"]', 'meta[name="twitter:title"]',
       'meta[name="twitter:description"]'].forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.setAttribute('content', '');
      });
    };
  }, []);
}

/* ─── CountUp — anima números ao entrar no viewport ────────── */
function CountUp({ to, suffix = '', duration = 1300 }) {
  const target = Number(to);
  const isNum  = Number.isFinite(target);
  const ref    = useRef(null);
  const ran    = useRef(false);
  const [n, setN] = useState(isNum ? 0 : to);

  useEffect(() => {
    if (!isNum) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setN(target); return; }

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || ran.current) return;
      ran.current = true;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / duration, 1);
        setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });

    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [target, isNum, duration]);

  if (!isNum) return <span>{to}</span>;
  return <span ref={ref} className="lp-countup">{n}{suffix}</span>;
}

/* ─── Reveal por scroll (IntersectionObserver) ─────────────── */
function useRevealOnScroll() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('lp-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─── KPIs via API temporal com fallback estático ──────────── */
const STATIC_KPIS = {
  placasTotal:       342,
  placasOcupadas:    267,
  placasDisponiveis: 34,
  ocupacaoPercent:   78,
  contratosAtivos:   24,
  contratosVencendo: 7,
  operacoesPendentes:12,
  regioes:           12,
  receitaAtiva:      'R$ 248k',
  receitaFutura:     'R$ 91k',
};

function normalizeSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw.data ?? raw;
  return {
    placasTotal:       d.totalBoards       ?? d.placasTotal       ?? null,
    placasOcupadas:    d.occupiedBoards     ?? d.placasOcupadas    ?? null,
    placasDisponiveis: d.availableBoards    ?? d.placasDisponiveis ?? null,
    ocupacaoPercent:   d.occupancyPercent   ?? d.ocupacaoPercent   ?? null,
    contratosAtivos:   d.activeContracts    ?? d.contratosAtivos   ?? null,
    contratosVencendo: d.contractsExpiring  ?? d.contratosVencendo ?? null,
    operacoesPendentes:d.pendingOperations  ?? d.operacoesPendentes ?? null,
    regioes:           d.activeRegions      ?? d.regioes           ?? null,
    receitaAtiva:      d.activeRevenue      ?? d.receitaAtiva      ?? null,
    receitaFutura:     d.projectedRevenue   ?? d.receitaFutura     ?? null,
  };
}

function useLandingKPIs() {
  const [kpis, setKpis] = useState(STATIC_KPIS);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const hasToken = Boolean(localStorage.getItem('token'));
    if (!hasToken) return;

    let cancelled = false;
    apiClient
      .get('/api/v4/temporal/dashboard-summary', { timeout: 5000 })
      .then((res) => {
        if (cancelled) return;
        const normalized = normalizeSummary(res.data);
        if (!normalized) return;
        setKpis((prev) => {
          const merged = { ...prev };
          Object.entries(normalized).forEach(([k, v]) => {
            if (v !== null && v !== undefined) merged[k] = v;
          });
          return merged;
        });
        setIsLive(true);
      })
      .catch(() => {
        /* fallback silencioso — STATIC_KPIS já está no state */
      });

    return () => { cancelled = true; };
  }, []);

  return { kpis, isLive };
}

/* ─── Ícone Material Symbols ────────────────────────────────── */
function Icon({ name, size = 20 }) {
  return (
    <span
      className="lp-icon-ms"
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

/* ─── Dados estáticos ───────────────────────────────────────── */
const MODULES = [
  { icon: 'view_in_ar',          iconBg: 'var(--lp-blue-soft)',   iconColor: 'var(--lp-blue)',   title: 'Inventário de Placas',  desc: 'Cadastro, busca, filtros e detalhes técnicos de cada outdoor com histórico completo.' },
  { icon: 'schedule',            iconBg: 'var(--lp-cyan-soft)',   iconColor: 'var(--lp-cyan)',   title: 'Engine Temporal',       desc: 'Motor de disponibilidade que impede conflitos de contratação e dupla reserva.' },
  { icon: 'handshake',           iconBg: 'var(--lp-green-soft)',  iconColor: 'var(--lp-green)',  title: 'PI e Contratos',        desc: 'Fluxo comercial completo: proposta interna, aprovação e geração automática de contrato.' },
  { icon: 'construction',        iconBg: 'var(--lp-amber-soft)',  iconColor: 'var(--lp-amber)',  title: 'Operações de Campo',    desc: 'Instalações, raspagens, manutenções e bloqueios com rastreabilidade por placa.' },
  { icon: 'map',                 iconBg: 'var(--lp-violet-soft)', iconColor: 'var(--lp-violet)', title: 'Mapa Operacional',      desc: 'Visão geoespacial de placas, regiões, status e operações pendentes em tempo real.' },
  { icon: 'layers',              iconBg: 'var(--lp-blue-soft)',   iconColor: 'var(--lp-blue)',   title: 'Gestão de Regiões',     desc: 'Agrupe placas por região, controle ocupação territorial e distribua operações.' },
  { icon: 'dashboard',           iconBg: 'var(--lp-cyan-soft)',   iconColor: 'var(--lp-cyan)',   title: 'Dashboard Executivo',   desc: 'KPIs de receita, ocupação, contratos ativos e projeções em uma única tela.' },
  { icon: 'notifications_active',iconBg: 'var(--lp-red-soft)',    iconColor: 'var(--lp-red)',    title: 'Alertas Inteligentes',  desc: 'Notificações de vencimentos, conflitos, liberações e anomalias operacionais.' },
];

const TEMPORAL_STATUSES = [
  { label: 'Placa Disponível',   color: 'var(--lp-green)',  badge: 'AVAILABLE',       badgeBg: 'var(--lp-green-soft)',  badgeColor: 'var(--lp-green)'  },
  { label: 'Reserva Futura (PI)',color: 'var(--lp-blue)',   badge: 'RESERVED',         badgeBg: 'var(--lp-blue-soft)',   badgeColor: 'var(--lp-blue)'   },
  { label: 'Contrato Vigente',   color: 'var(--lp-cyan)',   badge: 'CONTRACTED',       badgeBg: 'var(--lp-cyan-soft)',   badgeColor: 'var(--lp-cyan)'   },
  { label: 'Contrato Vencendo',  color: 'var(--lp-amber)',  badge: 'EXPIRING',         badgeBg: 'var(--lp-amber-soft)',  badgeColor: 'var(--lp-amber)'  },
  { label: 'Liberação Pendente', color: 'var(--lp-red)',    badge: 'PENDING_RELEASE',  badgeBg: 'var(--lp-red-soft)',    badgeColor: 'var(--lp-red)'    },
];

const OPS = [
  { icon: 'build',           iconBg: 'var(--lp-amber-soft)',  iconColor: 'var(--lp-amber)',  title: 'Instalação',  desc: 'Agendamento e rastreio de instalação de novas artes.' },
  { icon: 'content_cut',     iconBg: 'var(--lp-violet-soft)', iconColor: 'var(--lp-violet)', title: 'Raspagem',    desc: 'Remoção de artes antigas com registro e histórico.' },
  { icon: 'engineering',     iconBg: 'var(--lp-blue-soft)',   iconColor: 'var(--lp-blue)',   title: 'Manutenção',  desc: 'Ocorrências técnicas e intervenções preventivas.' },
  { icon: 'block',           iconBg: 'var(--lp-red-soft)',    iconColor: 'var(--lp-red)',    title: 'Bloqueio',    desc: 'Bloqueio manual impedindo novas reservas no período.' },
  { icon: 'timer_off',       iconBg: 'var(--lp-amber-soft)',  iconColor: 'var(--lp-amber)',  title: 'Vencimentos', desc: 'Alertas automáticos de contratos e reservas expirando.' },
  { icon: 'history',         iconBg: 'var(--lp-green-soft)',  iconColor: 'var(--lp-green)',  title: 'Histórico',   desc: 'Linha do tempo operacional completa por placa.' },
];

const PROBLEMS = [
  { icon: 'location_off',        text: 'Placas espalhadas sem controle central — ninguém sabe o status real de cada ponto.' },
  { icon: 'event_busy',          text: 'Contratos conflitantes criados manualmente, resultando em dupla reserva e perda de receita.' },
  { icon: 'visibility_off',      text: 'Falta de visão regional — impossível saber o desempenho por área ou cidade.' },
  { icon: 'search_off',          text: 'Sem fonte única de verdade para disponibilidade de placas em um período específico.' },
  { icon: 'grid_off',            text: 'Operações de campo controladas por planilhas e WhatsApp — sem rastreio.' },
  { icon: 'receipt_long',        text: 'Risco real de vender placa já contratada por falta de sincronização.' },
  { icon: 'history_toggle_off',  text: 'Nenhum histórico operacional — impossível auditar o que aconteceu em cada ponto.' },
];

/* ─── Componente principal ──────────────────────────────────── */
export default function LandingPage() {
  useLandingMeta();
  useRevealOnScroll();
  const { kpis, isLive } = useLandingKPIs();

  const kpiCards = [
    { icon: 'payments',       iconColor: 'var(--lp-green)',  value: kpis.receitaAtiva,      count: null,                    suffix: '',  label: 'Receita ativa',       trendBg: 'var(--lp-green-soft)',  trendColor: 'var(--lp-green)',  trend: '+12%' },
    { icon: 'trending_up',    iconColor: 'var(--lp-blue)',   value: kpis.receitaFutura,     count: null,                    suffix: '',  label: 'Receita projetada',   trendBg: 'var(--lp-blue-soft)',   trendColor: 'var(--lp-blue)',   trend: '+8%'  },
    { icon: 'percent',        iconColor: 'var(--lp-cyan)',   value: null,                   count: kpis.ocupacaoPercent,    suffix: '%', label: 'Ocupação média',      trendBg: 'var(--lp-cyan-soft)',   trendColor: 'var(--lp-cyan)',   trend: '+5%'  },
    { icon: 'view_in_ar',     iconColor: 'var(--lp-violet)', value: null,                   count: kpis.placasDisponiveis,  suffix: '',  label: 'Placas disponíveis',  trendBg: 'rgba(139,92,246,0.10)', trendColor: 'var(--lp-violet)', trend: '—'    },
    { icon: 'warning_amber',  iconColor: 'var(--lp-amber)',  value: null,                   count: kpis.contratosVencendo,  suffix: '',  label: 'Contratos vencendo',  trendBg: 'var(--lp-amber-soft)',  trendColor: 'var(--lp-amber)',  trend: 'ATENÇÃO' },
    { icon: 'pending_actions',iconColor: 'var(--lp-red)',    value: null,                   count: kpis.operacoesPendentes, suffix: '',  label: 'Ops. pendentes',      trendBg: 'var(--lp-red-soft)',    trendColor: 'var(--lp-red)',    trend: 'URGENTE' },
  ];

  return (
    <div className="lp">

      {/* ── TOPBAR ──────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <div className="lp-nav__brand">
            <div className="lp-nav__mark">IN</div>
            <span className="lp-nav__name">InMidia <span>V4.1</span></span>
          </div>
          <div className="lp-nav__links">
            <a href="#modulos"   className="lp-nav__link">Módulos</a>
            <a href="#temporal"  className="lp-nav__link">Engine Temporal</a>
            <a href="#dashboard" className="lp-nav__link">Dashboard</a>
            <a href="#planos"    className="lp-nav__link">Planos</a>
          </div>
          <div className="lp-nav__cta">
            <Link to="/login"     className="lp-btn lp-btn--ghost lp-btn--sm">Entrar</Link>
            <Link to="/dashboard" className="lp-btn lp-btn--primary lp-btn--sm">
              <Icon name="rocket_launch" size={15} />
              Acessar painel
            </Link>
          </div>
        </div>
      </nav>

      {/* ── 1. HERO ─────────────────────────────────────────── */}
      <section className="lp-hero">
        {/* Orbs decorativos — aria-hidden, animados via CSS */}
        <div className="lp-hero__orb lp-hero__orb--blue"   aria-hidden="true" />
        <div className="lp-hero__orb lp-hero__orb--cyan"   aria-hidden="true" />
        <div className="lp-hero__orb lp-hero__orb--violet" aria-hidden="true" />

        <div className="lp-hero__eyebrow lp-reveal" data-reveal>
          <span className="lp-label lp-label--blue">
            <Icon name="verified" size={12} />
            Plataforma Enterprise de Mídia OOH
          </span>
        </div>

        <h1 className="lp-hero__title lp-reveal lp-reveal--delay-1" data-reveal>
          InMidia V4.1 —{' '}
          <span className="lp-hero__title-accent">
            O sistema operacional<br />da mídia exterior
          </span>
        </h1>

        <p className="lp-hero__sub lp-reveal lp-reveal--delay-2" data-reveal>
          Controle placas, contratos, regiões, operações e disponibilidade temporal
          em uma única plataforma inteligente. Do comercial ao campo, tudo conectado.
        </p>

        <div className="lp-hero__actions lp-reveal lp-reveal--delay-3" data-reveal>
          <Link to="/dashboard" className="lp-btn lp-btn--primary lp-btn--lg">
            <Icon name="dashboard" size={18} />
            Ver painel
          </Link>
          <a href="#modulos" className="lp-btn lp-btn--ghost lp-btn--lg">
            Conhecer recursos
            <Icon name="arrow_downward" size={16} />
          </a>
        </div>

        <div className="lp-hero__cards lp-reveal lp-reveal--delay-4" data-reveal>
          {[
            { icon: 'view_in_ar', iconBg: 'var(--lp-blue-soft)',   iconColor: 'var(--lp-blue)',   count: kpis.placasTotal,       suffix: '',  label: 'Placas cadastradas' },
            { icon: 'schedule',   iconBg: 'var(--lp-cyan-soft)',    iconColor: 'var(--lp-cyan)',   count: null, value: '100%',               label: 'Disponibilidade confiável' },
            { icon: 'handshake',  iconBg: 'var(--lp-green-soft)',   iconColor: 'var(--lp-green)',  count: kpis.ocupacaoPercent,   suffix: '%', label: 'Ocupação média' },
            { icon: 'map',        iconBg: 'var(--lp-violet-soft)',  iconColor: 'var(--lp-violet)', count: kpis.regioes,           suffix: '',  label: 'Regiões ativas' },
          ].map((c) => (
            <div key={c.label} className="lp-hero-card">
              <div className="lp-hero-card__icon" style={{ background: c.iconBg, color: c.iconColor }}>
                <Icon name={c.icon} size={18} />
              </div>
              <div className="lp-hero-card__body">
                <div className="lp-hero-card__value">
                  {c.count != null
                    ? <CountUp to={c.count} suffix={c.suffix} />
                    : c.value}
                </div>
                <div className="lp-hero-card__label">{c.label}</div>
              </div>
            </div>
          ))}
          {isLive && (
            <div className="lp-live-badge" title="Dados obtidos da API">
              <Icon name="wifi" size={11} />
              ao vivo
            </div>
          )}
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 2. PROBLEMA ─────────────────────────────────────── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-container">
          <div data-reveal className="lp-reveal">
            <span className="lp-label lp-label--red lp-section-label">
              <Icon name="report_problem" size={12} />
              O problema real
            </span>
            <h2 className="lp-section-title">
              A gestão de mídia exterior ainda é<br />feita de forma manual e fragmentada
            </h2>
            <p className="lp-section-sub">
              Empresas do setor perdem receita, tempo e clientes por não ter uma plataforma
              que una o comercial, o operacional e o financeiro em uma única verdade.
            </p>
          </div>

          <div className="lp-problems__grid">
            {PROBLEMS.map((p, i) => (
              <div
                key={p.text}
                className="lp-problem-item lp-reveal"
                data-reveal
                style={{ '--lp-delay': `${i * 60}ms` }}
              >
                <div className="lp-problem-item__icon">
                  <Icon name={p.icon} size={15} />
                </div>
                <p className="lp-problem-item__text">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 3. SOLUÇÃO ──────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-solution__layout">
            <div data-reveal className="lp-reveal">
              <span className="lp-label lp-label--green lp-section-label">
                <Icon name="check_circle" size={12} />
                A solução
              </span>
              <h2 className="lp-section-title">
                Uma plataforma única para toda a operação
              </h2>
              <p className="lp-section-sub">
                O InMidia conecta inventário, comercial e campo em um fluxo contínuo,
                eliminando inconsistências e garantindo que toda a equipe trabalhe
                com a mesma informação.
              </p>
              <div className="lp-solution__list" style={{ marginTop: 28 }}>
                {[
                  'Inventário centralizado com busca e filtros avançados',
                  'Engine temporal que impede dupla reserva automaticamente',
                  'Fluxo PI → Contrato com validação em cada etapa',
                  'Mapa operacional com status em tempo real por região',
                  'Operações de campo rastreadas por placa e por período',
                  'Dashboard executivo com KPIs de receita e ocupação',
                  'Alertas automáticos de vencimentos e conflitos',
                ].map((item) => (
                  <div key={item} className="lp-solution__item">
                    <div className="lp-solution__item-dot" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div data-reveal className="lp-reveal lp-reveal--delay-2 lp-solution__visual">
              <div className="lp-solution__visual-title">
                <Icon name="monitoring" size={12} />
                &nbsp;Visão geral da plataforma
              </div>
              <div className="lp-solution__metrics">
                {[
                  { count: kpis.placasTotal,        suffix: '',  lbl: 'Placas',           color: 'var(--lp-blue)'   },
                  { count: kpis.ocupacaoPercent,    suffix: '%', lbl: 'Ocupação',         color: 'var(--lp-cyan)'   },
                  { count: kpis.contratosAtivos,    suffix: '',  lbl: 'Contratos ativos', color: 'var(--lp-green)'  },
                  { count: kpis.contratosVencendo,  suffix: '',  lbl: 'Alertas',          color: 'var(--lp-amber)'  },
                  { count: kpis.regioes,            suffix: '',  lbl: 'Regiões',          color: 'var(--lp-violet)' },
                  { count: kpis.operacoesPendentes, suffix: '',  lbl: 'Ops. pendentes',   color: 'var(--lp-red)'    },
                ].map((m) => (
                  <div key={m.lbl} className="lp-sol-metric">
                    <div className="lp-sol-metric__val" style={{ color: m.color }}>
                      <CountUp to={m.count} suffix={m.suffix} duration={1600} />
                    </div>
                    <div className="lp-sol-metric__lbl">{m.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 4. MÓDULOS ──────────────────────────────────────── */}
      <section className="lp-section lp-section--alt" id="modulos">
        <div className="lp-container">
          <div className="lp-centered" data-reveal>
            <span className="lp-label lp-label--blue lp-section-label">
              <Icon name="widgets" size={12} />
              Módulos
            </span>
            <h2 className="lp-section-title">Tudo que você precisa, integrado</h2>
            <p className="lp-section-sub">
              Oito módulos especializados que formam um sistema completo,
              sem integrações externas ou planilhas paralelas.
            </p>
          </div>

          <div className="lp-modules__grid">
            {MODULES.map((m, i) => (
              <div
                key={m.title}
                className="lp-module-card lp-reveal"
                data-reveal
                style={{ '--lp-delay': `${i * 50}ms` }}
              >
                <div className="lp-module-card__icon" style={{ background: m.iconBg, color: m.iconColor }}>
                  <Icon name={m.icon} size={22} />
                </div>
                <div className="lp-module-card__title">{m.title}</div>
                <div className="lp-module-card__desc">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 5. ENGINE TEMPORAL ──────────────────────────────── */}
      <section className="lp-section" id="temporal">
        <div className="lp-container">
          <div className="lp-temporal__layout">
            <div data-reveal className="lp-reveal">
              <span className="lp-label lp-label--cyan lp-section-label">
                <Icon name="schedule" size={12} />
                Diferencial principal
              </span>
              <h2 className="lp-section-title">Engine Temporal V4.1</h2>
              <p className="lp-temporal__desc">
                Um motor de disponibilidade que opera em tempo real, validando cada
                tentativa de reserva, contrato ou operação antes de confirmar.
                O comercial e o campo nunca mais trabalham com informações diferentes.
              </p>
              <div className="lp-temporal__highlight">
                <strong>A Engine Temporal impede conflitos de contratação</strong>,
                bloqueia placas em períodos ativos e garante que o comercial,
                o operacional e o dashboard trabalhem com a mesma verdade.
              </div>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  'Validação em tempo real de disponibilidade',
                  'Promoção automática PI → Contrato',
                  'Bloqueio manual com motivo e rastreio',
                  'Timeline auditável por placa',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--lp-text-2)' }}>
                    <Icon name="check_circle" size={16} />
                    <span style={{ marginLeft: 2 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div data-reveal className="lp-reveal lp-reveal--delay-2 lp-temporal__panel">
              <div className="lp-temporal__panel-title">
                <Icon name="timeline" size={12} />
                Status temporais de placa
              </div>
              <div className="lp-status-list">
                {TEMPORAL_STATUSES.map((s) => (
                  <div key={s.label} className="lp-status-row">
                    <div className="lp-status-row__dot" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}66` }} />
                    <span className="lp-status-row__label">{s.label}</span>
                    <span className="lp-status-row__badge" style={{ background: s.badgeBg, color: s.badgeColor }}>
                      {s.badge}
                    </span>
                  </div>
                ))}
              </div>
              <div className="lp-temporal__note">
                <Icon name="info" size={12} />
                {' '}Reservas RESERVED, ACTIVE e BLOCKED impedem qualquer sobreposição.
                CANCELLED e EXPIRED liberam o intervalo para novas reservas.
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 6. MAPA E REGIÕES ───────────────────────────────── */}
      <section className="lp-section lp-section--alt">
        <div className="lp-container">
          <div className="lp-map__layout">
            <div data-reveal className="lp-reveal lp-map__visual">
              <div className="lp-map__mock">
                <div className="lp-map__dots">
                  {[
                    { top: '20%', left: '30%', color: 'var(--lp-green)'  },
                    { top: '35%', left: '55%', color: 'var(--lp-cyan)'   },
                    { top: '50%', left: '25%', color: 'var(--lp-green)'  },
                    { top: '40%', left: '70%', color: 'var(--lp-amber)'  },
                    { top: '65%', left: '45%', color: 'var(--lp-red)'    },
                    { top: '25%', left: '75%', color: 'var(--lp-green)'  },
                    { top: '70%', left: '65%', color: 'var(--lp-cyan)'   },
                    { top: '55%', left: '80%', color: 'var(--lp-green)'  },
                  ].map((d, i) => (
                    <div
                      key={i}
                      className="lp-map__dot"
                      style={{ top: d.top, left: d.left, background: d.color, boxShadow: `0 0 8px ${d.color}88` }}
                    />
                  ))}
                </div>
                <span className="lp-map__mock-label">Mapa operacional — placas por status</span>
              </div>
              <div className="lp-map__regions">
                {[
                  { name: 'Zona Norte', stats: '42 placas · 81% ocupação' },
                  { name: 'Zona Sul',   stats: '38 placas · 74% ocupação' },
                  { name: 'Zona Leste', stats: '31 placas · 90% ocupação' },
                  { name: 'Zona Oeste', stats: '27 placas · 63% ocupação' },
                ].map((r) => (
                  <div key={r.name} className="lp-map__region-card">
                    <div className="lp-map__region-name">{r.name}</div>
                    <div className="lp-map__region-stats">{r.stats}</div>
                  </div>
                ))}
              </div>
            </div>

            <div data-reveal className="lp-reveal lp-reveal--delay-2">
              <span className="lp-label lp-label--violet lp-section-label">
                <Icon name="map" size={12} />
                Mapa e regiões
              </span>
              <h2 className="lp-section-title">Visão geoespacial da sua operação</h2>
              <p className="lp-map__desc">
                O mapa operacional permite visualizar placas, regiões, disponibilidade,
                operações pendentes e ocupação territorial — tudo em uma tela interativa.
                Identifique oportunidades e gargalos antes que virem problemas.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { icon: 'pin_drop',     color: 'var(--lp-blue)',   label: 'Localização exata de cada placa no mapa' },
                  { icon: 'layers',       color: 'var(--lp-violet)', label: 'Agrupamento e filtro por região'          },
                  { icon: 'donut_large',  color: 'var(--lp-cyan)',   label: 'Ocupação territorial por zona'            },
                  { icon: 'notifications',color: 'var(--lp-amber)',  label: 'Alertas regionais visíveis no mapa'       },
                ].map((f) => (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--lp-border)', display: 'grid', placeItems: 'center', color: f.color, flexShrink: 0 }}>
                      <Icon name={f.icon} size={16} />
                    </div>
                    <span style={{ fontSize: 14, color: 'var(--lp-text-2)' }}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 7. OPERAÇÕES ────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-centered" data-reveal>
            <span className="lp-label lp-label--amber lp-section-label">
              <Icon name="construction" size={12} />
              Operações de campo
            </span>
            <h2 className="lp-section-title">Controle total do campo operacional</h2>
            <p className="lp-section-sub">
              Instalações, raspagens, manutenções e bloqueios — cada ação registrada,
              rastreada e conectada ao histórico da placa.
            </p>
          </div>
          <div className="lp-ops__grid">
            {OPS.map((op, i) => (
              <div
                key={op.title}
                className="lp-ops-card lp-reveal"
                data-reveal
                style={{ '--lp-delay': `${i * 60}ms` }}
              >
                <div className="lp-ops-card__icon" style={{ background: op.iconBg, color: op.iconColor }}>
                  <Icon name={op.icon} size={20} />
                </div>
                <div className="lp-ops-card__title">{op.title}</div>
                <div className="lp-ops-card__desc">{op.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 8. DASHBOARD ────────────────────────────────────── */}
      <section className="lp-section lp-section--alt" id="dashboard">
        <div className="lp-container">
          <div className="lp-centered" data-reveal>
            <span className="lp-label lp-label--cyan lp-section-label">
              <Icon name="dashboard" size={12} />
              Dashboard executivo
            </span>
            <h2 className="lp-section-title">Decisões mais rápidas com os dados certos</h2>
            <p className="lp-section-sub">
              KPIs de receita, ocupação e operações consolidados em uma tela,
              {isLive ? ' obtidos da API em tempo real.' : ' atualizados em tempo real para gestores e diretores.'}
            </p>
          </div>
          <div className="lp-dashboard__kpis">
            {kpiCards.map((k, i) => (
              <div
                key={k.label}
                className="lp-kpi lp-reveal"
                data-reveal
                style={{ '--lp-delay': `${i * 60}ms` }}
              >
                <div className="lp-kpi__icon" style={{ color: k.iconColor }}>
                  <Icon name={k.icon} size={20} />
                </div>
                <div className="lp-kpi__value" style={{ color: k.iconColor }}>
                  {k.count != null
                    ? <CountUp to={k.count} suffix={k.suffix} duration={1500} />
                    : k.value}
                </div>
                <div className="lp-kpi__label">{k.label}</div>
                <div className="lp-kpi__trend" style={{ background: k.trendBg, color: k.trendColor }}>
                  {k.trend}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 9. PLANOS E PREÇOS ──────────────────────────────── */}
      <section className="lp-section lp-section--plans" id="planos">
        <div className="lp-container">
          <div className="lp-centered" data-reveal>
            <span className="lp-label lp-label--blue lp-section-label">
              <Icon name="workspace_premium" size={12} />
              Planos e preços
            </span>
            <h2 className="lp-section-title">
              Escolha o plano ideal<br />para sua operação
            </h2>
            <p className="lp-section-sub">
              Escalone sua gestão de mídia exterior com recursos operacionais,
              temporais e comerciais integrados.
            </p>
            <p className="lp-plans__beta-notice">
              <Icon name="new_releases" size={13} />
              Valores iniciais para empresas participantes da fase V4.1 Beta.
            </p>
          </div>

          <div className="lp-plans__grid">
            {/* ── Inicial ── */}
            <div className="lp-plan-card lp-reveal" data-reveal style={{ '--lp-delay': '0ms' }}>
              <div className="lp-plan-card__header">
                <span className="lp-plan-card__name">Inicial</span>
                <div className="lp-plan-card__price-wrap">
                  <span className="lp-plan-card__currency">R$</span>
                  <span className="lp-plan-card__amount">25</span>
                  <span className="lp-plan-card__period">/mês</span>
                </div>
                <p className="lp-plan-card__desc">
                  Para empresas que estão estruturando sua operação de OOH.
                </p>
              </div>
              <div className="lp-plan-card__divider" />
              <ul className="lp-plan-card__features">
                {[
                  { ok: true,  label: 'Cadastro de placas'             },
                  { ok: true,  label: 'Dashboard básico'               },
                  { ok: true,  label: 'Mapa operacional'               },
                  { ok: true,  label: 'Controle simples de contratos'  },
                  { ok: true,  label: 'Disponibilidade temporal'       },
                  { ok: false, label: 'Operações de instalação'        },
                  { ok: false, label: 'Alertas automáticos'            },
                  { ok: false, label: 'Analytics avançado'             },
                ].map((f) => (
                  <li key={f.label} className={`lp-plan-feature ${!f.ok ? 'lp-plan-feature--off' : ''}`}>
                    <span className="lp-plan-feature__icon">
                      <Icon name={f.ok ? 'check_circle' : 'remove'} size={14} />
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>
              <a href="#" className="lp-btn lp-btn--ghost lp-plan-card__cta">
                Começar agora
                <Icon name="arrow_forward" size={15} />
              </a>
            </div>

            {/* ── Avançado ── */}
            <div className="lp-plan-card lp-reveal" data-reveal style={{ '--lp-delay': '80ms' }}>
              <div className="lp-plan-card__header">
                <span className="lp-plan-card__name">Avançado</span>
                <div className="lp-plan-card__price-wrap">
                  <span className="lp-plan-card__currency">R$</span>
                  <span className="lp-plan-card__amount">50</span>
                  <span className="lp-plan-card__period">/mês</span>
                </div>
                <p className="lp-plan-card__desc">
                  Para operações em crescimento com necessidade de rastreio de campo.
                </p>
              </div>
              <div className="lp-plan-card__divider" />
              <ul className="lp-plan-card__features">
                {[
                  { ok: true,  label: 'Tudo do plano Inicial'         },
                  { ok: true,  label: 'Operações de instalação'        },
                  { ok: true,  label: 'Raspagens e manutenções'        },
                  { ok: true,  label: 'Alertas automáticos'            },
                  { ok: true,  label: 'Métricas regionais'             },
                  { ok: true,  label: 'Timeline operacional'           },
                  { ok: false, label: 'Analytics avançado'             },
                  { ok: false, label: 'Engine temporal completa'       },
                ].map((f) => (
                  <li key={f.label} className={`lp-plan-feature ${!f.ok ? 'lp-plan-feature--off' : ''}`}>
                    <span className="lp-plan-feature__icon">
                      <Icon name={f.ok ? 'check_circle' : 'remove'} size={14} />
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>
              <a href="#" className="lp-btn lp-btn--ghost lp-plan-card__cta">
                Solicitar demonstração
                <Icon name="arrow_forward" size={15} />
              </a>
            </div>

            {/* ── Master (destaque) ── */}
            <div className="lp-plan-card lp-plan-card--featured lp-reveal" data-reveal style={{ '--lp-delay': '160ms' }}>
              <div className="lp-plan-card__badge">
                <Icon name="workspace_premium" size={11} />
                Mais escolhido
              </div>
              <div className="lp-plan-card__header">
                <span className="lp-plan-card__name">Master</span>
                <div className="lp-plan-card__price-wrap">
                  <span className="lp-plan-card__currency">R$</span>
                  <span className="lp-plan-card__amount">100</span>
                  <span className="lp-plan-card__period">/mês</span>
                </div>
                <p className="lp-plan-card__desc">
                  Para empresas enterprise com operação completa e múltiplas regiões.
                </p>
              </div>
              <div className="lp-plan-card__divider" />
              <ul className="lp-plan-card__features">
                {[
                  { ok: true, label: 'Tudo do plano Avançado'         },
                  { ok: true, label: 'Analytics avançado'              },
                  { ok: true, label: 'Regiões ilimitadas'              },
                  { ok: true, label: 'Engine temporal completa'        },
                  { ok: true, label: 'Dashboard executivo'             },
                  { ok: true, label: 'Suporte prioritário'             },
                  { ok: true, label: 'Integrações futuras'             },
                  { ok: true, label: 'API access'                      },
                ].map((f) => (
                  <li key={f.label} className="lp-plan-feature">
                    <span className="lp-plan-feature__icon lp-plan-feature__icon--featured">
                      <Icon name="check_circle" size={14} />
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>
              <Link to="/login" className="lp-btn lp-btn--primary lp-plan-card__cta">
                Entrar em contato
                <Icon name="arrow_forward" size={15} />
              </Link>
            </div>
          </div>

          {/* ── Aviso de evolução ── */}
          <p className="lp-plans__evolution-notice lp-reveal" data-reveal style={{ '--lp-delay': '200ms' }}>
            <Icon name="info" size={13} />
            Os planos podem evoluir conforme novos módulos forem liberados, como integrações, BI avançado e automações regionais.
          </p>

          {/* ── Comparativo horizontal ── */}
          <div className="lp-plans__compare lp-reveal" data-reveal style={{ '--lp-delay': '240ms' }}>
            <p className="lp-plans__compare-title">Todos os planos incluem</p>
            <div className="lp-plans__compare-grid">
              {[
                { icon: 'schedule',            label: 'Engine Temporal'       },
                { icon: 'dashboard',           label: 'Dashboard Executivo'   },
                { icon: 'layers',              label: 'Gestão Regional'       },
                { icon: 'construction',        label: 'Operações'             },
                { icon: 'notifications_active',label: 'Alertas Inteligentes'  },
                { icon: 'lock',                label: 'Dados seguros'         },
              ].map((item) => (
                <div key={item.label} className="lp-plans__compare-item">
                  <span className="lp-plans__compare-check">
                    <Icon name="check" size={12} />
                  </span>
                  <span className="lp-plans__compare-icon">
                    <Icon name={item.icon} size={14} />
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── 10. CTA FINAL ───────────────────────────────────── */}
      <section className="lp-cta">
        <div data-reveal className="lp-reveal">
          <h2 className="lp-cta__title">
            Transforme sua operação de mídia exterior em uma plataforma inteligente
          </h2>
          <p className="lp-cta__sub">
            Do inventário ao contrato, do campo ao dashboard — tudo em um sistema
            construído para empresas de OOH que levam a operação a sério.
          </p>
          <div className="lp-cta__actions">
            <Link to="/dashboard" className="lp-btn lp-btn--primary lp-btn--lg">
              <Icon name="rocket_launch" size={18} />
              Acessar sistema
            </Link>
            <a href="#modulos" className="lp-btn lp-btn--ghost lp-btn--lg">
              Ver demonstração
              <Icon name="play_circle" size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* ── 10. FOOTER ──────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer__inner">
            <div>
              <div className="lp-footer__brand">
                <div className="lp-nav__mark">IN</div>
                <span className="lp-nav__name">InMidia <span>V4.1</span></span>
              </div>
              <p className="lp-footer__desc">
                Plataforma operacional de mídia exterior. Inventário, contratos,
                operações e engine temporal em um único sistema enterprise.
              </p>
            </div>
            <div className="lp-footer__links">
              <Link to="/dashboard" className="lp-footer__link">Painel</Link>
              <Link to="/inventario" className="lp-footer__link">Inventário</Link>
              <Link to="/mapa"       className="lp-footer__link">Mapa</Link>
              <Link to="/operacoes"  className="lp-footer__link">Operações</Link>
              <Link to="/login"      className="lp-footer__link">Entrar</Link>
            </div>
          </div>
          <div className="lp-footer__copy">
            © 2026 InMidia · Plataforma operacional de mídia exterior · V4.1
          </div>
        </div>
      </footer>

    </div>
  );
}
