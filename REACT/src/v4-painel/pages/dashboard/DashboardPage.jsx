import { memo, useMemo } from 'react';

import { useAuth } from '../../../context/AuthContext.jsx';
import { StatusBadge } from '../../design-system/badges/index.js';
import DataSourceBadge from '../../design-system/states/DataSourceBadge.jsx';
import { V4OperationalMap } from '../../components/map/index.js';
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
import DashboardProvider, { useDashboard } from '../../providers/DashboardProvider.jsx';
import { useRealtime } from '../../providers/RealtimeProvider.jsx';
import { ROLE_RANK } from '../../foundation/navigation.js';
import './DashboardPage.css';

const ROLE_LAYER = {
  OPERATOR: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

const BOARD_STATUS = {
  occupied: { label: 'Ocupada', tone: 'success' },
  available: { label: 'Disponivel', tone: 'info' },
  maintenance: { label: 'Em manutencao', tone: 'warning' },
  reserved: { label: 'Reservada', tone: 'info' },
  critical: { label: 'Critica', tone: 'danger' },
};

const ACTION_TONE = {
  danger: { state: 'critical', icon: 'crisis_alert', label: 'Critica' },
  warning: { state: 'warning', icon: 'warning', label: 'Atencao' },
  info: { state: 'pending', icon: 'campaign', label: 'Revisar' },
  success: { state: 'healthy', icon: 'check_circle', label: 'Em ordem' },
};

const STATUS_TO_BADGE = {
  healthy: 'success',
  success: 'success',
  warning: 'warning',
  degraded: 'warning',
  pending: 'info',
  info: 'info',
  critical: 'danger',
  danger: 'danger',
  offline: 'danger',
};

function roleLayer(role) {
  const rank = ROLE_RANK[role] ?? ROLE_RANK[String(role ?? '').toLowerCase()] ?? 1;
  if (rank >= 3) return ROLE_LAYER.SUPERADMIN;
  if (rank >= 2) return ROLE_LAYER.ADMIN;
  return ROLE_LAYER.OPERATOR;
}

function toMapPoints(boards) {
  return (boards ?? []).map((board) => ({
    id: board.id ?? board.codigo,
    title: board.codigo ?? board.nome,
    subtitle: board.nome,
    latitude: board.lat ?? null,
    longitude: board.lng ?? null,
    status: board.status ?? 'available',
    region: board.regiao ?? board.regiaoId,
    address: board.localizacao,
    mainImageUrl: board.mainImageUrl ?? board.imagemPrincipal ?? board.imageUrl ?? null,
    images: board.images ?? board.imagens ?? [],
    imageStatus: board.imageStatus ?? (board.mainImageUrl || board.imagemPrincipal || board.imageUrl ? 'AVAILABLE' : 'MISSING'),
    metadata: null,
  }));
}

function formatPercent(value) {
  return `${(asRate(value) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function asRate(value) {
  const number = Number(value) || 0;
  return number > 1 ? number / 100 : number;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function mapSourceToBadge(source, status) {
  if (status === 'offline' || source === 'offline') return 'offline';
  if (status === 'stale' || status === 'refreshing' || source === 'stale') return 'stale';
  if (source === 'demo' || source === 'mock') return 'demo';
  if (source === 'empty') return 'cached';
  return 'synced';
}

function badgeVariant(state) {
  return STATUS_TO_BADGE[state] ?? 'muted';
}

function shouldShowSourceBadge(source, status, stale) {
  return stale || ['stale', 'offline', 'error', 'empty', 'demo', 'mock'].includes(source) || ['stale', 'offline'].includes(status);
}

function normalizeKpis(dashboard, layer) {
  const kpis = dashboard.kpis ?? {};
  const hero = dashboard.hero ?? {};
  const operations = dashboard.operations ?? {};
  const contracts = dashboard.contracts ?? {};
  const alerts = dashboard.alerts ?? {};
  const commercial = dashboard.commercial ?? {};
  const occupancyRate = asRate(kpis.occupancyRate ?? hero.occupancyRate);

  const items = [
    {
      id: 'critical-alerts',
      layer: ROLE_LAYER.OPERATOR,
      title: 'Alertas criticos',
      value: formatCount(alerts.critical ?? kpis.criticalAlerts),
      context: 'Exigem acao operacional',
      state: Number(alerts.critical ?? kpis.criticalAlerts ?? 0) > 0 ? 'critical' : 'healthy',
      trend: Number(alerts.warning ?? 0) > 0 ? `${formatCount(alerts.warning)} em atencao` : 'Sem pendencias',
      source: 'dashboard.alertsSummary',
    },
    {
      id: 'occupancy',
      layer: ROLE_LAYER.OPERATOR,
      title: 'Ocupacao das placas',
      value: formatPercent(occupancyRate),
      context: `${formatCount(kpis.occupiedBoards ?? hero.occupiedBoards)} ocupadas de ${formatCount(kpis.totalBoards ?? hero.totalBoards)}`,
      state: occupancyRate >= 0.75 ? 'healthy' : 'warning',
      trend: 'Meta operacional 75%',
      source: 'dashboard.kpis',
    },
    {
      id: 'available',
      layer: ROLE_LAYER.OPERATOR,
      title: 'Placas disponiveis',
      value: formatCount(kpis.availableBoards ?? Math.max((kpis.totalBoards ?? hero.totalBoards ?? 0) - (kpis.occupiedBoards ?? hero.occupiedBoards ?? 0), 0)),
      context: 'Sem contrato ativo',
      state: 'warning',
      trend: 'Priorizar carteira comercial',
      source: 'dashboard.kpis',
    },
    {
      id: 'operations-score',
      layer: ROLE_LAYER.OPERATOR,
      title: 'Disponibilidade operacional',
      value: operations.score != null ? `${formatCount(operations.score)}%` : 'Sem leitura',
      context: `${formatCount(operations.maintenanceBoards)} placas em manutencao`,
      state: Number(operations.score ?? 100) >= 85 ? 'healthy' : 'warning',
      trend: operations.dataQualityIssues > 0 ? `${formatCount(operations.dataQualityIssues)} cadastros pendentes` : 'Operacao estavel',
      source: 'dashboard.performance',
    },
    {
      id: 'revenue',
      layer: ROLE_LAYER.ADMIN,
      title: 'Receita ativa',
      value: hero.revenueLabel ?? 'R$ 0',
      context: 'Contratos ativos no mes',
      state: dashboard.executive?.revenueHealth ?? 'healthy',
      trend: Number(kpis.revenueAtRisk ?? 0) > 0 ? `Risco: R$ ${formatCount(kpis.revenueAtRisk)}` : 'Sem risco imediato',
      source: 'dashboard.kpis',
    },
    {
      id: 'contracts',
      layer: ROLE_LAYER.ADMIN,
      title: 'Contratos a renovar',
      value: formatCount(contracts.expiring30Days ?? kpis.contractsExpiring ?? hero.expiringContracts),
      context: 'Vencem nos proximos 30 dias',
      state: Number(contracts.expiring7Days ?? 0) > 0 ? 'critical' : 'warning',
      trend: Number(contracts.expiring7Days ?? 0) > 0 ? `${formatCount(contracts.expiring7Days)} em 7 dias` : 'Sem urgencia hoje',
      source: 'dashboard.kpis',
    },
    {
      id: 'commercial',
      layer: ROLE_LAYER.ADMIN,
      title: 'Oportunidade comercial',
      value: commercial.availableInventoryPotential ? `R$ ${formatCount(commercial.availableInventoryPotential)}` : formatCount(kpis.availableBoards ?? 0),
      context: commercial.availableInventoryPotential ? 'Potencial em placas livres' : 'Placas para ofertar',
      state: 'pending',
      trend: commercial.lowOccupancyRegions > 0 ? `${formatCount(commercial.lowOccupancyRegions)} regioes abaixo da meta` : 'Carteira sem queda regional',
      source: 'dashboard.performance',
    },
    {
      id: 'integrity',
      layer: ROLE_LAYER.SUPERADMIN,
      title: 'Integridade resumida',
      value: dashboard.metadata?.partial ? 'Parcial' : 'Completa',
      context: dashboard.metadata?.partial ? 'Uma origem nao atualizou' : 'Origens principais respondendo',
      state: dashboard.metadata?.partial ? 'warning' : 'healthy',
      trend: dashboard.generatedAt ? 'Atualizacao recebida' : 'Sem horario informado',
      source: 'dashboard.overview',
    },
  ];

  return items.filter((item) => item.layer <= layer);
}

function DashboardStateNotice({ status, error, refresh }) {
  if (status === 'success' || status === 'refreshing' || status === 'stale') return null;

  const copy = {
    loading: {
      title: 'Atualizando dados da dashboard.',
      message: 'Buscando informacoes operacionais mais recentes.',
      icon: 'hourglass_empty',
    },
    unauthorized: {
      title: 'Sua sessao precisa ser renovada.',
      message: 'Entre novamente para visualizar a dashboard.',
      icon: 'lock',
    },
    forbidden: {
      title: 'Voce nao tem acesso a esta area.',
      message: 'Contate o administrador para solicitar acesso.',
      icon: 'block',
    },
    offline: {
      title: 'Nao foi possivel atualizar os dados agora.',
      message: 'Tente novamente em instantes.',
      icon: 'cloud_off',
    },
    error: {
      title: 'Nao foi possivel atualizar os dados agora.',
      message: error || 'Tente novamente em instantes.',
      icon: 'error_outline',
    },
  }[status] ?? {
    title: 'Nenhuma informacao encontrada.',
    message: 'Tente novamente em instantes.',
    icon: 'info',
  };

  return (
    <V4Card className={`v4p-dashboard-state v4p-dashboard-state--${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <span className="material-symbols-rounded" aria-hidden="true">{copy.icon}</span>
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.message}</p>
      </div>
      {status !== 'loading' && (
        <V4Button type="button" variant="secondary" size="sm" onClick={refresh}>Atualizar</V4Button>
      )}
    </V4Card>
  );
}

function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="v4p-dashboard-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <V4Skeleton key={index} variant="text" />
      ))}
    </div>
  );
}

function EmptyInline({ title = 'Nenhuma informacao encontrada.', message = 'Tente novamente em instantes.' }) {
  return (
    <V4EmptyState
      className="v4p-dashboard-empty"
      title={title}
      description={message}
      compact
    />
  );
}

function SectionHeader({ eyebrow, title, description, aside }) {
  return (
    <V4SectionHeader
      className="v4p-dashboard-section-header"
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={aside}
    />
  );
}

function OperationalSummary({ dashboard, source, status, stale, loading, refreshing }) {
  const health = dashboard.executive?.operationalHealth ?? dashboard.state ?? 'warning';
  const alertsCount = Number(dashboard.alerts?.critical ?? dashboard.kpis?.criticalAlerts ?? 0);
  const sourceBadge = shouldShowSourceBadge(source, status, stale);

  return (
    <V4Card className={`v4p-dashboard-health v4p-dashboard-health--${health}`}>
      <div className="v4p-dashboard-health__copy">
        <span>Saude operacional</span>
        <h1>{alertsCount > 0 ? `${alertsCount} ponto${alertsCount === 1 ? '' : 's'} exigem atencao` : 'Operacao sem urgencia critica'}</h1>
        <p>
          {alertsCount > 0
            ? 'Priorize os alertas criticos antes de revisar indicadores comerciais.'
            : 'Continue acompanhando ocupacao, disponibilidade e contratos em renovacao.'}
        </p>
      </div>
      <div className="v4p-dashboard-health__meta">
        <StatusBadge state={health} label={health === 'healthy' ? 'Operacional' : health === 'critical' ? 'Critico' : 'Atencao'} size="lg" />
        {sourceBadge && (
          <DataSourceBadge
            source={mapSourceToBadge(source, status)}
            label={source === 'empty' ? 'Nenhum dado encontrado' : undefined}
            compact={false}
          />
        )}
        {(loading || refreshing) && <span className="v4p-dashboard-refreshing">Atualizando dados...</span>}
      </div>
    </V4Card>
  );
}

function KpiCard({ item, loading, showSource }) {
  if (loading) {
    return <V4Skeleton variant="card" className="v4p-dashboard-kpi-skeleton" />;
  }

  return (
    <div className="v4p-dashboard-kpi-wrap">
      <V4StatCard
        className={`v4p-dashboard-kpi v4p-dashboard-kpi--${item.state}`}
        title={item.title}
        value={item.value}
        description={item.context}
        trend={item.trend}
        status={item.state}
        icon={<span className="material-symbols-rounded" aria-hidden="true">monitoring</span>}
      />
      {showSource && (
        <div className="v4p-dashboard-kpi-wrap__source">
          <DataSourceBadge source="stale" label="Dados desatualizados" compact />
        </div>
      )}
    </div>
  );
}

function KpiGrid({ kpis, loading, stale }) {
  if (!loading && kpis.length === 0) {
    return <EmptyInline title="Nenhum indicador encontrado." message="Os indicadores aparecem aqui quando houver dados operacionais." />;
  }

  return (
    <section className="v4p-dashboard-kpis" aria-label="Indicadores operacionais">
      {(loading ? Array.from({ length: 4 }).map((_, index) => ({
        id: `loading-${index}`,
        title: 'Indicador',
        state: 'pending',
        value: '',
        context: '',
      })) : kpis).map((item) => (
        <KpiCard key={item.id} item={item} loading={loading} showSource={stale} />
      ))}
    </section>
  );
}

function AlertsPanel({ actions = [], alerts, loading }) {
  const normalized = actions.map((item, index) => {
    const tone = ACTION_TONE[item.tone] ?? ACTION_TONE.info;
    return {
      id: item.id ?? `${item.label}-${index}`,
      title: item.label,
      detail: item.detail,
      value: item.value,
      ...tone,
    };
  });

  if (!loading && normalized.length === 0 && Number(alerts?.critical ?? 0) === 0) {
    return (
      <V4Card className="v4p-dashboard-panel">
        <SectionHeader eyebrow="Nivel 1" title="Atencao agora" description="Sem alertas no momento." />
        <EmptyInline title="Sem alertas no momento." message="A operacao nao tem itens criticos para tratar agora." />
      </V4Card>
    );
  }

  return (
    <V4Card className="v4p-dashboard-panel v4p-dashboard-panel--priority" variant="warning">
      <SectionHeader eyebrow="Nivel 1" title="Atencao agora" description="Prioridades acionaveis da operacao." />
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="v4p-dashboard-alert-list">
          {normalized.map((item) => (
            <V4Card key={item.id} className={`v4p-dashboard-alert v4p-dashboard-alert--${item.state}`} variant={badgeVariant(item.state) === 'danger' ? 'danger' : badgeVariant(item.state)}>
              <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
              <div>
                <div className="v4p-dashboard-alert__title">
                  <strong>{item.title}</strong>
                  <V4Badge variant={badgeVariant(item.state)} size="sm">{item.label}</V4Badge>
                </div>
                <p>{item.detail || 'Verifique os detalhes da operacao.'}</p>
                <small>Acao recomendada: revisar responsavel e prazo.</small>
              </div>
              <b>{item.value}</b>
            </V4Card>
          ))}
        </div>
      )}
    </V4Card>
  );
}

function OperationMix({ mix = [], loading }) {
  const total = mix.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <V4Card className="v4p-dashboard-panel">
      <SectionHeader eyebrow="Nivel 2" title="Operacao" description="Distribuicao atual das placas." aside={<span>{formatCount(total)} pontos</span>} />
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : mix.length === 0 ? (
        <EmptyInline title="Nenhuma placa encontrada." message="A distribuicao aparece quando houver placas cadastradas." />
      ) : (
        <div className="v4p-dashboard-mix">
          <div className="v4p-dashboard-mix__bar">
            {mix.map((item) => (
              <span key={item.label} className="v4p-dashboard-mix__segment" style={{ '--segment-size': `${total > 0 ? (Number(item.value) / total) * 100 : 0}%`, '--segment-color': item.color }} />
            ))}
          </div>
          {mix.map((item) => (
            <div key={item.label} className="v4p-dashboard-mix__row">
              <span style={{ '--segment-color': item.color }} />
              <p>{item.label}</p>
              <strong>{formatCount(item.value)}</strong>
            </div>
          ))}
        </div>
      )}
    </V4Card>
  );
}

function CommercialPanel({ dashboard, loading }) {
  const revenue = dashboard.hero?.revenueLabel ?? 'R$ 0';
  const contracts = dashboard.contracts ?? {};
  const commercial = dashboard.commercial ?? {};

  return (
    <V4Card className="v4p-dashboard-panel">
      <SectionHeader eyebrow="Nivel 3" title="Comercial e gestao" description="Receita, contratos e oportunidades." />
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="v4p-dashboard-commercial">
          <article>
            <span>Receita ativa</span>
            <strong>{revenue}</strong>
            <p>{Number(contracts.atRiskRevenue ?? 0) > 0 ? `R$ ${formatCount(contracts.atRiskRevenue)} em risco` : 'Sem risco financeiro imediato'}</p>
          </article>
          <article>
            <span>Renovacoes</span>
            <strong>{formatCount(contracts.expiring30Days ?? dashboard.kpis?.contractsExpiring)}</strong>
            <p>{Number(contracts.expiring7Days ?? 0) > 0 ? `${formatCount(contracts.expiring7Days)} vencem em ate 7 dias` : 'Sem vencimento critico hoje'}</p>
          </article>
          <article>
            <span>Oportunidades</span>
            <strong>{commercial.availableInventoryPotential ? `R$ ${formatCount(commercial.availableInventoryPotential)}` : formatCount(dashboard.kpis?.availableBoards)}</strong>
            <p>{Number(commercial.lowOccupancyRegions ?? 0) > 0 ? 'Ha regioes abaixo da meta' : 'Sem queda regional relevante'}</p>
          </article>
        </div>
      )}
    </V4Card>
  );
}

function FeaturedBoardsTable({ boards = [], loading }) {
  const columns = useMemo(() => [
    {
      key: 'codigo',
      header: 'Codigo',
      render: (board) => <span className="v4p-mono">{board.codigo ?? '-'}</span>,
    },
    {
      key: 'localizacao',
      header: 'Localizacao',
      render: (board) => (
        <div className="v4p-dashboard-table__primary">
          <strong>{board.nome ?? 'Placa sem nome'}</strong>
          <span>{board.localizacao ?? 'Localizacao nao informada'}</span>
        </div>
      ),
    },
    {
      key: 'regiao',
      header: 'Regiao',
      render: (board) => board.siglaRegiao ?? board.regiao ?? '-',
    },
    {
      key: 'status',
      header: 'Situacao',
      render: (board) => {
        const status = BOARD_STATUS[board.status] ?? { label: board.status ?? 'Nao informado', tone: 'muted' };
        return <V4Badge variant={status.tone} size="sm">{status.label}</V4Badge>;
      },
    },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (board) => board.cliente ?? 'Carteira aberta',
    },
    {
      key: 'campanha',
      header: 'Campanha',
      render: (board) => board.campanha ?? 'Sem campanha',
    },
    {
      key: 'vencimento',
      header: 'Vencimento',
      render: (board) => board.vencimento ?? 'Nao informado',
    },
    {
      key: 'receita',
      header: 'Receita',
      align: 'right',
      className: 'is-revenue',
      render: (board) => board.receitaFormatada ?? 'R$ 0',
    },
  ], []);

  return (
    <V4Card className="v4p-dashboard-table-card">
      <SectionHeader eyebrow="Nivel 2" title="Placas em acompanhamento" description="Itens com impacto operacional ou comercial." aside={<span>{formatCount(boards.length)} itens</span>} />
      <V4DataTable
        className="v4p-dashboard-data-table"
        columns={columns}
        rows={boards}
        loading={loading}
        emptyMessage="Nenhuma placa encontrada."
      />
    </V4Card>
  );
}

function ActivityList({ activity = [], loading }) {
  const visible = activity.slice(0, 6);

  return (
    <V4Card className="v4p-dashboard-panel">
      <SectionHeader eyebrow="Nivel 4" title="O que mudou" description="Eventos operacionais recentes." />
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <EmptyInline title="Nenhuma atividade encontrada." message="As mudancas recentes aparecem aqui quando forem registradas." />
      ) : (
        <div className="v4p-dashboard-activity">
          {visible.map((item) => (
            <article key={item.id}>
              <span className={`v4p-dashboard-activity__dot v4p-dashboard-activity__dot--${item.categoria ?? 'info'}`} />
              <div>
                <strong>{item.label}</strong>
                <p>{item.regiao ?? 'Origem nao informada'} · {item.tempo ?? 'agora'}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </V4Card>
  );
}

function SystemSummary({ dashboard, connected, reconnecting }) {
  return (
    <V4Card className="v4p-dashboard-panel v4p-dashboard-panel--system">
      <SectionHeader eyebrow="Nivel 3" title="Sinais sistemicos" description="Resumo para suporte sem diagnostico cru." />
      <div className="v4p-dashboard-system">
        <article>
          <span>Atualizacao em tempo real</span>
          <StatusBadge state={connected ? 'healthy' : reconnecting ? 'warning' : 'offline'} label={connected ? 'Ativa' : reconnecting ? 'Reconectando' : 'Indisponivel'} size="sm" />
        </article>
        <article>
          <span>Consistencia das origens</span>
          <StatusBadge state={dashboard.metadata?.partial ? 'warning' : 'healthy'} label={dashboard.metadata?.partial ? 'Parcial' : 'Completa'} size="sm" />
        </article>
      </div>
    </V4Card>
  );
}

function DashboardPageInner() {
  const auth = useAuth();
  const { dashboard, loading, refreshing, stale, status, error, source, refresh } = useDashboard();
  const { connected, reconnecting } = useRealtime();
  const layer = roleLayer(auth.role ?? auth.user?.role);
  const kpis = useMemo(() => normalizeKpis(dashboard, layer), [dashboard, layer]);
  const mapPoints = useMemo(() => toMapPoints(dashboard.featuredBoards), [dashboard.featuredBoards]);
  const isLoading = loading && !dashboard.generatedAt;

  return (
    <div className="v4p-dashboard-page">
      <OperationalSummary
        dashboard={dashboard}
        source={source}
        status={status}
        stale={stale}
        loading={loading}
        refreshing={refreshing}
      />

      <DashboardStateNotice status={status} error={error} refresh={refresh} />

      <AlertsPanel actions={dashboard.priorityActions} alerts={dashboard.alerts} loading={isLoading} />

      <KpiGrid kpis={kpis} loading={isLoading} stale={stale} />

      <section className="v4p-dashboard-main-grid">
        <V4Card className="v4p-dashboard-map-stage">
          <SectionHeader
            eyebrow="Nivel 2"
            title="Mapa operacional"
            description="Ocupacao, alertas e disponibilidade por regiao."
            aside={<StatusBadge state={dashboard.executive?.operationalHealth ?? 'healthy'} size="sm" />}
          />
          <V4OperationalMap
            points={mapPoints}
            loading={isLoading}
            compact
          />
        </V4Card>
        <div className="v4p-dashboard-side-stack">
          <OperationMix mix={dashboard.operationMix} loading={isLoading} />
          {layer >= ROLE_LAYER.ADMIN && <CommercialPanel dashboard={dashboard} loading={isLoading} />}
          {layer >= ROLE_LAYER.SUPERADMIN && <SystemSummary dashboard={dashboard} connected={connected} reconnecting={reconnecting} />}
        </div>
      </section>

      <section className="v4p-dashboard-bottom-grid">
        <FeaturedBoardsTable boards={dashboard.featuredBoards} loading={isLoading} />
        <ActivityList activity={dashboard.activityTimeline ?? dashboard.timeline} loading={isLoading} />
      </section>
    </div>
  );
}

function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardPageInner />
    </DashboardProvider>
  );
}

export default memo(DashboardPage);
