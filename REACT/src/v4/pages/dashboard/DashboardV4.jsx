import { useMemo, useState } from 'react';

import {
  ContentCard,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterGroup,
  FilterSelect,
  KPIGrid,
  KPICard,
  LoadingState,
  PageContainer,
  PageHeader,
  PageSection,
  PageShell,
  SearchInput,
  SectionCard,
  StatusBadge,
  ToolbarActions
} from '../../components';

import { dashboardV4MockData } from './dashboardMockData';
import './DashboardV4.css';

function mapHealthToBadge(status) {
  if (status === 'saudavel') return 'success';
  if (status === 'atencao') return 'warning';
  if (status === 'critico') return 'error';
  return 'default';
}

function mapPriorityToBadge(priority) {
  if (priority === 'alta') return 'error';
  if (priority === 'media') return 'warning';
  return 'info';
}

export default function DashboardV4({ demoState = 'default' }) {
  const [search, setSearch] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedRegion, setSelectedRegion] = useState('todas');

  const isLoading = demoState === 'loading';
  const isError = demoState === 'error';
  const isEmpty = demoState === 'empty';

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRegionPerformance = useMemo(() => {
    return dashboardV4MockData.regionPerformance.filter((item) => {
      const byRegion = selectedRegion === 'todas' || item.region.toLowerCase().includes(selectedRegion);
      const bySearch = !normalizedSearch || `${item.region} ${item.revenue} ${item.delta}`.toLowerCase().includes(normalizedSearch);
      return byRegion && bySearch;
    });
  }, [selectedRegion, normalizedSearch]);

  const filteredTopBoards = useMemo(() => {
    return dashboardV4MockData.topBoards.filter((item) => {
      const byRegion = selectedRegion === 'todas' || item.region === selectedRegion;
      const bySearch = !normalizedSearch || `${item.code} ${item.city} ${item.revenue}`.toLowerCase().includes(normalizedSearch);
      return byRegion && bySearch;
    });
  }, [selectedRegion, normalizedSearch]);

  const filteredIdleBoards = useMemo(() => {
    return dashboardV4MockData.idleBoards.filter((item) => {
      const byRegion = selectedRegion === 'todas' || item.region === selectedRegion;
      const bySearch = !normalizedSearch || `${item.code} ${item.action} ${item.potential}`.toLowerCase().includes(normalizedSearch);
      return byRegion && bySearch;
    });
  }, [selectedRegion, normalizedSearch]);

  const filteredActivity = useMemo(() => {
    return dashboardV4MockData.recentActivity.filter((item) => {
      return !normalizedSearch || `${item.actor} ${item.action} ${item.context}`.toLowerCase().includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  const hasAnyData =
    filteredRegionPerformance.length > 0 ||
    filteredTopBoards.length > 0 ||
    filteredIdleBoards.length > 0 ||
    filteredActivity.length > 0;

  const shouldShowData = !isLoading && !isError && !isEmpty && hasAnyData;

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="DASHBOARD PREVIEW V4" />}
      primary={(
        <button type="button" className="v4-dashboard-v4__button v4-dashboard-v4__button--primary">
          Atualizar simulacao
        </button>
      )}
      menu={(
        <button type="button" className="v4-dashboard-v4__button">
          Acoes rapidas
        </button>
      )}
    />
  );

  return (
    <PageShell className="v4-dashboard-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={dashboardV4MockData.header.title}
          subtitle={dashboardV4MockData.header.subtitle}
          description={dashboardV4MockData.header.description}
          actions={headerActions}
          metrics={<StatusBadge status="warning" label={`SYNC ${dashboardV4MockData.sync.status.toUpperCase()}`} />}
        />

        <PageSection title="Header operacional" subtitle="Controles de leitura visual para validacao da composicao final">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar regiao, placa, responsavel ou contexto"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Periodo ${selectedPeriod.toUpperCase()}`} />}
                primary={<button type="button" className="v4-dashboard-v4__button">Exportar snapshot</button>}
              />
            )}
          >
            <FilterGroup label="Periodo">
              <FilterSelect
                value={selectedPeriod}
                options={dashboardV4MockData.periodOptions}
                onChange={setSelectedPeriod}
                placeholder="Ultimos 30 dias"
              />
            </FilterGroup>

            <FilterGroup label="Regiao">
              <FilterSelect
                value={selectedRegion}
                options={dashboardV4MockData.regionOptions}
                onChange={setSelectedRegion}
                placeholder="Todas as regioes"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs principais" subtitle="Indicadores de performance, risco e saude operacional">
          <KPIGrid columns={6}>
            {dashboardV4MockData.kpis.map((kpi) => (
              <KPICard
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                change={kpi.change}
                trend={kpi.trend}
              />
            ))}
          </KPIGrid>
        </PageSection>

        {isLoading && (
          <PageSection title="Carregamento visual" subtitle="Simulacao de estado loading da dashboard">
            <LoadingState message="Carregando blocos da Dashboard v4 mockada..." />
          </PageSection>
        )}

        {isError && (
          <PageSection title="Fallback de erro" subtitle="Comportamento visual para falhas sem consultar servicos reais">
            <ErrorState
              title="Falha simulada na montagem da dashboard"
              description="A dashboard de preview permanece isolada. Retorne para demoState='default' para validar todos os blocos visuais."
            />
          </PageSection>
        )}

        {isEmpty && !isLoading && !isError && (
          <PageSection title="Estado vazio" subtitle="Comportamento visual quando nao houver dados disponiveis">
            <EmptyState
              title="Nenhum dado encontrado para o recorte atual"
              description="Ajuste o periodo, regiao ou termo de busca para visualizar os blocos mockados da dashboard." 
            />
          </PageSection>
        )}

        {shouldShowData && (
          <>
            <PageSection title="Cards de visao geral" subtitle="Resumo executivo rapido para leitura de diretoria e operacao">
              <div className="v4-dashboard-v4__overview-grid">
                {dashboardV4MockData.overviewCards.map((item) => (
                  <ContentCard key={item.id}>
                    <article className="v4-dashboard-v4__overview-card">
                      <p className="v4-dashboard-v4__overview-label">{item.label}</p>
                      <strong className="v4-dashboard-v4__overview-value">{item.value}</strong>
                      <p className="v4-dashboard-v4__overview-detail">{item.detail}</p>
                      <div className="v4-dashboard-v4__overview-foot">
                        <StatusBadge status={item.tone} label={item.trend} />
                      </div>
                    </article>
                  </ContentCard>
                ))}
              </div>
            </PageSection>

            <PageSection title="Alertas inteligentes" subtitle="Priorizacao de risco para operacao, comercial e plataforma">
              <SectionCard title="Fila de alertas ativos" subtitle="Ordenado por criticidade e prazo de resposta">
                <div className="v4-dashboard-v4__alert-list">
                  {dashboardV4MockData.alerts.map((alert) => (
                    <article key={alert.id} className="v4-dashboard-v4__alert-item">
                      <div className="v4-dashboard-v4__alert-main">
                        <strong>{alert.title}</strong>
                        <p>{alert.detail}</p>
                      </div>
                      <div className="v4-dashboard-v4__alert-meta">
                        <span>{alert.owner}</span>
                        <StatusBadge status={alert.level} label={alert.sla} />
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </PageSection>

            <PageSection title="Visao de desempenho" subtitle="Desempenho por regiao e funil comercial do ciclo atual">
              <div className="v4-dashboard-v4__split-grid">
                <SectionCard title="Desempenho por regiao" subtitle="Receita, ocupacao, latencia e saude de sincronizacao">
                  <div className="v4-dashboard-v4__region-list">
                    {filteredRegionPerformance.map((row) => (
                      <article key={row.id} className="v4-dashboard-v4__region-item">
                        <header>
                          <strong>{row.region}</strong>
                          <span>{row.revenue}</span>
                        </header>
                        <div className="v4-dashboard-v4__region-bar-track">
                          <span className="v4-dashboard-v4__region-bar-fill" style={{ width: `${row.occupancy}%` }} />
                        </div>
                        <footer>
                          <span>Ocupacao {row.occupancy}%</span>
                          <span>Latencia {row.latency}</span>
                          <StatusBadge status={mapHealthToBadge(row.syncHealth)} label={row.delta} />
                        </footer>
                      </article>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Funil comercial" subtitle="Conversao por etapa com volume e potencial financeiro">
                  <div className="v4-dashboard-v4__funnel-list">
                    {dashboardV4MockData.commercialFunnel.map((stage) => (
                      <article key={stage.id} className="v4-dashboard-v4__funnel-item">
                        <div className="v4-dashboard-v4__funnel-head">
                          <strong>{stage.stage}</strong>
                          <span>{stage.volume} itens</span>
                        </div>
                        <div className="v4-dashboard-v4__funnel-meter-track">
                          <span className="v4-dashboard-v4__funnel-meter-fill" style={{ width: `${stage.rate}%` }} />
                        </div>
                        <div className="v4-dashboard-v4__funnel-foot">
                          <span>{stage.value}</span>
                          <StatusBadge status="info" label={stage.delta} />
                        </div>
                      </article>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </PageSection>

            <PageSection title="Inventario em foco" subtitle="Placas mais alugadas e placas ociosas com acao recomendada">
              <div className="v4-dashboard-v4__split-grid">
                <SectionCard
                  title="Placas mais alugadas"
                  subtitle="Ranking de tracao comercial do periodo"
                  actions={<StatusBadge status="success" label={`${filteredTopBoards.length} itens`} />}
                >
                  <div className="v4-dashboard-v4__table-list">
                    {filteredTopBoards.map((item, index) => (
                      <article key={item.id} className="v4-dashboard-v4__table-row">
                        <span className="v4-dashboard-v4__table-rank">#{index + 1}</span>
                        <div className="v4-dashboard-v4__table-main">
                          <strong>{item.code}</strong>
                          <p>{item.city} | Receita {item.revenue}</p>
                        </div>
                        <div className="v4-dashboard-v4__table-meta">
                          <span>{item.rentals} locacoes</span>
                          <StatusBadge status={mapHealthToBadge(item.status)} label={item.occupancy} />
                        </div>
                      </article>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Placas ociosas"
                  subtitle="Backlog para realocacao e recuperacao de receita"
                  actions={<StatusBadge status="warning" label={`${filteredIdleBoards.length} itens`} />}
                >
                  <div className="v4-dashboard-v4__table-list">
                    {filteredIdleBoards.map((item) => (
                      <article key={item.id} className="v4-dashboard-v4__table-row">
                        <span className="v4-dashboard-v4__table-rank">{item.daysIdle}d</span>
                        <div className="v4-dashboard-v4__table-main">
                          <strong>{item.code}</strong>
                          <p>{item.action}</p>
                        </div>
                        <div className="v4-dashboard-v4__table-meta">
                          <span>{item.potential}</span>
                          <StatusBadge status={mapPriorityToBadge(item.priority)} label={item.priority} />
                        </div>
                      </article>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </PageSection>

            <PageSection title="Atividade recente" subtitle="Eventos simulados para trilha operacional da dashboard">
              <SectionCard title="Linha do tempo" subtitle="Eventos de operacao, comercial, financeiro e sincronizacao">
                <div className="v4-dashboard-v4__activity-list">
                  {filteredActivity.map((event) => (
                    <article key={event.id} className="v4-dashboard-v4__activity-item">
                      <span className="v4-dashboard-v4__activity-time">{event.occurredAt}</span>
                      <div className="v4-dashboard-v4__activity-main">
                        <strong>{event.action}</strong>
                        <p>{event.actor} | {event.context}</p>
                      </div>
                      <div className="v4-dashboard-v4__activity-meta">
                        <span>{event.channel}</span>
                        <StatusBadge status={event.status} label="confirmado" />
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </PageSection>

            <PageSection title="Estado de sincronizacao visual" subtitle="Bloco visual de observabilidade para futura conexao com syncService">
              <SectionCard title="Saude de sincronizacao" subtitle="Indicadores de fila, latencia, reconexao e fontes de evento">
                <div className="v4-dashboard-v4__sync-grid">
                  <ContentCard>
                    <span className="v4-dashboard-v4__sync-label">Modo</span>
                    <strong>{dashboardV4MockData.sync.mode}</strong>
                  </ContentCard>

                  <ContentCard>
                    <span className="v4-dashboard-v4__sync-label">Ultimo evento</span>
                    <strong>{dashboardV4MockData.sync.lastEvent}</strong>
                    <small>{dashboardV4MockData.sync.lastEventAt}</small>
                  </ContentCard>

                  <ContentCard>
                    <span className="v4-dashboard-v4__sync-label">Fila de replay</span>
                    <strong>{dashboardV4MockData.sync.replayQueue} itens</strong>
                    <small>Lag medio {dashboardV4MockData.sync.eventLag}</small>
                  </ContentCard>

                  <ContentCard>
                    <span className="v4-dashboard-v4__sync-label">Reconexao</span>
                    <strong>{dashboardV4MockData.sync.reconnectAttempts} tentativas</strong>
                    <small>Uptime {dashboardV4MockData.sync.uptime}</small>
                  </ContentCard>

                  <ContentCard>
                    <span className="v4-dashboard-v4__sync-label">Workers ativos</span>
                    <strong>{dashboardV4MockData.sync.workers}</strong>
                    <small>Incidente {dashboardV4MockData.sync.incidentLevel}</small>
                  </ContentCard>

                  <ContentCard>
                    <span className="v4-dashboard-v4__sync-label">Estado geral</span>
                    <StatusBadge status="warning" label={dashboardV4MockData.sync.status} />
                  </ContentCard>
                </div>

                <div className="v4-dashboard-v4__source-list">
                  {dashboardV4MockData.sync.sources.map((source) => (
                    <article key={source.id} className="v4-dashboard-v4__source-item">
                      <div>
                        <strong>{source.name}</strong>
                        <p>{source.throughput}</p>
                      </div>
                      <StatusBadge status={mapHealthToBadge(source.status)} label={source.status} />
                    </article>
                  ))}
                </div>
              </SectionCard>
            </PageSection>
          </>
        )}

      </PageContainer>
    </PageShell>
  );
}
