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
  SectionCard,
  StatusBadge,
  ToolbarActions
} from '../../components';

import {
  integrationsApiKeysV4,
  integrationsConnectorsV4,
  integrationsEventRowsV4,
  integrationsHeaderV4,
  integrationsKpisV4,
  integrationsScopeOptionsV4,
  integrationsSecurityRotationV4,
  integrationsStateOptionsV4,
  integrationsStatusOptionsV4,
  integrationsUsageLimitsV4,
  integrationsWebhooksV4
} from './integrationsMockData';

import './IntegrationsV4.css';

function matchesScope(item, scope) {
  return scope === 'todos' || item.scope === scope;
}

function matchesStatus(item, status) {
  return status === 'todos' || item.status === status;
}

export default function IntegrationsV4({ demoState = null }) {
  const [selectedState, setSelectedState] = useState('default');
  const [selectedScope, setSelectedScope] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos');

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const apiKeys = useMemo(
    () => integrationsApiKeysV4.filter((item) => matchesScope(item, selectedScope) && matchesStatus(item, selectedStatus)),
    [selectedScope, selectedStatus]
  );
  const webhooks = useMemo(
    () => integrationsWebhooksV4.filter((item) => matchesScope(item, selectedScope) && matchesStatus(item, selectedStatus)),
    [selectedScope, selectedStatus]
  );
  const connectors = useMemo(
    () => integrationsConnectorsV4.filter((item) => matchesScope(item, selectedScope) && matchesStatus(item, selectedStatus)),
    [selectedScope, selectedStatus]
  );
  const securityRotation = useMemo(
    () => integrationsSecurityRotationV4.filter((item) => matchesScope(item, selectedScope) && matchesStatus(item, selectedStatus)),
    [selectedScope, selectedStatus]
  );
  const usageLimits = useMemo(
    () => integrationsUsageLimitsV4.filter((item) => matchesScope(item, selectedScope) && matchesStatus(item, selectedStatus)),
    [selectedScope, selectedStatus]
  );

  const hasAnyContent = !forceEmpty && (
    apiKeys.length > 0 ||
    webhooks.length > 0 ||
    connectors.length > 0 ||
    securityRotation.length > 0 ||
    usageLimits.length > 0
  );

  const eventRows = forceEmpty
    ? []
    : integrationsEventRowsV4.filter((item) => matchesStatus(item, selectedStatus));

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="API VISUAL V4" />}
      primary={<StatusBadge status="warning" label="TOKENS MASCARADOS" />}
      menu={(
        <ActionMenu label="Ações" open>
          <ActionMenuItem label="Criar chave" hint="bloqueado" disabled />
          <ActionMenuItem label="Rotacionar segredo" hint="somente visual" disabled />
          <ActionMenuDivider />
          <ActionMenuItem label="Exportar eventos" hint="mock" disabled />
        </ActionMenu>
      )}
    />
  );

  return (
    <PageShell className="v4-integrations-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={integrationsHeaderV4.title}
          subtitle={integrationsHeaderV4.subtitle}
          description={integrationsHeaderV4.description}
          actions={headerActions}
          metrics={<StatusBadge status="success" label="INTEGRAÇÃO ISOLADA" />}
        />

        <PageSection title="Filtros técnicos" subtitle="Recorte visual por segmento, status operacional e estado demo">
          <FilterBar
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Eventos ${eventRows.length}`} />}
                primary={<button type="button" className="v4-integrations-v4__button" disabled>Nova chave</button>}
              />
            )}
          >
            <FilterGroup label="Estado da tela">
              <FilterSelect
                value={visualState}
                options={integrationsStateOptionsV4}
                onChange={(value) => {
                  if (!hasGlobalState) {
                    setSelectedState(value);
                  }
                }}
                placeholder="Exibição padrão"
                disabled={hasGlobalState}
              />
            </FilterGroup>

            <FilterGroup label="Segmento">
              <FilterSelect
                value={selectedScope}
                options={integrationsScopeOptionsV4}
                onChange={setSelectedScope}
                placeholder="Todos os segmentos"
              />
            </FilterGroup>

            <FilterGroup label="Status">
              <FilterSelect
                value={selectedStatus}
                options={integrationsStatusOptionsV4}
                onChange={setSelectedStatus}
                placeholder="Todos os status"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs de integrações" subtitle="Saúde técnica, uso e governança de chaves">
          <KPIGrid columns={6}>
            {integrationsKpisV4.map((item) => (
              <KPICard key={item.id} label={item.label} value={item.value} change={item.change} trend={item.trend} />
            ))}
          </KPIGrid>
        </PageSection>

        <PageSection title="Painel técnico-operacional" subtitle="Chaves, webhooks, conectores, segurança e limites sem integração real">
          <SectionCard title="Controles visuais" subtitle="Nenhuma chave real e nenhuma mutação persistida">
            {isLoading && (
              <div className="v4-integrations-v4__state-banner">
                <LoadingState message="Carregando integrações simuladas..." />
              </div>
            )}

            {isError && (
              <div className="v4-integrations-v4__state-banner">
                <ErrorState
                  title="Falha simulada no painel de integrações"
                  description="Retorne para demoState='default' para validar chaves, webhooks e conectores mockados."
                />
              </div>
            )}

            {!isLoading && !isError && !hasAnyContent && (
              <div className="v4-integrations-v4__state-banner">
                <EmptyState
                  title="Nenhuma integração para os filtros atuais"
                  description="Ajuste segmento ou status para recuperar os blocos técnico-operacionais."
                />
              </div>
            )}

            {!isLoading && !isError && hasAnyContent && (
              <div className="v4-integrations-v4__layout-grid">
                {apiKeys.length > 0 && (
                  <ContentCard>
                    <div className="v4-integrations-v4__card-head">
                      <h3>Chaves e API</h3>
                      <StatusBadge status="warning" label="sem token real" />
                    </div>
                    <div className="v4-integrations-v4__key-list">
                      {apiKeys.map((item) => (
                        <article key={item.id} className="v4-integrations-v4__key-card">
                          <div className="v4-integrations-v4__key-row">
                            <strong>{item.name}</strong>
                            <StatusBadge status={item.status} label={item.status} />
                          </div>
                          <code>{item.maskedKey}</code>
                          <div className="v4-integrations-v4__meta-row">
                            <span>{item.owner}</span>
                            <span>{item.expiresIn}</span>
                            <span>{item.lastUsed}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                )}

                {webhooks.length > 0 && (
                  <ContentCard>
                    <div className="v4-integrations-v4__card-head">
                      <h3>Webhooks</h3>
                      <StatusBadge status="info" label="entrega visual" />
                    </div>
                    <div className="v4-integrations-v4__list">
                      {webhooks.map((item) => (
                        <article key={item.id} className="v4-integrations-v4__list-item">
                          <div>
                            <strong>{item.event}</strong>
                            <p>{item.endpoint}</p>
                            <small>{item.latency} | retry {item.retries}</small>
                          </div>
                          <StatusBadge status={item.status} label={item.status} />
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                )}

                {connectors.length > 0 && (
                  <ContentCard>
                    <div className="v4-integrations-v4__card-head">
                      <h3>Status de conectores</h3>
                      <StatusBadge status="success" label="monitorado" />
                    </div>
                    <div className="v4-integrations-v4__connector-grid">
                      {connectors.map((item) => (
                        <article key={item.id} className="v4-integrations-v4__connector-card">
                          <strong>{item.name}</strong>
                          <p>{item.owner}</p>
                          <StatusBadge status={item.status} label={item.health} />
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                )}

                {securityRotation.length > 0 && (
                  <ContentCard>
                    <div className="v4-integrations-v4__card-head">
                      <h3>Segurança e rotação</h3>
                      <StatusBadge status="warning" label="bloqueado" />
                    </div>
                    <div className="v4-integrations-v4__list">
                      {securityRotation.map((item) => (
                        <article key={item.id} className="v4-integrations-v4__list-item">
                          <div>
                            <strong>{item.label}</strong>
                            <p>{item.value}</p>
                          </div>
                          <StatusBadge status={item.status} label={item.status} />
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                )}

                {usageLimits.length > 0 && (
                  <ContentCard>
                    <div className="v4-integrations-v4__card-head">
                      <h3>Limites e uso</h3>
                      <StatusBadge status="info" label="quota mock" />
                    </div>
                    <div className="v4-integrations-v4__limit-list">
                      {usageLimits.map((item) => (
                        <article key={item.id} className="v4-integrations-v4__limit-item">
                          <div className="v4-integrations-v4__key-row">
                            <strong>{item.label}</strong>
                            <StatusBadge status={item.status} label={item.value} />
                          </div>
                          <div className="v4-integrations-v4__meter" aria-label={`${item.label}: ${item.used}%`}>
                            <span style={{ width: `${item.used}%` }} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                )}
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Eventos recentes" subtitle="Tabela técnica de entregas, chamadas e segurança">
          {isError ? (
            <ErrorState
              title="Erro simulado ao carregar eventos"
              description="Sem consulta real a APIs, webhooks, Marketplace, EmpresaApiKey ou serviços persistidos."
            />
          ) : (
            <DataTable loading={isLoading} empty={eventRows.length === 0} density="compact">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Origem</th>
                  <th>Evento</th>
                  <th>Detalhe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {eventRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.time}</td>
                    <td>{row.source}</td>
                    <td>{row.event}</td>
                    <td>{row.detail}</td>
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
