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
  contractsClientOptionsV4,
  contractsDueOptionsV4,
  contractsDuePanelV4,
  contractsHeaderV4,
  contractsKpisV4,
  contractsRenewalAlertsV4,
  contractsRowsV4,
  contractsStatusOptionsV4
} from './commercialMockData';

import './ContractsV4.css';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function contractStatusBadge(status) {
  if (status === 'ativo') return 'success';
  if (status === 'renovacao') return 'warning';
  if (status === 'suspenso' || status === 'vencido') return 'error';
  return 'default';
}

function assinaturaBadge(status) {
  if (status === 'assinado') return 'success';
  if (status === 'pendente') return 'warning';
  return 'default';
}

function pagamentoBadge(status) {
  if (status === 'em-dia') return 'success';
  if (status === 'atrasado') return 'error';
  return 'default';
}

function dueToBucket(days) {
  if (days < 0) return 'vencido';
  if (days <= 7) return '7d';
  if (days <= 30) return '30d';
  if (days <= 60) return '60d';
  return 'todos';
}

function dueToBadge(days) {
  if (days < 0) return 'error';
  if (days <= 30) return 'warning';
  return 'success';
}

export default function ContractsV4({ demoState = null }) {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('default');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [selectedClient, setSelectedClient] = useState('todos');
  const [selectedRegion, setSelectedRegion] = useState('todas');
  const [selectedDue, setSelectedDue] = useState('todos');

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const filteredContracts = useMemo(() => {
    return contractsRowsV4.filter((row) => {
      const byStatus = selectedStatus === 'todos' || row.status === selectedStatus;
      const clientKey = normalizeText(row.cliente).replace(/\s+/g, '-');
      const byClient = selectedClient === 'todos' || clientKey === selectedClient;
      const byRegion = selectedRegion === 'todas' || normalizeText(row.regiao).includes(normalizeText(selectedRegion));
      const dueBucket = dueToBucket(contractsDuePanelV4.find((item) => item.contrato === row.id)?.dias || 120);
      const byDue = selectedDue === 'todos' || dueBucket === selectedDue;
      const bySearch = !search || normalizeText(`${row.cliente} ${row.valor} ${row.id}`).includes(normalizeText(search));
      return byStatus && byClient && byRegion && byDue && bySearch;
    });
  }, [search, selectedClient, selectedDue, selectedRegion, selectedStatus]);

  const visibleContracts = forceEmpty ? [] : filteredContracts;

  const dueCards = useMemo(() => {
    if (forceEmpty) return [];
    return contractsDuePanelV4.filter((item) => {
      const byDue = selectedDue === 'todos' || dueToBucket(item.dias) === selectedDue;
      return byDue;
    });
  }, [forceEmpty, selectedDue]);

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="GESTAO CONTRATUAL V4" />}
      primary={<StatusBadge status="warning" label="SEM JOBS REAIS" />}
      menu={(
        <ActionMenu label="Acoes" open>
          <ActionMenuItem label="Renovar contrato" hint="bloqueado" disabled />
          <ActionMenuItem label="Registrar assinatura" hint="somente visual" disabled />
          <ActionMenuDivider />
          <ActionMenuItem label="Exportar contratos" hint="mock" disabled />
        </ActionMenu>
      )}
    />
  );

  return (
    <PageShell className="v4-contracts-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={contractsHeaderV4.title}
          subtitle={contractsHeaderV4.subtitle}
          description={contractsHeaderV4.description}
          actions={headerActions}
          metrics={<StatusBadge status="success" label={`Periodo ${selectedPeriod.toUpperCase()}`} />}
        />

        <PageSection title="Filtros contratuais" subtitle="Recorte por vigência, cliente e situação financeira">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar contrato, cliente, valor ou identificador"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Contratos ${visibleContracts.length}`} />}
                primary={<button type="button" className="v4-contracts-v4__button" disabled>Novo contrato</button>}
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
              <FilterSelect value={selectedStatus} options={contractsStatusOptionsV4} onChange={setSelectedStatus} placeholder="Todos os status" />
            </FilterGroup>

            <FilterGroup label="Cliente">
              <FilterSelect value={selectedClient} options={contractsClientOptionsV4} onChange={setSelectedClient} placeholder="Todos os clientes" />
            </FilterGroup>

            <FilterGroup label="Regiao">
              <FilterSelect value={selectedRegion} options={commercialRegionOptionsV4} onChange={setSelectedRegion} placeholder="Todas as regiões" />
            </FilterGroup>

            <FilterGroup label="Vencimento">
              <FilterSelect value={selectedDue} options={contractsDueOptionsV4} onChange={setSelectedDue} placeholder="Todos os vencimentos" />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs de contratos" subtitle="Indicadores executivos para vigência, renovação e adimplência">
          <KPIGrid columns={6}>
            {contractsKpisV4.map((item) => (
              <KPICard key={item.id} label={item.label} value={item.value} change={item.change} trend={item.trend} />
            ))}
          </KPIGrid>
        </PageSection>

        <PageSection title="Vencimentos e alertas" subtitle="Painel de renovação com sinais de assinatura e pagamento">
          <SectionCard title="Radar de vencimentos" subtitle="Priorização visual para mitigação de risco contratual">
            {isLoading && (
              <div className="v4-contracts-v4__state-banner">
                <LoadingState message="Carregando painel de vencimentos simulado..." />
              </div>
            )}

            {isError && (
              <div className="v4-contracts-v4__state-banner">
                <ErrorState
                  title="Falha simulada no monitoramento contratual"
                  description="Retorne para demoState='default' para visualizar painel de vencimentos e alertas mockados."
                />
              </div>
            )}

            {!isLoading && !isError && visibleContracts.length === 0 && (
              <div className="v4-contracts-v4__state-banner">
                <EmptyState
                  title="Nenhum contrato no recorte atual"
                  description="Ajuste periodo, status, cliente, regiao ou vencimento para recuperar os dados simulados."
                />
              </div>
            )}

            {!isLoading && !isError && visibleContracts.length > 0 && (
              <div className="v4-contracts-v4__panels-grid">
                <ContentCard>
                  <div className="v4-contracts-v4__panel-head">
                    <h3>Painel de vencimentos</h3>
                    <StatusBadge status="warning" label="renovação" />
                  </div>
                  <div className="v4-contracts-v4__due-list">
                    {dueCards.map((item) => (
                      <article key={item.id} className="v4-contracts-v4__due-item">
                        <div>
                          <strong>{item.cliente}</strong>
                          <p>{item.contrato} | {item.valor}</p>
                        </div>
                        <StatusBadge
                          status={dueToBadge(item.dias)}
                          label={item.dias < 0 ? `${Math.abs(item.dias)} dias vencido` : `${item.dias} dias`}
                        />
                      </article>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard>
                  <div className="v4-contracts-v4__panel-head">
                    <h3>Alertas de renovação</h3>
                    <StatusBadge status="info" label="monitorado" />
                  </div>
                  <div className="v4-contracts-v4__alerts-list">
                    {contractsRenewalAlertsV4.map((alert) => (
                      <article key={alert.id} className="v4-contracts-v4__alert-item">
                        <strong>{alert.title}</strong>
                        <p>{alert.description}</p>
                        <StatusBadge status={alert.level} label={alert.level} />
                      </article>
                    ))}
                  </div>
                </ContentCard>
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Tabela de contratos" subtitle="Status de assinatura e pagamento para controle operacional">
          {isError ? (
            <ErrorState
              title="Erro simulado ao carregar tabela de contratos"
              description="A visualização permanece isolada e pronta para integração futura, sem alterar página real."
            />
          ) : (
            <DataTable loading={isLoading} empty={visibleContracts.length === 0} density="compact">
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Cliente</th>
                  <th>Regiao</th>
                  <th>Status</th>
                  <th>Assinatura</th>
                  <th>Pagamento</th>
                  <th>Inicio</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {visibleContracts.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.cliente}</td>
                    <td>{row.regiao}</td>
                    <td><StatusBadge status={contractStatusBadge(row.status)} label={row.status} /></td>
                    <td><StatusBadge status={assinaturaBadge(row.assinatura)} label={row.assinatura} /></td>
                    <td><StatusBadge status={pagamentoBadge(row.pagamento)} label={row.pagamento} /></td>
                    <td>{row.inicio}</td>
                    <td>{row.vencimento}</td>
                    <td>{row.valor}</td>
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
