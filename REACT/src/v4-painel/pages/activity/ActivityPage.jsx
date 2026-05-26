import { memo, useState } from 'react';
import ActivityProvider, { useActivity } from '../../providers/ActivityProvider.jsx';
import './ActivityPage.css';

const SOURCE_LABEL = {
  real:         'DADOS REAIS',
  empty:        'SEM DADOS',
  stale:        'STALE',
  refreshing:   'ATUALIZANDO',
  error:        'ERRO',
  unauthorized: 'NAO AUTORIZADO',
  forbidden:    'SEM PERMISSAO',
  offline:      'OFFLINE',
};

const DOMAIN_COLOR = {
  commercial:  'var(--v4p-accent)',
  operations:  'var(--v4p-warning)',
  contracts:   'var(--v4p-success)',
  alerts:      'var(--v4p-danger)',
  reports:     'var(--v4p-text-3)',
  system:      'var(--v4p-text-4)',
};

const DOMAIN_BG = {
  commercial:  'rgba(116,133,255,0.10)',
  operations:  'rgba(227,180,86,0.10)',
  contracts:   'rgba(56,199,143,0.10)',
  alerts:      'rgba(255,92,122,0.10)',
  reports:     'rgba(148,163,184,0.08)',
  system:      'rgba(148,163,184,0.06)',
};

function domainColor(domain) { return DOMAIN_COLOR[domain] ?? 'var(--v4p-text-4)'; }
function domainBg(domain)    { return DOMAIN_BG[domain]    ?? 'rgba(148,163,184,0.06)'; }

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `há ${hrs}h`;
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function AbsTime({ iso }) {
  if (!iso) return null;
  return (
    <time className="v4p-act-time" dateTime={iso} title={new Date(iso).toLocaleString('pt-BR')}>
      {relativeTime(iso)}
    </time>
  );
}

function DomainChip({ domain, label }) {
  return (
    <span
      className="v4p-act-chip"
      style={{ color: domainColor(domain), background: domainBg(domain) }}
    >
      {label}
    </span>
  );
}

function TimelineItem({ event, isLast }) {
  const color = domainColor(event.domain);
  return (
    <div className={`v4p-act-tl-item${isLast ? ' v4p-act-tl-item--last' : ''}`}>
      <div className="v4p-act-tl-item__track">
        <span
          className="v4p-act-tl-item__dot material-symbols-rounded"
          style={{ color, background: domainBg(event.domain) }}
          aria-hidden="true"
        >
          {event.domainIcon ?? 'radio_button_checked'}
        </span>
        {!isLast && <span className="v4p-act-tl-item__line" />}
      </div>
      <div className="v4p-act-tl-item__body">
        <div className="v4p-act-tl-item__top">
          <span className="v4p-act-tl-item__title">{event.title}</span>
          <AbsTime iso={event.createdAt} />
        </div>
        {event.description && (
          <div className="v4p-act-tl-item__desc">{event.description}</div>
        )}
        <DomainChip domain={event.domain} label={event.domainLabel} />
      </div>
    </div>
  );
}

function FeedItem({ item }) {
  const color = domainColor(item.domain);
  return (
    <div className="v4p-act-feed-item">
      <span
        className="v4p-act-feed-item__icon material-symbols-rounded"
        style={{ color, background: domainBg(item.domain) }}
        aria-hidden="true"
      >
        {item.domainIcon ?? 'circle'}
      </span>
      <div className="v4p-act-feed-item__body">
        <span className="v4p-act-feed-item__title">{item.title}</span>
        <div className="v4p-act-feed-item__meta">
          <DomainChip domain={item.domain} label={item.domainLabel} />
          <AbsTime iso={item.createdAt} />
        </div>
      </div>
    </div>
  );
}

function DomainStatCard({ stats }) {
  const color = domainColor(stats.domain);
  const bg = domainBg(stats.domain);
  return (
    <div className="v4p-act-stat-card">
      <div className="v4p-act-stat-card__icon-wrap" style={{ background: bg }}>
        <span
          className="v4p-act-stat-card__icon material-symbols-rounded"
          style={{ color }}
          aria-hidden="true"
        >
          {stats.domainIcon ?? 'task_alt'}
        </span>
      </div>
      <div className="v4p-act-stat-card__body">
        <div className="v4p-act-stat-card__count">{stats.count}</div>
        <div className="v4p-act-stat-card__label" style={{ color }}>{stats.domainLabel}</div>
        {stats.lastAt && (
          <div className="v4p-act-stat-card__last">
            <AbsTime iso={stats.lastAt} />
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ entry }) {
  const color = domainColor(entry.domain);
  return (
    <tr className="v4p-act-audit-row">
      <td>
        <span className="v4p-act-audit-domain" style={{ color, background: domainBg(entry.domain) }}>
          {entry.domainLabel}
        </span>
      </td>
      <td className="v4p-act-audit-type">{entry.type}</td>
      <td className="v4p-act-audit-title">{entry.title}</td>
      <td>
        <span className={`v4p-act-audit-status v4p-act-audit-status--${entry.status}`}>
          {entry.status}
        </span>
      </td>
      <td><AbsTime iso={entry.createdAt} /></td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <div className="v4p-act-skel-row">
      <div className="v4p-act-skel v4p-act-skel--icon" />
      <div className="v4p-act-skel-body">
        <div className="v4p-act-skel v4p-act-skel--title" />
        <div className="v4p-act-skel v4p-act-skel--sub" />
      </div>
    </div>
  );
}

function EmptyState({ icon = 'inbox', label, sub }) {
  return (
    <div className="v4p-act-empty" role="status">
      <span className="v4p-act-empty__icon material-symbols-rounded" aria-hidden="true">{icon}</span>
      <span className="v4p-act-empty__label">{label}</span>
      {sub && <span className="v4p-act-empty__sub">{sub}</span>}
    </div>
  );
}

const TABS = ['timeline', 'feed', 'auditoria'];
const TAB_LABELS = { timeline: 'Timeline', feed: 'Feed', auditoria: 'Auditoria' };

function ActivityPageInner() {
  const { activity, loading, refreshing, stale, error, source, refresh } = useActivity();
  const [tab, setTab] = useState('timeline');

  const domainEntries = Object.values(activity.byDomain);

  const isBlocked = source === 'unauthorized' || source === 'forbidden' || source === 'offline';

  return (
    <div className="v4p-act-page">

      {/* ── Topline ─────────────────────────────────────────────── */}
      <div className="v4p-comm-topline">
        <span className={`v4p-comm-source v4p-comm-source--${source}`}>
          {loading ? 'CARREGANDO' : (SOURCE_LABEL[source] ?? 'ATIVIDADE')}
        </span>
        {(refreshing || stale) && (
          <span className="v4p-comm-source v4p-comm-source--fallback">
            {refreshing ? 'ATUALIZANDO' : 'DADOS ANTERIORES'}
          </span>
        )}
        {error && (
          <div className="v4p-comm-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={refresh}>Atualizar</button>
          </div>
        )}
      </div>

      {/* ── Hero header ─────────────────────────────────────────── */}
      <header className="v4p-act-hero">
        <div className="v4p-act-hero__left">
          <span className="v4p-act-hero__eyebrow">Módulo de Atividade</span>
          <h1 className="v4p-act-hero__title">Atividade</h1>
          <p className="v4p-act-hero__sub">
            Histórico global do sistema · eventos de todos os domínios em tempo real
          </p>
        </div>
        <div className="v4p-act-hero__right">
          <div className="v4p-page-live-indicator">
            <span className="v4p-page-live-indicator__dot" />
            Auditoria em tempo real
          </div>
          <button type="button" className="v4p-act-refresh-btn" onClick={refresh} disabled={loading || refreshing}>
            <span className="material-symbols-rounded" aria-hidden="true">refresh</span>
            Atualizar
          </button>
        </div>
      </header>

      {/* ── Blocked states ──────────────────────────────────────── */}
      {isBlocked && (
        <div className={`v4p-act-blocked v4p-act-blocked--${source}`} role="alert">
          <span className="material-symbols-rounded v4p-act-blocked__icon" aria-hidden="true">
            {source === 'offline' ? 'cloud_off' : 'lock'}
          </span>
          <div>
            <strong className="v4p-act-blocked__title">
              {source === 'unauthorized' && 'Autenticação necessária'}
              {source === 'forbidden'    && 'Acesso negado'}
              {source === 'offline'      && 'Sem conexão'}
            </strong>
            <p className="v4p-act-blocked__desc">
              {source === 'unauthorized' && 'Faça login para acessar o histórico de atividades.'}
              {source === 'forbidden'    && 'Sua conta não tem permissão para visualizar atividades.'}
              {source === 'offline'      && 'Verifique sua conexão. Os dados exibidos podem estar desatualizados.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Domain stats row ────────────────────────────────────── */}
      <section aria-label="Eventos por domínio">
        <div className="v4p-ops-section-label">Resumo por domínio</div>
        {loading ? (
          <div className="v4p-act-stat-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="v4p-act-stat-card v4p-act-stat-card--skeleton">
                <div className="v4p-act-skel v4p-act-skel--icon" />
                <div className="v4p-act-skel-body">
                  <div className="v4p-act-skel v4p-act-skel--count" />
                  <div className="v4p-act-skel v4p-act-skel--sub" />
                </div>
              </div>
            ))}
          </div>
        ) : domainEntries.length === 0 ? (
          <EmptyState icon="donut_large" label="Nenhum evento registrado por domínio." />
        ) : (
          <div className="v4p-act-stat-grid">
            {domainEntries.map((stats) => (
              <DomainStatCard key={stats.domain} stats={stats} />
            ))}
          </div>
        )}
      </section>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="v4p-act-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`v4p-act-tab${tab === t ? ' v4p-act-tab--active' : ''}`}
            type="button"
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
            {t === 'timeline'  && activity.timeline.length > 0 && (
              <span className="v4p-act-tab__badge">{activity.timeline.length}</span>
            )}
            {t === 'feed'      && activity.feed.length > 0 && (
              <span className="v4p-act-tab__badge">{activity.feed.length}</span>
            )}
            {t === 'auditoria' && activity.auditTotal > 0 && (
              <span className="v4p-act-tab__badge">{activity.auditTotal}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab panels ──────────────────────────────────────────── */}

      {tab === 'timeline' && (
        <section aria-label="Timeline global" className="v4p-act-panel">
          {loading ? (
            <div className="v4p-act-tl-list">
              {Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : activity.timeline.length === 0 ? (
            <EmptyState
              icon="timeline"
              label="Nenhum evento na timeline."
              sub="Os eventos aparecerão aqui conforme as operações do sistema ocorrem."
            />
          ) : (
            <div className="v4p-act-tl-list">
              {activity.timeline.map((event, i) => (
                <TimelineItem
                  key={event.id}
                  event={event}
                  isLast={i === activity.timeline.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'feed' && (
        <section aria-label="Feed operacional" className="v4p-act-panel">
          {loading ? (
            <div className="v4p-act-feed-list">
              {Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : activity.feed.length === 0 ? (
            <EmptyState
              icon="dynamic_feed"
              label="Sem itens no feed operacional."
              sub="Mutations e eventos de todos os domínios aparecem aqui."
            />
          ) : (
            <div className="v4p-act-feed-list">
              {activity.feed.map((item) => (
                <FeedItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'auditoria' && (
        <section aria-label="Auditoria" className="v4p-act-panel">
          {loading ? (
            <div className="v4p-act-audit-wrap">
              <div className="v4p-act-skel v4p-act-skel--table" />
            </div>
          ) : activity.audit.length === 0 ? (
            <EmptyState
              icon="fact_check"
              label="Nenhum registro de auditoria."
              sub="Entradas de auditoria são criadas por mutações com rastreamento habilitado."
            />
          ) : (
            <div className="v4p-act-audit-wrap">
              <table className="v4p-act-audit-table" aria-label="Registros de auditoria">
                <thead>
                  <tr>
                    <th>Domínio</th>
                    <th>Tipo</th>
                    <th>Título</th>
                    <th>Status</th>
                    <th>Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.audit.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

function ActivityPage() {
  return (
    <ActivityProvider>
      <ActivityPageInner />
    </ActivityProvider>
  );
}

export default memo(ActivityPage);
