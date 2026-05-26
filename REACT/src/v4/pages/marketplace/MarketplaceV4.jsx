import { useMemo, useState } from 'react';

import {
  ActionMenu,
  ActionMenuDivider,
  ActionMenuItem,
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
  marketplaceActivityRowsV4,
  marketplaceCategoryOptionsV4,
  marketplaceDependenciesV4,
  marketplaceHeaderV4,
  marketplaceKpisV4,
  marketplaceModulesV4,
  marketplaceRecommendationsV4,
  marketplaceStateOptionsV4,
  marketplaceStatusOptionsV4
} from './marketplaceMockData';

import './MarketplaceV4.css';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

export default function MarketplaceV4({ demoState = null }) {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('default');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [selectedStatus, setSelectedStatus] = useState('todos');

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const filteredModules = useMemo(() => {
    return marketplaceModulesV4.filter((item) => {
      const byCategory = selectedCategory === 'todas' || item.category === selectedCategory;
      const byStatus = selectedStatus === 'todos' || item.status === selectedStatus;
      const bySearch = !search || normalizeText(`${item.name} ${item.description} ${item.owner}`).includes(normalizeText(search));
      return byCategory && byStatus && bySearch;
    });
  }, [search, selectedCategory, selectedStatus]);

  const visibleModules = forceEmpty ? [] : filteredModules;
  const activityRows = forceEmpty ? [] : marketplaceActivityRowsV4;

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="CATALOGO VISUAL V4" />}
      primary={<StatusBadge status="warning" label="SEM INSTALACAO REAL" />}
      menu={(
        <ActionMenu label="Acoes" open>
          <ActionMenuItem label="Instalar módulo" hint="bloqueado" disabled />
          <ActionMenuItem label="Ativar capacidade" hint="somente visual" disabled />
          <ActionMenuDivider />
          <ActionMenuItem label="Exportar catálogo" hint="mock" disabled />
        </ActionMenu>
      )}
    />
  );

  return (
    <PageShell className="v4-marketplace-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={marketplaceHeaderV4.title}
          subtitle={marketplaceHeaderV4.subtitle}
          description={marketplaceHeaderV4.description}
          actions={headerActions}
          metrics={<StatusBadge status="success" label="MARKETPLACE ISOLADO" />}
        />

        <PageSection title="Filtros do catálogo" subtitle="Busca, categoria, status de instalação e estado demo">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar módulo, capacidade ou área"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Módulos ${visibleModules.length}`} />}
                primary={<button type="button" className="v4-marketplace-v4__button" disabled>Instalar</button>}
              />
            )}
          >
            <FilterGroup label="Estado da tela">
              <FilterSelect
                value={visualState}
                options={marketplaceStateOptionsV4}
                onChange={(value) => {
                  if (!hasGlobalState) {
                    setSelectedState(value);
                  }
                }}
                placeholder="Exibição padrão"
                disabled={hasGlobalState}
              />
            </FilterGroup>

            <FilterGroup label="Categoria">
              <FilterSelect
                value={selectedCategory}
                options={marketplaceCategoryOptionsV4}
                onChange={setSelectedCategory}
                placeholder="Todas as categorias"
              />
            </FilterGroup>

            <FilterGroup label="Status">
              <FilterSelect
                value={selectedStatus}
                options={marketplaceStatusOptionsV4}
                onChange={setSelectedStatus}
                placeholder="Todos os status"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs do marketplace" subtitle="Módulos, capacidades e prontidão operacional">
          <KPIGrid columns={6}>
            {marketplaceKpisV4.map((item) => (
              <KPICard key={item.id} label={item.label} value={item.value} change={item.change} trend={item.trend} />
            ))}
          </KPIGrid>
        </PageSection>

        <PageSection title="Catálogo de módulos" subtitle="Cards visuais sem instalação, ativação ou dados reais">
          <SectionCard title="Capacidades disponíveis" subtitle="Catálogo mockado para avaliação de produto">
            {isLoading && (
              <div className="v4-marketplace-v4__state-banner">
                <LoadingState message="Carregando catálogo simulado..." />
              </div>
            )}

            {isError && (
              <div className="v4-marketplace-v4__state-banner">
                <ErrorState
                  title="Falha simulada no marketplace"
                  description="Retorne para demoState='default' para validar catálogo, dependências e recomendações mockadas."
                />
              </div>
            )}

            {!isLoading && !isError && visibleModules.length === 0 && (
              <div className="v4-marketplace-v4__state-banner">
                <EmptyState
                  title="Nenhum módulo encontrado"
                  description="Ajuste busca, categoria ou status para recuperar o catálogo visual."
                />
              </div>
            )}

            {!isLoading && !isError && visibleModules.length > 0 && (
              <div className="v4-marketplace-v4__layout-grid">
                <ContentCard>
                  <div className="v4-marketplace-v4__card-head">
                    <h3>Catálogo</h3>
                    <StatusBadge status="info" label="mock" />
                  </div>
                  <div className="v4-marketplace-v4__module-grid">
                    {visibleModules.map((item) => (
                      <article key={item.id} className="v4-marketplace-v4__module-card">
                        <div className="v4-marketplace-v4__module-head">
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.owner}</span>
                          </div>
                          <StatusBadge status={item.statusTone} label={item.status} />
                        </div>
                        <p>{item.description}</p>
                        <div className="v4-marketplace-v4__capabilities">
                          {item.capabilities.map((capability) => (
                            <StatusBadge key={capability} status="default" label={capability} />
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-marketplace-v4__card-head">
                    <h3>Dependências</h3>
                    <StatusBadge status="warning" label="validação" />
                  </div>
                  <div className="v4-marketplace-v4__list">
                    {marketplaceDependenciesV4.map((item) => (
                      <article key={item.id} className="v4-marketplace-v4__list-item">
                        <div>
                          <strong>{item.module}</strong>
                          <p>{item.dependency}</p>
                        </div>
                        <StatusBadge status={item.status} label={item.state} />
                      </article>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-marketplace-v4__card-head">
                    <h3>Recomendações</h3>
                    <StatusBadge status="success" label="priorização" />
                  </div>
                  <div className="v4-marketplace-v4__list">
                    {marketplaceRecommendationsV4.map((item) => (
                      <article key={item.id} className="v4-marketplace-v4__list-item">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </div>
                        <StatusBadge status={item.status} label={item.impact} />
                      </article>
                    ))}
                  </div>
                </ContentCard>
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Atividade recente" subtitle="Alterações visuais de catálogo e capacidades">
          {isError ? (
            <ErrorState
              title="Erro simulado ao carregar atividade"
              description="Sem consulta real ao MarketplacePage, services, módulos ou ativações persistidas."
            />
          ) : (
            <DataTable loading={isLoading} empty={activityRows.length === 0} density="compact">
              <thead>
                <tr>
                  <th>Horario</th>
                  <th>Modulo</th>
                  <th>Acao</th>
                  <th>Responsavel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.time}</td>
                    <td>{row.module}</td>
                    <td>{row.action}</td>
                    <td>{row.actor}</td>
                    <td><StatusBadge status={row.status} label={row.status} /></td>
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
