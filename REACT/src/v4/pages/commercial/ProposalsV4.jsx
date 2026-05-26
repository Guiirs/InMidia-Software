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
  commercialPeriodOptionsV4,
  commercialRegionOptionsV4,
  commercialStateOptionsV4,
  proposalsHeaderV4,
  proposalsKpisV4,
  proposalsOwnerOptionsV4,
  proposalsRecentRowsV4,
  proposalsStageOptionsV4,
  proposalsStatusOptionsV4,
  proposalsWorkflowV4
} from './commercialMockData';

import './ProposalsV4.css';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function proposalStatusToBadge(status) {
  if (status === 'aprovada') return 'success';
  if (status === 'em-analise') return 'warning';
  if (status === 'recusada') return 'error';
  return 'default';
}

export default function ProposalsV4({ demoState = null }) {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('default');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [selectedOwner, setSelectedOwner] = useState('todos');
  const [selectedRegion, setSelectedRegion] = useState('todas');
  const [selectedStage, setSelectedStage] = useState('todos');

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const filteredRows = useMemo(() => {
    return proposalsRecentRowsV4.filter((row) => {
      const byStatus = selectedStatus === 'todos' || row.status === selectedStatus;
      const ownerKey = normalizeText(row.responsavel).replace(/\s+/g, '-');
      const byOwner = selectedOwner === 'todos' || ownerKey === selectedOwner;
      const byRegion = selectedRegion === 'todas' || normalizeText(row.regiao).includes(normalizeText(selectedRegion));
      const byStage = selectedStage === 'todos' || row.estagio === selectedStage;
      const bySearch = !search || normalizeText(`${row.cliente} ${row.valor} ${row.responsavel}`).includes(normalizeText(search));
      return byStatus && byOwner && byRegion && byStage && bySearch;
    });
  }, [search, selectedOwner, selectedRegion, selectedStage, selectedStatus]);

  const visibleRows = forceEmpty ? [] : filteredRows;

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="PIPELINE ISOLADO" />}
      primary={<StatusBadge status="warning" label="SEM MUTACOES" />}
      menu={(
        <ActionMenu label="Acoes" open>
          <ActionMenuItem label="Criar proposta" hint="bloqueado" disabled />
          <ActionMenuItem label="Mover de estagio" hint="somente visual" disabled />
          <ActionMenuDivider />
          <ActionMenuItem label="Exportar snapshot" hint="mock" disabled />
        </ActionMenu>
      )}
    />
  );

  return (
    <PageShell className="v4-proposals-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={proposalsHeaderV4.title}
          subtitle={proposalsHeaderV4.subtitle}
          description={proposalsHeaderV4.description}
          actions={headerActions}
          metrics={<StatusBadge status="success" label={`Periodo ${selectedPeriod.toUpperCase()}`} />}
        />

        <PageSection title="Filtros de pipeline" subtitle="Recorte visual por responsavel, estagio e prioridade comercial">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar cliente, responsavel ou valor"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Propostas ${visibleRows.length}`} />}
                primary={<button type="button" className="v4-proposals-v4__button" disabled>Nova proposta</button>}
              />
            )}
          >
            <FilterGroup label="Estado da tela">
              <FilterSelect
                value={visualState}
                options={commercialStateOptionsV4}
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
              <FilterSelect value={selectedPeriod} options={commercialPeriodOptionsV4} onChange={setSelectedPeriod} placeholder="Últimos 30 dias" />
            </FilterGroup>

            <FilterGroup label="Status">
              <FilterSelect value={selectedStatus} options={proposalsStatusOptionsV4} onChange={setSelectedStatus} placeholder="Todos os status" />
            </FilterGroup>

            <FilterGroup label="Responsavel">
              <FilterSelect value={selectedOwner} options={proposalsOwnerOptionsV4} onChange={setSelectedOwner} placeholder="Todos os responsáveis" />
            </FilterGroup>

            <FilterGroup label="Regiao">
              <FilterSelect value={selectedRegion} options={commercialRegionOptionsV4} onChange={setSelectedRegion} placeholder="Todas as regiões" />
            </FilterGroup>

            <FilterGroup label="Estagio">
              <FilterSelect value={selectedStage} options={proposalsStageOptionsV4} onChange={setSelectedStage} placeholder="Todos os estágios" />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs de pipeline" subtitle="Leitura executiva para produtividade comercial e conversao">
          <KPIGrid columns={6}>
            {proposalsKpisV4.map((item) => (
              <KPICard key={item.id} label={item.label} value={item.value} change={item.change} trend={item.trend} />
            ))}
          </KPIGrid>
        </PageSection>

        <PageSection title="Workflow comercial" subtitle="Kanban visual simulado para acompanhar estágios de aprovação">
          <SectionCard title="Pipeline por estágio" subtitle="Visual premium sem alteração de dados reais">
            {isLoading && (
              <div className="v4-proposals-v4__state-banner">
                <LoadingState message="Carregando pipeline de propostas simulado..." />
              </div>
            )}

            {isError && (
              <div className="v4-proposals-v4__state-banner">
                <ErrorState
                  title="Falha simulada no pipeline comercial"
                  description="Retorne para demoState='default' para visualizar o kanban e a tabela de propostas mockadas."
                />
              </div>
            )}

            {!isLoading && !isError && visibleRows.length === 0 && (
              <div className="v4-proposals-v4__state-banner">
                <EmptyState
                  title="Nenhuma proposta para os filtros atuais"
                  description="Ajuste periodo, status, responsavel, regiao ou estagio para recuperar o recorte comercial."
                />
              </div>
            )}

            {!isLoading && !isError && visibleRows.length > 0 && (
              <div className="v4-proposals-v4__kanban-grid">
                {proposalsWorkflowV4.map((stage) => (
                  <ContentCard key={stage.id}>
                    <div className="v4-proposals-v4__kanban-head">
                      <h3>{stage.label}</h3>
                      <StatusBadge status="info" label={stage.amount} />
                    </div>
                    <div className="v4-proposals-v4__kanban-list">
                      {stage.items.map((card) => (
                        <article key={card.id} className="v4-proposals-v4__kanban-card">
                          <strong>{card.title}</strong>
                          <p>{card.owner}</p>
                          <div className="v4-proposals-v4__kanban-meta">
                            <StatusBadge status={proposalStatusToBadge(card.status)} label={card.status} />
                            <span>{card.value}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                ))}
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Propostas recentes" subtitle="Tabela executiva para monitorar atualização e prioridade">
          {isError ? (
            <ErrorState
              title="Erro simulado ao carregar propostas recentes"
              description="O layout permanece em modo isolado e sem dependência de serviços reais."
            />
          ) : (
            <DataTable loading={isLoading} empty={visibleRows.length === 0} density="compact">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Responsavel</th>
                  <th>Regiao</th>
                  <th>Estagio</th>
                  <th>Atualizado em</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.cliente}</td>
                    <td>{row.valor}</td>
                    <td><StatusBadge status={proposalStatusToBadge(row.status)} label={row.status} /></td>
                    <td>{row.responsavel}</td>
                    <td>{row.regiao}</td>
                    <td>{row.estagio}</td>
                    <td>{row.updatedAt}</td>
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
