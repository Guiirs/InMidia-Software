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
  TablePagination,
  ToolbarActions
} from '../../components';

import { auditV4MockData } from './auditMockData';
import './AuditV4.css';

function normalizeSeverity(value) {
  if (value === 'error') return 'error';
  if (value === 'warning') return 'warning';
  if (value === 'info') return 'info';
  return 'default';
}

export default function AuditV4({ demoState = 'default' }) {
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('24h');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const isLoading = demoState === 'loading';
  const isError = demoState === 'error';
  const forcedEmpty = demoState === 'empty';

  const filteredEvents = useMemo(() => {
    if (forcedEmpty) return [];

    const term = search.trim().toLowerCase();
    return auditV4MockData.recentEvents.filter((event) => {
      const bySearch = !term
        || event.actor.toLowerCase().includes(term)
        || event.entity.toLowerCase().includes(term)
        || event.entityId.toLowerCase().includes(term)
        || event.id.toLowerCase().includes(term);
      const byUser = userFilter === 'all' || event.actor === userFilter;
      const byAction = actionFilter === 'all' || event.action === actionFilter;
      const byEntity = entityFilter === 'all' || event.entity === entityFilter;
      return bySearch && byUser && byAction && byEntity;
    });
  }, [actionFilter, entityFilter, forcedEmpty, search, userFilter]);

  const totalItems = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedEvents = filteredEvents.slice(pageStart, pageStart + pageSize);

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="VISUAL ISOLADO" />}
      primary={<button type="button" className="v4-audit-v4__button v4-audit-v4__button--primary">Atualizar painel</button>}
      menu={<button type="button" className="v4-audit-v4__button">Exportar trilha</button>}
    />
  );

  return (
    <PageShell className="v4-audit-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={auditV4MockData.header.title}
          subtitle={auditV4MockData.header.subtitle}
          description={auditV4MockData.header.description}
          actions={headerActions}
          metrics={<StatusBadge status="warning" label={`Periodo ${periodFilter}`} />}
        />

        <PageSection title="Filtros visuais" subtitle="Preparado para filtros de usuário, ação, entidade e período">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar por usuario, entidade ou identificador"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Eventos ${totalItems}`} />}
                primary={<button type="button" className="v4-audit-v4__button">Salvar visao</button>}
              />
            )}
          >
            <FilterGroup label="Usuario">
              <FilterSelect
                value={userFilter}
                options={auditV4MockData.filters.users}
                onChange={(value) => {
                  setPage(1);
                  setUserFilter(value);
                }}
                placeholder="Todos"
              />
            </FilterGroup>

            <FilterGroup label="Acao">
              <FilterSelect
                value={actionFilter}
                options={auditV4MockData.filters.actions}
                onChange={(value) => {
                  setPage(1);
                  setActionFilter(value);
                }}
                placeholder="Todas"
              />
            </FilterGroup>

            <FilterGroup label="Entidade">
              <FilterSelect
                value={entityFilter}
                options={auditV4MockData.filters.entities}
                onChange={(value) => {
                  setPage(1);
                  setEntityFilter(value);
                }}
                placeholder="Todas"
              />
            </FilterGroup>

            <FilterGroup label="Periodo">
              <FilterSelect
                value={periodFilter}
                options={auditV4MockData.filters.periods}
                onChange={setPeriodFilter}
                placeholder="24h"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="Resumo de auditoria" subtitle="Painel operacional para leitura rapida de risco e atividade">
          {isLoading && <LoadingState message="Carregando resumo de auditoria simulado..." />}
          {isError && (
            <ErrorState
              title="Falha simulada no resumo"
              description="Use demoState='default' para retornar ao conjunto mock."
            />
          )}
          {!isLoading && !isError && forcedEmpty && (
            <EmptyState
              title="Sem indicadores no periodo"
              description="Quando houver eventos, os totais consolidados serao exibidos aqui."
            />
          )}
          {!isLoading && !isError && !forcedEmpty && (
            <KPIGrid columns={4}>
              <KPICard label="Eventos em 24h" value={String(auditV4MockData.summary.totalEventos24h)} change="+6,2%" trend="up" />
              <KPICard label="Críticos" value={String(auditV4MockData.summary.eventosCríticos)} change="+2" trend="down" />
              <KPICard label="Usuários ativos" value={String(auditV4MockData.summary.usuariosAtivos)} change="-1" trend="down" />
              <KPICard label="Entidades monitoradas" value={String(auditV4MockData.summary.entidadesMonitoradas)} change="0" trend="neutral" />
            </KPIGrid>
          )}
        </PageSection>

        <PageSection title="Timeline de eventos" subtitle="Lista visual com severidade e contexto operacional">
          <SectionCard title="Ocorrências recentes" subtitle="Espaço preparado para conexão futura com auditService">
            {isLoading && <LoadingState message="Carregando timeline simulada..." />}
            {isError && (
              <ErrorState
                title="Erro simulado na timeline"
                description="O fallback visual permite validar densidade e contraste sem API."
              />
            )}
            {!isLoading && !isError && forcedEmpty && (
              <EmptyState
                title="Sem eventos para timeline"
                description="A timeline exibirá usuário, ação, entidade e horário quando houver dados."
              />
            )}
            {!isLoading && !isError && !forcedEmpty && (
              <div className="v4-audit-v4__timeline">
                {auditV4MockData.timeline.map((event) => (
                  <ContentCard key={event.id}>
                    <article className="v4-audit-v4__timeline-item">
                      <div className="v4-audit-v4__timeline-head">
                        <strong>{event.action} em {event.entity}</strong>
                        <div className="v4-audit-v4__timeline-badges">
                          <StatusBadge status={normalizeSeverity(event.severity)} label={event.severity} />
                          <StatusBadge status="default" label={event.status} />
                        </div>
                      </div>
                      <p>{event.detail}</p>
                      <div className="v4-audit-v4__timeline-meta">
                        <span>Usuario: {event.actor}</span>
                        <span>Entidade: {event.entityId}</span>
                        <span>Quando: {event.at}</span>
                      </div>
                    </article>
                  </ContentCard>
                ))}
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Eventos recentes" subtitle="Tabela preparada para RBAC audit.read e filtros reais">
          <SectionCard title="Tabela operacional" subtitle="Modelo para integrar filtros e paginação real" actions={<StatusBadge status="info" label="BASE MOCK" />}>
            {isError ? (
              <ErrorState
                title="Erro simulado na tabela"
                description="A estrutura permanece pronta para plugar auditService posteriormente."
              />
            ) : (
              <>
                <DataTable
                  density="compact"
                  loading={isLoading}
                  empty={forcedEmpty || (!isLoading && pagedEvents.length === 0)}
                  stale={periodFilter === '30d'}
                  staleMessage="Consulta ampla selecionada; os dados podem refletir atraso de consolidação."
                >
                  <thead>
                    <tr>
                      <th>Severidade</th>
                      <th>Usuario</th>
                      <th>Acao</th>
                      <th>Entidade</th>
                      <th>Identificador</th>
                      <th>Quando</th>
                      <th>Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedEvents.map((event) => (
                      <tr key={event.id}>
                        <td><StatusBadge status={normalizeSeverity(event.severity)} label={event.severity} /></td>
                        <td>{event.actor}</td>
                        <td>{event.action}</td>
                        <td>{event.entity}</td>
                        <td>{event.entityId}</td>
                        <td>{event.at}</td>
                        <td>{event.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>

                <TablePagination
                  page={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPrev={() => setPage((value) => Math.max(1, value - 1))}
                  onNext={() => setPage((value) => Math.min(totalPages, value + 1))}
                  onPageSizeChange={(value) => {
                    setPage(1);
                    setPageSize(value);
                  }}
                />
              </>
            )}
          </SectionCard>
        </PageSection>
      </PageContainer>
    </PageShell>
  );
}
