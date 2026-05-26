import { memo, useState } from 'react';
import CampaignsProvider, { useCampaigns } from '../../providers/CampaignsProvider.jsx';
import './CampaignsPage.css';

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

const STATUS_LABEL = {
  draft:     'Rascunho',
  scheduled: 'Agendada',
  active:    'Ativa',
  paused:    'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `há ${hrs}h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function EmptyState({ icon = 'campaign', label, sub }) {
  return (
    <div className="v4p-camp-empty" role="status">
      <span className="v4p-camp-empty__icon material-symbols-rounded" aria-hidden="true">{icon}</span>
      <span className="v4p-camp-empty__label">{label}</span>
      {sub && <span className="v4p-camp-empty__sub">{sub}</span>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="v4p-camp-card v4p-camp-card--skeleton">
      <div className="v4p-camp-skel v4p-camp-skel--title" />
      <div className="v4p-camp-skel v4p-camp-skel--sub" />
      <div className="v4p-camp-skel v4p-camp-skel--tag" />
    </div>
  );
}

function SummaryCards({ summary, loading }) {
  const items = [
    { label: 'Total', value: summary.total, icon: 'campaign', mod: '' },
    { label: 'Ativas', value: summary.active, icon: 'play_circle', mod: 'active' },
    { label: 'Agendadas', value: summary.scheduled, icon: 'schedule', mod: 'scheduled' },
    { label: 'Pausadas', value: summary.paused, icon: 'pause_circle', mod: 'paused' },
    { label: 'Rascunhos', value: summary.draft, icon: 'edit_note', mod: 'draft' },
    { label: 'Concluídas', value: summary.completed, icon: 'check_circle', mod: 'completed' },
  ];

  return (
    <div className="v4p-camp-summary-grid">
      {items.map((item) => (
        <div key={item.label} className={`v4p-camp-kpi-card v4p-camp-kpi-card--${item.mod}`}>
          <span className="v4p-camp-kpi-card__icon material-symbols-rounded" aria-hidden="true">
            {item.icon}
          </span>
          <div className="v4p-camp-kpi-card__body">
            <div className="v4p-camp-kpi-card__value">
              {loading ? <span className="v4p-camp-skel v4p-camp-skel--count" /> : item.value}
            </div>
            <div className="v4p-camp-kpi-card__label">{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignCard({ campaign, onPause, onActivate, onDelete, mutating }) {
  const isBusy = mutating === campaign.id;

  return (
    <div className={`v4p-camp-card v4p-camp-card--${campaign.status}`}>
      <div className="v4p-camp-card__header">
        <span className="v4p-camp-card__name">{campaign.name}</span>
        <span className={`v4p-camp-card__status v4p-camp-card__status--${campaign.status}`}>
          {STATUS_LABEL[campaign.status] ?? campaign.status}
        </span>
      </div>

      {campaign.description && (
        <div className="v4p-camp-card__desc">{campaign.description}</div>
      )}

      <div className="v4p-camp-card__meta">
        {campaign.startDate && (
          <span className="v4p-camp-card__meta-item">
            <span className="material-symbols-rounded" aria-hidden="true">calendar_today</span>
            {formatDate(campaign.startDate)}
            {campaign.endDate && ` → ${formatDate(campaign.endDate)}`}
          </span>
        )}
        {campaign.budget != null && (
          <span className="v4p-camp-card__meta-item">
            <span className="material-symbols-rounded" aria-hidden="true">payments</span>
            {formatCurrency(campaign.budget)}
          </span>
        )}
        {campaign.target && (
          <span className="v4p-camp-card__meta-item">
            <span className="material-symbols-rounded" aria-hidden="true">group</span>
            {campaign.target}
          </span>
        )}
      </div>

      <div className="v4p-camp-card__footer">
        <span className="v4p-camp-card__age">{relativeTime(campaign.createdAt)}</span>
        <div className="v4p-camp-card__actions">
          {campaign.status === 'active' && (
            <button
              type="button"
              className="v4p-action-button v4p-action-button--subtle v4p-action-button--sm"
              onClick={() => onPause(campaign)}
              disabled={isBusy}
              aria-label="Pausar campanha"
            >
              <span className="material-symbols-rounded" aria-hidden="true">pause</span>
            </button>
          )}
          {(campaign.status === 'paused' || campaign.status === 'scheduled' || campaign.status === 'draft') && (
            <button
              type="button"
              className="v4p-action-button v4p-action-button--subtle v4p-action-button--sm"
              onClick={() => onActivate(campaign)}
              disabled={isBusy}
              aria-label="Ativar campanha"
            >
              <span className="material-symbols-rounded" aria-hidden="true">play_arrow</span>
            </button>
          )}
          <button
            type="button"
            className="v4p-action-button v4p-action-button--subtle v4p-action-button--sm v4p-camp-card__delete-btn"
            onClick={() => onDelete(campaign)}
            disabled={isBusy}
            aria-label="Excluir campanha"
          >
            <span className="material-symbols-rounded" aria-hidden="true">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateCampaignForm({ onCreate, loading }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [target, setTarget] = useState('');
  const [open, setOpen] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate({
      name:      name.trim(),
      startDate: startDate || undefined,
      endDate:   endDate || undefined,
      budget:    budget ? Number(budget) : undefined,
      target:    target || undefined,
      status:    'draft',
    });
    setName('');
    setStartDate('');
    setEndDate('');
    setBudget('');
    setTarget('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="v4p-action-button v4p-action-button--primary v4p-action-button--md"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-rounded" aria-hidden="true">add</span>
        Nova campanha
      </button>
    );
  }

  return (
    <form className="v4p-camp-create-form" onSubmit={handleSubmit}>
      <h3 className="v4p-camp-create-form__title">Nova campanha</h3>
      <div className="v4p-camp-form-row">
        <label className="v4p-camp-form-label">
          Nome *
          <input
            className="v4p-camp-form-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da campanha"
            required
          />
        </label>
        <label className="v4p-camp-form-label">
          Público-alvo
          <input
            className="v4p-camp-form-input"
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Ex: Jovens 18-35"
          />
        </label>
      </div>
      <div className="v4p-camp-form-row">
        <label className="v4p-camp-form-label">
          Início
          <input
            className="v4p-camp-form-input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="v4p-camp-form-label">
          Término
          <input
            className="v4p-camp-form-input"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className="v4p-camp-form-label">
          Orçamento (R$)
          <input
            className="v4p-camp-form-input"
            type="number"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>
      <div className="v4p-camp-form-actions">
        <button type="submit" className="v4p-action-button v4p-action-button--primary v4p-action-button--md" disabled={loading || !name.trim()}>
          {loading ? 'Criando…' : 'Criar campanha'}
        </button>
        <button type="button" className="v4p-action-button v4p-action-button--subtle v4p-action-button--md" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function PerformancePanel({ performance, loading }) {
  if (loading) {
    return (
      <div className="v4p-camp-perf-panel">
        <div className="v4p-camp-skel v4p-camp-skel--perf-count" />
        <div className="v4p-camp-skel v4p-camp-skel--sub" />
      </div>
    );
  }

  return (
    <div className="v4p-camp-perf-panel">
      <div className="v4p-camp-perf-panel__stat">
        <span className="v4p-camp-perf-panel__value">{performance.totalTracked}</span>
        <span className="v4p-camp-perf-panel__label">campanhas rastreadas</span>
      </div>
      <div className="v4p-camp-perf-panel__stat">
        <span className="v4p-camp-perf-panel__value">{formatCurrency(performance.activeBudget)}</span>
        <span className="v4p-camp-perf-panel__label">orçamento ativo</span>
      </div>
      {Object.entries(performance.byStatus).length > 0 && (
        <div className="v4p-camp-perf-panel__by-status">
          {Object.entries(performance.byStatus).map(([status, count]) => (
            <div key={status} className={`v4p-camp-perf-status v4p-camp-perf-status--${status}`}>
              <span className="v4p-camp-perf-status__count">{count}</span>
              <span className="v4p-camp-perf-status__label">{STATUS_LABEL[status] ?? status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = ['all', 'active', 'scheduled'];
const TAB_LABELS = { all: 'Todas', active: 'Ativas', scheduled: 'Agendadas' };

function CampaignsPageInner() {
  const {
    campaigns,
    loading,
    refreshing,
    stale,
    error,
    source,
    refresh,
    createCampaign,
    pauseCampaign,
    activateCampaign,
    deleteCampaign,
    mutations,
  } = useCampaigns();

  const [tab, setTab] = useState('all');
  const [mutating, setMutating] = useState(null);

  const isBlocked = source === 'unauthorized' || source === 'forbidden' || source === 'offline';

  const visibleCampaigns = tab === 'active'    ? campaigns.active
    : tab === 'scheduled' ? campaigns.scheduled
    : campaigns.list;

  async function handlePause(campaign) {
    setMutating(campaign.id);
    try { await pauseCampaign({ id: campaign.id }); } finally { setMutating(null); }
  }

  async function handleActivate(campaign) {
    setMutating(campaign.id);
    try { await activateCampaign({ id: campaign.id }); } finally { setMutating(null); }
  }

  async function handleDelete(campaign) {
    setMutating(campaign.id);
    try { await deleteCampaign({ id: campaign.id }); } finally { setMutating(null); }
  }

  return (
    <div className="v4p-camp-page">

      {/* ── Topline ─────────────────────────────────────────────── */}
      <div className="v4p-comm-topline">
        <span className={`v4p-comm-source v4p-comm-source--${source}`}>
          {loading ? 'CARREGANDO' : (SOURCE_LABEL[source] ?? 'CAMPANHAS')}
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

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="v4p-camp-header">
        <div>
          <h1 className="v4p-camp-header__title">Campanhas</h1>
          <div className="v4p-camp-header__sub">
            {campaigns.summary.total} campanhas · {campaigns.activeCount} ativas · atualizado {relativeTime(campaigns.generatedAt)}
          </div>
        </div>
        <div className="v4p-camp-header__right">
          <div className="v4p-page-live-indicator">
            <span className="v4p-page-live-indicator__dot" />
            Gestão de campanhas
          </div>
          <button
            type="button"
            className="v4p-act-refresh-btn"
            onClick={refresh}
            disabled={loading || refreshing}
          >
            <span className="material-symbols-rounded" aria-hidden="true">refresh</span>
            Atualizar
          </button>
        </div>
      </header>

      {/* ── Blocked states ──────────────────────────────────────── */}
      {isBlocked && (
        <div className={`v4p-camp-blocked v4p-camp-blocked--${source}`} role="alert">
          <span className="material-symbols-rounded v4p-camp-blocked__icon" aria-hidden="true">
            {source === 'offline' ? 'cloud_off' : 'lock'}
          </span>
          <div>
            <strong className="v4p-camp-blocked__title">
              {source === 'unauthorized' && 'Autenticação necessária'}
              {source === 'forbidden'    && 'Sem permissão'}
              {source === 'offline'      && 'Sem conexão'}
            </strong>
            <p className="v4p-camp-blocked__desc">
              {source === 'unauthorized' && 'Faça login para acessar campanhas.'}
              {source === 'forbidden'    && 'Sua conta não tem permissão para visualizar campanhas.'}
              {source === 'offline'      && 'Verifique sua conexão. Os dados exibidos podem estar desatualizados.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Summary cards ───────────────────────────────────────── */}
      <section aria-label="Resumo de campanhas">
        <div className="v4p-ops-section-label">Resumo</div>
        <SummaryCards summary={campaigns.summary} loading={loading} />
      </section>

      {/* ── Performance panel ───────────────────────────────────── */}
      <section aria-label="Desempenho de campanhas">
        <div className="v4p-ops-section-label">Desempenho</div>
        <PerformancePanel performance={campaigns.performance} loading={loading} />
      </section>

      {/* ── Create form ─────────────────────────────────────────── */}
      <section aria-label="Criar campanha">
        <CreateCampaignForm
          onCreate={createCampaign}
          loading={mutations.createMut.isLoading}
        />
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
            {t === 'all'       && campaigns.summary.total > 0 && (
              <span className="v4p-act-tab__badge">{campaigns.summary.total}</span>
            )}
            {t === 'active'    && campaigns.activeCount > 0 && (
              <span className="v4p-act-tab__badge">{campaigns.activeCount}</span>
            )}
            {t === 'scheduled' && campaigns.scheduledCount > 0 && (
              <span className="v4p-act-tab__badge">{campaigns.scheduledCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Campaign list ───────────────────────────────────────── */}
      <section aria-label="Lista de campanhas" className="v4p-camp-panel">
        {loading ? (
          <div className="v4p-camp-list">
            {Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : visibleCampaigns.length === 0 ? (
          <EmptyState
            icon="campaign"
            label={
              tab === 'active'    ? 'Nenhuma campanha ativa no momento.' :
              tab === 'scheduled' ? 'Nenhuma campanha agendada.' :
              'Nenhuma campanha cadastrada.'
            }
            sub={tab === 'all' ? 'Crie a primeira campanha usando o formulário acima.' : undefined}
          />
        ) : (
          <div className="v4p-camp-list">
            {visibleCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onPause={handlePause}
                onActivate={handleActivate}
                onDelete={handleDelete}
                mutating={mutating}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function CampaignsPage() {
  return (
    <CampaignsProvider>
      <CampaignsPageInner />
    </CampaignsProvider>
  );
}

export default memo(CampaignsPage);
