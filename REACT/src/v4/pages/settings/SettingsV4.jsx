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
  settingsActivityRowsV4,
  settingsBrandIdentityV4,
  settingsCompanyCardsV4,
  settingsHeaderV4,
  settingsIntegrationsV4,
  settingsKpisV4,
  settingsOperationalPreferencesV4,
  settingsScopeOptionsV4,
  settingsSecurityAccessV4,
  settingsStateOptionsV4
} from './settingsMockData';

import './SettingsV4.css';

function matchesScope(item, scope) {
  return scope === 'todos' || item.scope === scope;
}

export default function SettingsV4({ demoState = null }) {
  const [selectedState, setSelectedState] = useState('default');
  const [selectedScope, setSelectedScope] = useState('todos');

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const companyCards = useMemo(
    () => settingsCompanyCardsV4.filter((item) => matchesScope(item, selectedScope)),
    [selectedScope]
  );
  const operationalPreferences = useMemo(
    () => settingsOperationalPreferencesV4.filter((item) => matchesScope(item, selectedScope)),
    [selectedScope]
  );
  const integrations = useMemo(
    () => settingsIntegrationsV4.filter((item) => matchesScope(item, selectedScope)),
    [selectedScope]
  );
  const securityAccess = useMemo(
    () => settingsSecurityAccessV4.filter((item) => matchesScope(item, selectedScope)),
    [selectedScope]
  );
  const brandIdentity = useMemo(
    () => settingsBrandIdentityV4.filter((item) => matchesScope(item, selectedScope)),
    [selectedScope]
  );

  const hasAnyContent = !forceEmpty && (
    companyCards.length > 0 ||
    operationalPreferences.length > 0 ||
    integrations.length > 0 ||
    securityAccess.length > 0 ||
    brandIdentity.length > 0
  );

  const activityRows = forceEmpty ? [] : settingsActivityRowsV4;

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="SETTINGS VISUAL V4" />}
      primary={<StatusBadge status="warning" label="SEM SALVAR REAL" />}
      menu={(
        <ActionMenu label="Acoes" open>
          <ActionMenuItem label="Salvar configurações" hint="bloqueado" disabled />
          <ActionMenuItem label="Publicar preferências" hint="somente visual" disabled />
          <ActionMenuDivider />
          <ActionMenuItem label="Exportar snapshot" hint="mock" disabled />
        </ActionMenu>
      )}
    />
  );

  return (
    <PageShell className="v4-settings-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={settingsHeaderV4.title}
          subtitle={settingsHeaderV4.subtitle}
          description={settingsHeaderV4.description}
          actions={headerActions}
          metrics={<StatusBadge status="success" label="CONFIGURACAO ISOLADA" />}
        />

        <PageSection title="Filtros de configuração" subtitle="Segmentos visuais por área administrativa">
          <FilterBar
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Escopo ${selectedScope}`} />}
                primary={<button type="button" className="v4-settings-v4__button" disabled>Salvar</button>}
              />
            )}
          >
            <FilterGroup label="Estado da tela">
              <FilterSelect
                value={visualState}
                options={settingsStateOptionsV4}
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
                options={settingsScopeOptionsV4}
                onChange={setSelectedScope}
                placeholder="Todos os blocos"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs de configuração" subtitle="Completude, governança e canais administrativos">
          <KPIGrid columns={6}>
            {settingsKpisV4.map((item) => (
              <KPICard key={item.id} label={item.label} value={item.value} change={item.change} trend={item.trend} />
            ))}
          </KPIGrid>
        </PageSection>

        <PageSection title="Configurações da empresa" subtitle="Dados cadastrais, operação, canais, segurança e marca">
          <SectionCard title="Painel administrativo" subtitle="Composição visual sem persistência real">
            {isLoading && (
              <div className="v4-settings-v4__state-banner">
                <LoadingState message="Carregando configurações simuladas..." />
              </div>
            )}

            {isError && (
              <div className="v4-settings-v4__state-banner">
                <ErrorState
                  title="Falha simulada nas configurações"
                  description="Retorne para demoState='default' para validar os blocos mockados de empresa, operação e segurança."
                />
              </div>
            )}

            {!isLoading && !isError && !hasAnyContent && (
              <div className="v4-settings-v4__state-banner">
                <EmptyState
                  title="Nenhuma configuração para o segmento atual"
                  description="Altere o filtro de segmento ou retorne para exibição padrão."
                />
              </div>
            )}

            {!isLoading && !isError && hasAnyContent && (
              <div className="v4-settings-v4__layout-grid">
                {companyCards.length > 0 && (
                  <ContentCard>
                    <div className="v4-settings-v4__card-head">
                      <h3>Dados da empresa</h3>
                      <StatusBadge status="success" label="cadastro" />
                    </div>
                    <div className="v4-settings-v4__company-grid">
                      {companyCards.map((item) => (
                        <article key={item.id} className="v4-settings-v4__company-card">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <p>{item.detail}</p>
                          <StatusBadge status={item.status} label={item.status} />
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                )}

                {operationalPreferences.length > 0 && (
                  <ContentCard>
                    <div className="v4-settings-v4__card-head">
                      <h3>Preferências operacionais</h3>
                      <StatusBadge status="info" label="operação" />
                    </div>
                    <div className="v4-settings-v4__list">
                      {operationalPreferences.map((item) => (
                        <article key={item.id} className="v4-settings-v4__list-item">
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

                {integrations.length > 0 && (
                  <ContentCard>
                    <div className="v4-settings-v4__card-head">
                      <h3>Canais e integrações</h3>
                      <StatusBadge status="warning" label="visual" />
                    </div>
                    <div className="v4-settings-v4__list">
                      {integrations.map((item) => (
                        <article key={item.id} className="v4-settings-v4__list-item">
                          <div>
                            <strong>{item.channel}</strong>
                            <p>{item.owner} | {item.health}</p>
                          </div>
                          <StatusBadge status={item.status} label={item.status} />
                        </article>
                      ))}
                    </div>
                  </ContentCard>
                )}

                {securityAccess.length > 0 && (
                  <ContentCard>
                    <div className="v4-settings-v4__card-head">
                      <h3>Segurança e acesso</h3>
                      <StatusBadge status="success" label="governança" />
                    </div>
                    <div className="v4-settings-v4__list">
                      {securityAccess.map((item) => (
                        <article key={item.id} className="v4-settings-v4__list-item">
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

                {brandIdentity.length > 0 && (
                  <ContentCard>
                    <div className="v4-settings-v4__card-head">
                      <h3>Identidade visual</h3>
                      <StatusBadge status="info" label="marca" />
                    </div>
                    <div className="v4-settings-v4__brand-grid">
                      {brandIdentity.map((item) => (
                        <article key={item.id} className="v4-settings-v4__brand-item">
                          <span className="v4-settings-v4__swatch" style={{ background: item.swatch }} />
                          <div>
                            <strong>{item.label}</strong>
                            <p>{item.value}</p>
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

        <PageSection title="Atividade recente de configuração" subtitle="Trilha visual de alterações simuladas">
          {isError ? (
            <ErrorState
              title="Erro simulado ao carregar atividade"
              description="Sem consulta real a serviços, auditoria, RBAC ou configurações persistidas."
            />
          ) : (
            <DataTable loading={isLoading} empty={activityRows.length === 0} density="compact">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Acao</th>
                  <th>Responsavel</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.area}</td>
                    <td>{row.action}</td>
                    <td>{row.actor}</td>
                    <td><StatusBadge status={row.status} label={row.status} /></td>
                    <td>{row.occurredAt}</td>
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
