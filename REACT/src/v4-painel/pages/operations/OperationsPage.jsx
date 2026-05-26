import { memo, useMemo, useState, useCallback } from 'react';

import { PERMISSIONS } from '../../../auth/permissions.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import DataSourceBadge from '../../design-system/states/DataSourceBadge.jsx';
import { StatusBadge } from '../../design-system/badges/index.js';
import {
  V4Badge,
  V4Button,
  V4Card,
  V4DataTable,
  V4EmptyState,
  V4SectionHeader,
  V4Skeleton,
  V4StatCard,
} from '../../components/ui/index.js';
import OperationCanonicalizationCard from '../../components/operations/OperationCanonicalizationCard.jsx';
import OperationLinkResolutionQueue from '../../components/operations/OperationLinkResolutionQueue.jsx';
import OperationFormModal from '../../components/operations/OperationFormModal.jsx';
import OperationsProvider, { useOperations } from '../../providers/OperationsProvider.jsx';
import './OperationsPage.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_TO_BADGE = {
  healthy: 'success', operational: 'success', success: 'success',
  warning: 'warning', attention: 'warning', degraded: 'warning',
  syncing: 'info', pending: 'info',
  critical: 'danger', danger: 'danger', offline: 'danger', error: 'danger',
};

const TYPE_ICON = {
  INSTALLATION: 'install_desktop',
  SCRAPING:     'cleaning_services',
  MAINTENANCE:  'build',
  BLOCK:        'block',
  INSPECTION:   'search',
  OTHER:        'more_horiz',
};

const TYPE_LABEL = {
  INSTALLATION: 'Instalação',
  SCRAPING:     'Raspagem',
  MAINTENANCE:  'Manutenção',
  BLOCK:        'Bloqueio',
  INSPECTION:   'Inspeção',
  OTHER:        'Outro',
};

const TYPE_COLOR = {
  INSTALLATION: 'info',
  SCRAPING:     'warning',
  MAINTENANCE:  'warning',
  BLOCK:        'danger',
  INSPECTION:   'muted',
  OTHER:        'muted',
};

const STATUS_LABEL = {
  pending:     'Pendente',
  PENDING:     'Pendente',
  SCHEDULED:   'Agendada',
  IN_PROGRESS: 'Em andamento',
  completed:   'Concluída',
  DONE:        'Concluída',
  CANCELLED:   'Cancelada',
};

const STATUS_COLOR = {
  pending:     'info',
  PENDING:     'info',
  SCHEDULED:   'warning',
  IN_PROGRESS: 'primary',
  completed:   'success',
  DONE:        'success',
  CANCELLED:   'muted',
};

const SLA_LABEL = {
  ON_TRACK: 'No prazo',
  DUE_SOON: 'Vence hoje',
  OVERDUE:  'Atrasada',
  RESOLVED: 'Resolvida',
  CANCELLED:'Cancelada',
  UNKNOWN:  'Sem prazo',
};

const PRIORITY_LABEL = {
  CRITICAL: 'Crítica',
  HIGH:     'Alta',
  MEDIUM:   'Média',
  LOW:      'Baixa',
};

const PRIORITY_COLOR = {
  CRITICAL: 'danger',
  HIGH:     'warning',
  MEDIUM:   'info',
  LOW:      'muted',
};

const BOARD_COLUMNS = [
  { id: 'PENDING',     label: 'Pendente',      icon: 'schedule' },
  { id: 'SCHEDULED',   label: 'Agendada',       icon: 'event' },
  { id: 'IN_PROGRESS', label: 'Em andamento',   icon: 'play_circle' },
  { id: 'DONE',        label: 'Concluída',      icon: 'check_circle' },
  { id: 'CANCELLED',   label: 'Cancelada',      icon: 'cancel' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(value) { return Number(value || 0).toLocaleString('pt-BR'); }

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPercent(value) { return `${Math.round(Number(value || 0) * 100)}%`; }

function formatMinutes(value) {
  if (value == null) return '—';
  const minutes = Number(value || 0);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60)}h`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value));
  } catch { return value; }
}

function badgeVariant(state) { return STATUS_TO_BADGE[state] ?? 'muted'; }

function slaVariant(status) {
  if (status === 'OVERDUE') return 'danger';
  if (status === 'DUE_SOON') return 'warning';
  if (status === 'RESOLVED' || status === 'ON_TRACK') return 'success';
  if (status === 'CANCELLED') return 'muted';
  return 'info';
}

function sourceToBadge(source, status) {
  if (status === 'offline' || source === 'offline') return 'offline';
  if (status === 'stale' || status === 'refreshing' || source === 'stale') return 'stale';
  if (source === 'mock') return 'demo';
  if (source === 'fallback') return 'cached';
  if (source === 'error' || status === 'error') return 'offline';
  return 'synced';
}

function getCanonicalStatus(task) {
  return task.payload?.operationStatus ?? task.operationStatus ?? task.status ?? 'PENDING';
}

function isActive(task) {
  const s = String(getCanonicalStatus(task)).toUpperCase();
  return s !== 'DONE' && s !== 'CANCELLED' && s !== 'COMPLETED';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OperationsStateNotice({ status, error, refresh }) {
  if (status === 'success' || status === 'refreshing' || status === 'stale') return null;

  const copy = {
    loading:      { icon: 'hourglass_empty', title: 'Atualizando dados operacionais.', description: 'Buscando a leitura mais recente da operação.' },
    unauthorized: { icon: 'lock',            title: 'Sua sessão precisa ser renovada.', description: 'Entre novamente para acompanhar as operações.' },
    forbidden:    { icon: 'block',           title: 'Você não tem acesso a esta área.', description: 'Contate o administrador para solicitar acesso.' },
    offline:      { icon: 'cloud_off',       title: 'Não foi possível atualizar os dados agora.', description: 'Tente novamente em instantes.' },
    error:        { icon: 'error_outline',   title: 'Não foi possível atualizar os dados agora.', description: error || 'Tente novamente em instantes.' },
  }[status] ?? { icon: 'info', title: 'Nenhuma informação encontrada.', description: 'Tente novamente em instantes.' };

  return (
    <V4Card className={`v4p-ops-state v4p-ops-state--${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <span className="material-symbols-rounded" aria-hidden="true">{copy.icon}</span>
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.description}</p>
      </div>
      {status !== 'loading' && (
        <V4Button type="button" variant="secondary" size="sm" onClick={refresh}>Atualizar</V4Button>
      )}
    </V4Card>
  );
}

function OperationsHeader({ operations, loading, refreshing, stale, status, source, onCreateOp }) {
  const overview = operations.overview ?? {};
  const health = operations.health ?? {};
  const state = health.status ?? overview.sincronizacao ?? 'operational';
  const hasAttention = Number(health.pendingCount ?? 0) + Number(health.warningCount ?? 0) + Number(health.criticalCount ?? 0);

  return (
    <V4Card className={`v4p-ops-header v4p-ops-header--${badgeVariant(state)}`}>
      <div className="v4p-ops-header__copy">
        <span>Central operacional</span>
        <h1>Operações</h1>
        <p>Gerencie instalações, raspagens, manutenções e bloqueios dos pontos de mídia exterior.</p>
      </div>
      <div className="v4p-ops-header__meta">
        <StatusBadge
          state={state === 'operational' ? 'healthy' : state}
          label={hasAttention > 0 ? 'Atenção operacional' : 'Operação em acompanhamento'}
          size="lg"
        />
        <DataSourceBadge
          source={sourceToBadge(source, status)}
          label={source === 'mock' ? 'Dados demonstrativos' : undefined}
          compact={false}
        />
        {(loading || refreshing || stale) && (
          <V4Badge variant={refreshing || stale ? 'warning' : 'info'} size="sm">
            {refreshing ? 'Atualizando' : stale ? 'Dados anteriores' : 'Carregando'}
          </V4Badge>
        )}
        <span className="v4p-ops-header__timestamp">
          Atualizado {overview.ultimaAtualizacao ?? operations.generatedAt ?? '—'}
        </span>
        <div className="v4p-ops-header__actions">
          <V4Button type="button" variant="primary" size="sm" onClick={() => onCreateOp('INSTALLATION')}>
            <span className="material-symbols-rounded" aria-hidden="true">install_desktop</span>
            Nova instalação
          </V4Button>
          <V4Button type="button" variant="secondary" size="sm" onClick={() => onCreateOp('SCRAPING')}>
            <span className="material-symbols-rounded" aria-hidden="true">cleaning_services</span>
            Raspagem
          </V4Button>
          <V4Button type="button" variant="secondary" size="sm" onClick={() => onCreateOp('MAINTENANCE')}>
            <span className="material-symbols-rounded" aria-hidden="true">build</span>
            Manutenção
          </V4Button>
          <V4Button type="button" variant="danger" size="sm" onClick={() => onCreateOp('BLOCK')}>
            <span className="material-symbols-rounded" aria-hidden="true">block</span>
            Bloqueio
          </V4Button>
        </div>
      </div>
    </V4Card>
  );
}

function OperationsKpis({ overview, health, sla, tasks, loading }) {
  const activeTasks = (tasks ?? []).filter(isActive);
  const overdueTasks = activeTasks.filter((t) => t.slaStatus === 'OVERDUE');
  const dueSoonTasks = activeTasks.filter((t) => t.slaStatus === 'DUE_SOON');
  const criticalTasks = activeTasks.filter((t) => {
    const p = String(t.payload?.priority ?? t.slaPriority ?? '').toUpperCase();
    return p === 'CRITICAL';
  });

  const cards = [
    {
      id: 'pending',
      title: 'Pendentes',
      value: formatCount(activeTasks.length),
      description: 'Operações aguardando execução',
      trend: `${formatCount(health.completedToday ?? 0)} concluídas hoje`,
      status: criticalTasks.length > 0 ? 'danger' : activeTasks.length > 0 ? 'warning' : 'success',
      icon: 'task_alt',
    },
    {
      id: 'overdue',
      title: 'Atrasadas',
      value: formatCount(overdueTasks.length || sla?.overdueOperations || 0),
      description: 'SLA vencido — atenção imediata',
      trend: `${formatCount(dueSoonTasks.length || sla?.dueSoonOperations || 0)} vencendo hoje`,
      status: (overdueTasks.length || sla?.overdueOperations) ? 'danger' : 'success',
      icon: 'warning',
    },
    {
      id: 'critical',
      title: 'Críticas',
      value: formatCount(criticalTasks.length || sla?.criticalBacklog || 0),
      description: 'Prioridade máxima',
      trend: `Tempo médio: ${formatMinutes(sla?.averageResolutionMinutes)}`,
      status: criticalTasks.length > 0 ? 'danger' : 'success',
      icon: 'emergency',
    },
    {
      id: 'installations',
      title: 'Instalações',
      value: formatCount((tasks ?? []).filter((t) => String(t.payload?.operationType ?? t.operationType ?? '').toUpperCase() === 'INSTALLATION' && isActive(t)).length),
      description: 'Instalações pendentes ou em andamento',
      trend: '',
      status: 'info',
      icon: 'install_desktop',
    },
    {
      id: 'maintenance',
      title: 'Em manutenção',
      value: formatCount(overview.emManutencao ?? (tasks ?? []).filter((t) => {
        const type = String(t.payload?.operationType ?? t.operationType ?? '').toUpperCase();
        return (type === 'MAINTENANCE' || type === 'BLOCK') && isActive(t);
      }).length),
      description: 'Pontos com bloqueio ou manutenção',
      trend: `${formatCount(overview.alertasRegionais ?? 0)} alertas regionais`,
      status: 'warning',
      icon: 'build',
    },
  ];

  return (
    <section className="v4p-ops-kpis" aria-label="Indicadores operacionais">
      {loading
        ? Array.from({ length: 5 }, (_, i) => <V4Skeleton key={i} variant="card" />)
        : cards.map((card) => (
          <V4StatCard
            key={card.id}
            title={card.title}
            value={card.value}
            description={card.description}
            trend={card.trend}
            status={card.status}
            icon={<span className="material-symbols-rounded" aria-hidden="true">{card.icon}</span>}
          />
        ))}
    </section>
  );
}

function OperationsSlaPanel({ sla = {}, loading }) {
  const health = sla.operationsSlaHealth ?? 'HEALTHY';
  const healthLabel = health === 'CRITICAL' ? 'Crítica' : health === 'ATTENTION' ? 'Atenção' : 'Saudável';
  const healthVariant = health === 'CRITICAL' ? 'danger' : health === 'ATTENTION' ? 'warning' : 'success';
  const cards = [
    { id: 'overdue',  label: 'Atrasadas',       value: sla.overdueOperations ?? 0 },
    { id: 'dueSoon',  label: 'Vencendo hoje',   value: sla.dueSoonOperations ?? 0 },
    { id: 'critical', label: 'Backlog crítico', value: sla.criticalBacklog ?? 0 },
    { id: 'avg',      label: 'Tempo médio',     value: formatMinutes(sla.averageResolutionMinutes) },
  ];

  return (
    <V4Card className="v4p-ops-panel v4p-ops-sla">
      <V4SectionHeader
        eyebrow="SLA"
        title="Prioridade operacional"
        description="Atraso, urgência e tempo de resolução das operações em aberto."
        actions={<V4Badge variant={healthVariant} size="sm">{healthLabel}</V4Badge>}
      />
      {loading ? <V4Skeleton variant="card" /> : (
        <div className="v4p-ops-sla__grid">
          {cards.map((card) => (
            <div key={card.id} className={`v4p-ops-sla__item is-${card.id}`}>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </div>
          ))}
        </div>
      )}
    </V4Card>
  );
}

function OperationCard({ task, onStart, onComplete, onCancel, actioning }) {
  const status = String(getCanonicalStatus(task)).toUpperCase();
  const type = String(task.payload?.operationType ?? task.operationType ?? 'OTHER').toUpperCase();
  const priority = String(task.payload?.priority ?? task.slaPriority ?? 'MEDIUM').toUpperCase();
  const plateId = task.payload?.plateId ?? task.plateId ?? null;
  const region = task.payload?.regionId ?? task.regionId ?? null;
  const assignedTo = task.payload?.assignedTo ?? task.assigneeId ?? null;
  const scheduledAt = task.payload?.scheduledAt ?? task.scheduledAt ?? null;
  const dueAt = task.referenceDueAt ?? task.payload?.dueAt ?? null;
  const slaStatus = task.slaStatus ?? null;

  const canStart    = status === 'PENDING' || status === 'SCHEDULED';
  const canComplete = status === 'IN_PROGRESS';
  const canCancel   = status !== 'DONE' && status !== 'COMPLETED' && status !== 'CANCELLED';
  const isOverdue   = slaStatus === 'OVERDUE';
  const isDueSoon   = slaStatus === 'DUE_SOON';

  return (
    <article
      className={`v4p-op-card v4p-op-card--${type.toLowerCase()}${isOverdue ? ' v4p-op-card--overdue' : ''}${isDueSoon ? ' v4p-op-card--due-soon' : ''}`}
    >
      <div className="v4p-op-card__badges">
        <V4Badge variant={TYPE_COLOR[type] ?? 'muted'} size="sm">
          <span className="material-symbols-rounded v4p-op-card__type-icon" aria-hidden="true">
            {TYPE_ICON[type] ?? 'more_horiz'}
          </span>
          {TYPE_LABEL[type] ?? type}
        </V4Badge>
        <V4Badge variant={PRIORITY_COLOR[priority] ?? 'muted'} size="sm">
          {PRIORITY_LABEL[priority] ?? priority}
        </V4Badge>
        {slaStatus && slaStatus !== 'UNKNOWN' && (
          <V4Badge variant={slaVariant(slaStatus)} size="sm">
            {SLA_LABEL[slaStatus] ?? slaStatus}
          </V4Badge>
        )}
      </div>

      <div className="v4p-op-card__body">
        <p className="v4p-op-card__title">{task.title ?? TYPE_LABEL[type] ?? 'Operação'}</p>
        {plateId && (
          <p className="v4p-op-card__meta">
            <span className="material-symbols-rounded" aria-hidden="true">display_settings</span>
            {String(plateId).slice(-8)}
          </p>
        )}
        {region && (
          <p className="v4p-op-card__meta">
            <span className="material-symbols-rounded" aria-hidden="true">map</span>
            {String(region).slice(-8)}
          </p>
        )}
        {assignedTo && (
          <p className="v4p-op-card__meta">
            <span className="material-symbols-rounded" aria-hidden="true">person</span>
            {assignedTo}
          </p>
        )}
        {(scheduledAt || dueAt) && (
          <p className="v4p-op-card__meta">
            <span className="material-symbols-rounded" aria-hidden="true">calendar_today</span>
            {scheduledAt ? formatDate(scheduledAt) : '—'}
            {dueAt ? ` → ${formatDate(dueAt)}` : ''}
          </p>
        )}
        {task.isOverdue && task.overdueMinutes > 0 && (
          <p className="v4p-op-card__overdue">
            <span className="material-symbols-rounded" aria-hidden="true">alarm</span>
            {formatMinutes(task.overdueMinutes)} de atraso
          </p>
        )}
      </div>

      <div className="v4p-op-card__actions">
        {canStart && (
          <button type="button" className="v4p-op-card__action v4p-op-card__action--start"
            onClick={() => onStart(task.id)} disabled={actioning === task.id}>
            <span className="material-symbols-rounded" aria-hidden="true">play_arrow</span>
            {actioning === task.id ? '…' : 'Iniciar'}
          </button>
        )}
        {canComplete && (
          <button type="button" className="v4p-op-card__action v4p-op-card__action--complete"
            onClick={() => onComplete(task.id)} disabled={actioning === task.id}>
            <span className="material-symbols-rounded" aria-hidden="true">check</span>
            {actioning === task.id ? '…' : 'Concluir'}
          </button>
        )}
        {canCancel && (
          <button type="button" className="v4p-op-card__action v4p-op-card__action--cancel"
            onClick={() => onCancel(task.id)} disabled={actioning === task.id}>
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
            {actioning === task.id ? '…' : 'Cancelar'}
          </button>
        )}
      </div>
    </article>
  );
}

function OperationsBoard({ tasks, loading, onStart, onComplete, onCancel, actioning }) {
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSla, setFilterSla] = useState('');

  const filtered = useMemo(() => {
    let list = tasks ?? [];
    if (filterType) list = list.filter((t) => String(t.payload?.operationType ?? t.operationType ?? '').toUpperCase() === filterType);
    if (filterStatus) {
      list = list.filter((t) => {
        const s = String(getCanonicalStatus(t)).toUpperCase();
        const target = filterStatus.toUpperCase();
        if (target === 'DONE') return s === 'DONE' || s === 'COMPLETED';
        return s === target;
      });
    }
    if (filterPriority) list = list.filter((t) => String(t.payload?.priority ?? t.slaPriority ?? '').toUpperCase() === filterPriority);
    if (filterSla) list = list.filter((t) => (t.slaStatus ?? '') === filterSla);
    return list;
  }, [tasks, filterType, filterStatus, filterPriority, filterSla]);

  const byStatus = useMemo(() => {
    const map = {};
    BOARD_COLUMNS.forEach((col) => { map[col.id] = []; });
    filtered.forEach((task) => {
      const s = String(getCanonicalStatus(task)).toUpperCase();
      const colId = s === 'COMPLETED' ? 'DONE' : (map[s] ? s : 'PENDING');
      map[colId].push(task);
    });
    return map;
  }, [filtered]);

  const hasFilters = filterType || filterStatus || filterPriority || filterSla;

  return (
    <V4Card className="v4p-ops-panel v4p-ops-board">
      <V4SectionHeader
        eyebrow="Execução"
        title="Board operacional"
        description="Acompanhe o ciclo de vida de cada operação de campo."
        actions={<V4Badge variant="muted" size="sm">{formatCount(filtered.length)} operações</V4Badge>}
      />

      <div className="v4p-ops-filters" role="group" aria-label="Filtros operacionais">
        <select
          className="v4p-ops-filters__select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABEL).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </select>
        <select
          className="v4p-ops-filters__select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {BOARD_COLUMNS.map((col) => <option key={col.id} value={col.id}>{col.label}</option>)}
        </select>
        <select
          className="v4p-ops-filters__select"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          aria-label="Filtrar por prioridade"
        >
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORITY_LABEL).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </select>
        <select
          className="v4p-ops-filters__select"
          value={filterSla}
          onChange={(e) => setFilterSla(e.target.value)}
          aria-label="Filtrar por SLA"
        >
          <option value="">Todos os SLAs</option>
          {Object.entries(SLA_LABEL).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </select>
        {hasFilters && (
          <button
            type="button"
            className="v4p-ops-filters__clear"
            onClick={() => { setFilterType(''); setFilterStatus(''); setFilterPriority(''); setFilterSla(''); }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="v4p-ops-board__columns">
          {BOARD_COLUMNS.map((col) => (
            <div key={col.id} className="v4p-ops-board__col">
              <div className="v4p-ops-board__col-header">
                <span className="material-symbols-rounded" aria-hidden="true">{col.icon}</span>
                {col.label}
              </div>
              <V4Skeleton variant="card" />
              <V4Skeleton variant="card" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <V4EmptyState
          title="Nenhuma operação encontrada."
          description={hasFilters ? 'Ajuste os filtros para ver mais resultados.' : 'Crie uma operação usando os botões acima.'}
          compact
        />
      ) : (
        <div className="v4p-ops-board__columns">
          {BOARD_COLUMNS.map((col) => (
            <div key={col.id} className="v4p-ops-board__col">
              <div className="v4p-ops-board__col-header">
                <span className="material-symbols-rounded" aria-hidden="true">{col.icon}</span>
                {col.label}
                <V4Badge variant={STATUS_COLOR[col.id] ?? 'muted'} size="sm">{formatCount(byStatus[col.id]?.length ?? 0)}</V4Badge>
              </div>
              {byStatus[col.id]?.length === 0 ? (
                <div className="v4p-ops-board__empty">Nenhuma</div>
              ) : (
                byStatus[col.id].map((task) => (
                  <OperationCard
                    key={task.id}
                    task={task}
                    onStart={onStart}
                    onComplete={onComplete}
                    onCancel={onCancel}
                    actioning={actioning}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </V4Card>
  );
}

function RegionalTable({ regions, loading }) {
  const columns = useMemo(() => [
    { key: 'regiao', header: 'Região', render: (row) => (
      <div className="v4p-ops-table-primary">
        <strong>{row.label ?? row.sigla ?? 'Região'}</strong>
        <span>{row.responsavel ?? 'Responsável não informado'}</span>
      </div>
    )},
    { key: 'ocupacao',    header: 'Ocupação',   align: 'right', render: (row) => formatPercent(row.ocupacao) },
    { key: 'ativos',      header: 'Ativos',     align: 'right', render: (row) => formatCount(row.ativos) },
    { key: 'disponiveis', header: 'Livres',     align: 'right', render: (row) => formatCount(row.disponiveis) },
    { key: 'emManutencao',header: 'Manutenção', align: 'right', render: (row) => formatCount(row.emManutencao) },
    { key: 'alertas',     header: 'Alertas',    render: (row) => (
      <V4Badge variant={Number(row.alertas ?? 0) > 0 ? 'warning' : 'success'} size="sm">{formatCount(row.alertas)}</V4Badge>
    )},
    { key: 'receitaAtiva', header: 'Receita', align: 'right', className: 'is-revenue', render: (row) => formatCurrency(row.receitaAtiva) },
  ], []);

  return (
    <V4Card className="v4p-ops-panel">
      <V4SectionHeader eyebrow="Regiões" title="Execução por região" description="Ocupação, disponibilidade e alertas regionais." />
      <V4DataTable columns={columns} rows={regions} loading={loading} emptyMessage="Sem dados de desempenho regional disponíveis." />
    </V4Card>
  );
}

function FeedPanel({ feed, loading }) {
  const items = feed.slice(0, 8);
  return (
    <V4Card className="v4p-ops-panel">
      <V4SectionHeader
        eyebrow="Atividade"
        title="O que mudou"
        description="Movimentações operacionais recentes."
        actions={<V4Badge variant="info" size="sm">{formatCount(feed.length)} eventos</V4Badge>}
      />
      {loading ? <V4Skeleton variant="table" rows={5} /> : items.length === 0 ? (
        <V4EmptyState title="Nenhum evento operacional registrado." description="As movimentações recentes aparecem aqui quando houver atividade." compact />
      ) : (
        <div className="v4p-ops-feed">
          {items.map((item, index) => (
            <article key={item.id ?? index} className="v4p-ops-feed__item">
              <span className="material-symbols-rounded" aria-hidden="true">{item.icone ?? item.icon ?? 'timeline'}</span>
              <div>
                <strong>{item.label ?? item.title ?? 'Evento operacional'}</strong>
                <p>{item.regiao === 'Todos' ? 'Todas as regiões' : item.regiao ?? item.domainLabel ?? 'Origem não informada'} — {item.tempo ?? item.createdAt ?? 'agora'}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </V4Card>
  );
}

function OperationsAdvancedSection({ canRunBackfill, canonicalizationRefresh, onCanonicalizationRefresh }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="v4p-ops-advanced" data-testid="ops-advanced-section">
      <button
        type="button"
        className="v4p-ops-advanced__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="material-symbols-rounded" aria-hidden="true">settings</span>
        <span>Diagnóstico avançado</span>
        <span className="v4p-ops-advanced__toggle-sub">Ferramentas técnicas para manutenção administrativa</span>
        <span className="material-symbols-rounded v4p-ops-advanced__chevron" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <div className="v4p-ops-advanced__body">
          <p className="v4p-ops-advanced__notice">
            <span className="material-symbols-rounded" aria-hidden="true">info</span>
            Ferramentas técnicas para saúde dos vínculos operacionais. Use apenas para manutenção administrativa.
          </p>
          <OperationCanonicalizationCard
            canRunBackfill={canRunBackfill}
            refreshSignal={canonicalizationRefresh}
          />
          <OperationLinkResolutionQueue onReportRefresh={onCanonicalizationRefresh} />
        </div>
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

function OperationsPageInner() {
  const {
    operations, loading, refreshing, stale, status, error, source, refresh,
    createTask, startTask, completeTask, cancelTask,
  } = useOperations();
  const auth = useAuth();
  const [canonicalizationRefresh, setCanonicalizationRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('INSTALLATION');
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(null);

  const isLoading = loading && !operations.generatedAt;
  const canManageCanonicalization = auth?.hasPermission?.(PERMISSIONS.ADMIN_ACCESS) || auth?.permissions?.includes('superadmin');
  const canCreate = auth?.hasPermission?.('operations.create') ?? true;

  const handleCreateOp = useCallback((type) => {
    setModalType(type);
    setModalOpen(true);
  }, []);

  const handleSaveOp = useCallback(async (payload) => {
    setSaving(true);
    try {
      await createTask?.(payload);
      setModalOpen(false);
      refresh?.();
    } catch (err) {
      console.error('[OperationsPage] Erro ao criar operação:', err);
    } finally {
      setSaving(false);
    }
  }, [createTask, refresh]);

  const handleStart = useCallback(async (id) => {
    setActioning(id);
    try { await startTask?.(id); refresh?.(); }
    catch (err) { console.error('[OperationsPage] Erro ao iniciar operação:', err); }
    finally { setActioning(null); }
  }, [startTask, refresh]);

  const handleComplete = useCallback(async (id) => {
    setActioning(id);
    try { await completeTask?.(id); refresh?.(); }
    catch (err) { console.error('[OperationsPage] Erro ao concluir operação:', err); }
    finally { setActioning(null); }
  }, [completeTask, refresh]);

  const handleCancel = useCallback(async (id) => {
    if (!window.confirm('Confirmar cancelamento desta operação?')) return;
    setActioning(id);
    try { await cancelTask?.(id); refresh?.(); }
    catch (err) { console.error('[OperationsPage] Erro ao cancelar operação:', err); }
    finally { setActioning(null); }
  }, [cancelTask, refresh]);

  const allTasks = operations.tasks ?? [];

  return (
    <div className="v4p-ops-page">

      {/* ── 1. Header com ações rápidas */}
      <OperationsHeader
        operations={operations}
        loading={loading}
        refreshing={refreshing}
        stale={stale}
        status={status}
        source={source}
        onCreateOp={canCreate ? handleCreateOp : () => {}}
      />

      {/* ── 2. Aviso de estado (erro / offline / carregando) */}
      <OperationsStateNotice status={status} error={error} refresh={refresh} />

      {/* ── 3. KPIs operacionais — o que precisa de atenção agora */}
      <OperationsKpis
        overview={operations.overview ?? {}}
        health={operations.health ?? {}}
        sla={operations.sla ?? {}}
        tasks={allTasks}
        loading={isLoading}
      />

      {/* ── 4. Painel SLA — atraso, urgência, tempo médio */}
      <OperationsSlaPanel sla={operations.sla ?? operations.health?.sla ?? {}} loading={isLoading} />

      {/* ── 5. Board operacional — kanban com filtros e ações */}
      <OperationsBoard
        tasks={allTasks}
        loading={isLoading}
        onStart={handleStart}
        onComplete={handleComplete}
        onCancel={handleCancel}
        actioning={actioning}
      />

      {/* ── 6. Tabela regional */}
      <RegionalTable regions={operations.regionalOperations ?? []} loading={isLoading} />

      {/* ── 7. Feed de atividade */}
      <FeedPanel feed={operations.feed ?? []} loading={isLoading} />

      {/* ── 8. Diagnóstico avançado — visível apenas para admin */}
      {canManageCanonicalization && (
        <OperationsAdvancedSection
          canRunBackfill={canManageCanonicalization}
          canonicalizationRefresh={canonicalizationRefresh}
          onCanonicalizationRefresh={() => setCanonicalizationRefresh((v) => v + 1)}
        />
      )}

      {/* ── Modal de criação */}
      {canCreate && (
        <OperationFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveOp}
          saving={saving}
          initialType={modalType}
        />
      )}
    </div>
  );
}

function OperationsPage() {
  return (
    <OperationsProvider>
      <OperationsPageInner />
    </OperationsProvider>
  );
}

export default memo(OperationsPage);
