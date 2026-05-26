import { useMemo, useState } from 'react';

import {
  ContentCard,
  DataTable,
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

import {
  reportsBoardRankingV4,
  reportsCityOptionsV4,
  reportsCommercialSummaryV4,
  reportsExecutiveRowsV4,
  reportsGroupingOptionsV4,
  reportsHeaderV4,
  reportsKpisV4,
  reportsMonthlyComparisonV4,
  reportsOperationalFunnelV4,
  reportsPeriodOptionsV4,
  reportsRegionOptionsV4,
  reportsRegionalRankingV4,
  reportsSeriesV4,
  reportsStateOptionsV4,
  reportsStatusOptionsV4
} from './reportsMockData';

import './ReportsV4.css';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function statusToBadge(status) {
  if (status === 'saudavel') return 'success';
  if (status === 'atencao') return 'warning';
  if (status === 'critico') return 'error';
  return 'default';
}

export default function ReportsV4({ demoState = null }) {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('default');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedRegion, setSelectedRegion] = useState('todas');
  const [selectedCity, setSelectedCity] = useState('todas');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [selectedGrouping, setSelectedGrouping] = useState('regiao');

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const filteredRegionalRanking = useMemo(() => {
    return reportsRegionalRankingV4.filter((item) => {
      const byStatus = selectedStatus === 'todos' || item.status === selectedStatus;
      const byRegion = selectedRegion === 'todas' || normalizeText(item.name).includes(normalizeText(selectedRegion));
      const bySearch = !search || normalizeText(`${item.name} ${item.revenue} ${item.growth}`).includes(normalizeText(search));
      return byStatus && byRegion && bySearch;
    });
  }, [search, selectedStatus, selectedRegion]);

  const filteredBoardRanking = useMemo(() => {
    return reportsBoardRankingV4.filter((item) => {
      const byStatus = selectedStatus === 'todos' || item.status === selectedStatus;
      const byCity = selectedCity === 'todas' || item.city.toLowerCase().replace(/\s+/g, '-') === selectedCity;
      const bySearch = !search || normalizeText(`${item.code} ${item.location} ${item.city} ${item.revenue}`).includes(normalizeText(search));
      return byStatus && byCity && bySearch;
    });
  }, [search, selectedStatus, selectedCity]);

  const visibleRegionalRanking = forceEmpty ? [] : filteredRegionalRanking;
  const visibleBoardRanking = forceEmpty ? [] : filteredBoardRanking;

  const maxRevenue = useMemo(() => {
    return Math.max(...reportsSeriesV4.map((item) => item.faturamento), 1);
  }, []);

  const panelActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="ANALYTICS VISUAL" />}
      primary={<StatusBadge status="warning" label="SOMENTE MOCK" />}
    />
  );

  return (
    <PageShell className="v4-reports-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={reportsHeaderV4.title}
          subtitle={reportsHeaderV4.subtitle}
          description={reportsHeaderV4.description}
          actions={panelActions}
          metrics={<StatusBadge status="success" label={`Periodo ${selectedPeriod.toUpperCase()}`} />}
        />

        <PageSection title="Filtros executivos" subtitle="Segmentação visual para leitura comparativa e performance operacional">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar metrica, segmento, regiao, placa ou cidade"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Ranking regioes ${visibleRegionalRanking.length}`} />}
                primary={<button type="button" className="v4-reports-v4__button" disabled>Exportar snapshot</button>}
              />
            )}
          >
            <FilterGroup label="Estado da tela">
              <FilterSelect
                value={visualState}
                options={reportsStateOptionsV4}
                onChange={(value) => {
                  if (!hasGlobalState) {
                    setSelectedState(value);
                  }
                }}
                placeholder="Exibição padrão"
                disabled={hasGlobalState}
              />
            </FilterGroup>

            <FilterGroup label="Periodo">
              <FilterSelect
                value={selectedPeriod}
                options={reportsPeriodOptionsV4}
                onChange={setSelectedPeriod}
                placeholder="Últimos 30 dias"
              />
            </FilterGroup>

            <FilterGroup label="Regiao">
              <FilterSelect
                value={selectedRegion}
                options={reportsRegionOptionsV4}
                onChange={setSelectedRegion}
                placeholder="Todas as regiões"
              />
            </FilterGroup>

            <FilterGroup label="Cidade">
              <FilterSelect
                value={selectedCity}
                options={reportsCityOptionsV4}
                onChange={setSelectedCity}
                placeholder="Todas as cidades"
              />
            </FilterGroup>

            <FilterGroup label="Status">
              <FilterSelect
                value={selectedStatus}
                options={reportsStatusOptionsV4}
                onChange={setSelectedStatus}
                placeholder="Todos os status"
              />
            </FilterGroup>

            <FilterGroup label="Agrupamento">
              <FilterSelect
                value={selectedGrouping}
                options={reportsGroupingOptionsV4}
                onChange={setSelectedGrouping}
                placeholder="Agrupar por regiao"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs principais" subtitle="Indicadores executivos para monitorar receita, oferta e saude do inventario">
          <KPIGrid columns={6}>
            {reportsKpisV4.map((kpi) => (
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

        <PageSection title="Blocos analiticos visuais" subtitle="Serie temporal, comparativos e rankings para tomada de decisao">
          <SectionCard
            title="Painel analitico consolidado"
            subtitle="Simulação visual premium sem libs de gráfico"
            actions={<StatusBadge status="info" label={`Agrupamento ${selectedGrouping}`} />}
          >
            {isLoading && (
              <div className="v4-reports-v4__state-banner">
                <LoadingState message="Carregando blocos analiticos simulados..." />
              </div>
            )}

            {isError && (
              <div className="v4-reports-v4__state-banner">
                <ErrorState
                  title="Falha simulada no cockpit analitico"
                  description="Retorne para demoState='default' para validar os blocos de relatorios mockados."
                />
              </div>
            )}

            {!isLoading && !isError && forceEmpty && (
              <div className="v4-reports-v4__state-banner">
                <EmptyState
                  title="Sem dados para o recorte selecionado"
                  description="Ajuste filtros ou retorne para exibição padrão para visualizar os indicadores mockados."
                />
              </div>
            )}

            {!isLoading && !isError && !forceEmpty && (
              <div className="v4-reports-v4__analytics-grid">
                <ContentCard>
                  <div className="v4-reports-v4__card-head">
                    <h3>Serie temporal</h3>
                    <StatusBadge status="success" label="receita" />
                  </div>
                  <div className="v4-reports-v4__chart-bars" role="img" aria-label="Serie temporal mockada de receita">
                    {reportsSeriesV4.map((point) => {
                      const height = Math.max(12, Math.round((point.faturamento / maxRevenue) * 100));
                      return (
                        <div key={point.month} className="v4-reports-v4__bar-wrap">
                          <div className="v4-reports-v4__bar" style={{ height: `${height}%` }} />
                          <span>{point.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-reports-v4__card-head">
                    <h3>Comparação mensal</h3>
                    <StatusBadge status="info" label="delta" />
                  </div>
                  <div className="v4-reports-v4__comparison-list">
                    {reportsMonthlyComparisonV4.map((item) => (
                      <div key={item.metric} className="v4-reports-v4__comparison-item">
                        <div>
                          <strong>{item.metric}</strong>
                          <p>{item.previous} | atual {item.current}</p>
                        </div>
                        <span className="v4-reports-v4__trend-pill">{item.delta}</span>
                      </div>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-reports-v4__card-head">
                    <h3>Ranking regional</h3>
                    <StatusBadge status="warning" label="top 5" />
                  </div>
                  <div className="v4-reports-v4__ranking-list">
                    {visibleRegionalRanking.map((item, index) => (
                      <div key={item.id} className="v4-reports-v4__ranking-item">
                        <span className="v4-reports-v4__ranking-index">#{index + 1}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.revenue} | Ocupação {item.occupancy}</p>
                        </div>
                        <StatusBadge status={statusToBadge(item.status)} label={item.growth} />
                      </div>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-reports-v4__card-head">
                    <h3>Ranking de placas</h3>
                    <StatusBadge status="default" label={`itens ${visibleBoardRanking.length}`} />
                  </div>
                  <div className="v4-reports-v4__ranking-list">
                    {visibleBoardRanking.map((item, index) => (
                      <div key={item.id} className="v4-reports-v4__ranking-item">
                        <span className="v4-reports-v4__ranking-index">#{index + 1}</span>
                        <div>
                          <strong>{item.code}</strong>
                          <p>{item.city} | {item.revenue}</p>
                        </div>
                        <StatusBadge status={statusToBadge(item.status)} label={item.trend} />
                      </div>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-reports-v4__card-head">
                    <h3>Resumo comercial</h3>
                    <StatusBadge status="success" label="pipeline" />
                  </div>
                  <div className="v4-reports-v4__summary-grid">
                    {reportsCommercialSummaryV4.map((item) => (
                      <article key={item.id} className="v4-reports-v4__summary-tile">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <p>{item.note}</p>
                      </article>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-reports-v4__card-head">
                    <h3>Funil operacional</h3>
                    <StatusBadge status="info" label="conversao" />
                  </div>
                  <div className="v4-reports-v4__funnel">
                    {reportsOperationalFunnelV4.map((step) => (
                      <div key={step.id} className="v4-reports-v4__funnel-step">
                        <div className="v4-reports-v4__funnel-head">
                          <strong>{step.label}</strong>
                          <span>{step.value}</span>
                        </div>
                        <div className="v4-reports-v4__funnel-track">
                          <div className="v4-reports-v4__funnel-fill" style={{ width: `${step.conversion}%` }} />
                        </div>
                        <small>{step.conversion.toFixed(1)}% do volume inicial</small>
                      </div>
                    ))}
                  </div>
                </ContentCard>
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Tabela executiva" subtitle="Resumo de segmentos com densidade enterprise para operação">
          {isError ? (
            <ErrorState
              title="Erro simulado na tabela executiva"
              description="A tabela permanece isolada e pronta para futura conexão com camada real de analytics."
            />
          ) : (
            <DataTable loading={isLoading} empty={forceEmpty || reportsExecutiveRowsV4.length === 0} density="compact">
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th>Receita</th>
                  <th>Margem</th>
                  <th>Ocupação</th>
                  <th>Disponibilidade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportsExecutiveRowsV4.map((row) => (
                  <tr key={row.id}>
                    <td>{row.segment}</td>
                    <td>{row.receita}</td>
                    <td>{row.margem}</td>
                    <td>{row.ocupacao}</td>
                    <td>{row.disponibilidade}</td>
                    <td>
                      <StatusBadge status={statusToBadge(row.status)} label={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </PageSection>
      </PageContainer>
    </PageShell>
  );
}
