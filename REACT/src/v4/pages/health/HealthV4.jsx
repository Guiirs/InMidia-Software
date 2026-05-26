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

import { healthV4MockData } from './healthMockData';
import './HealthV4.css';

function mapStatusToBadge(status) {
  if (status === 'normal') return 'success';
  if (status === 'atencao') return 'warning';
  if (status === 'critico') return 'error';
  return 'default';
}

function mapImpactToBadge(impact) {
  if (impact === 'alto') return 'error';
  if (impact === 'medio') return 'warning';
  if (impact === 'baixo') return 'info';
  return 'default';
}

export default function HealthV4({ demoState = 'default' }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [impactFilter, setImpactFilter] = useState('all');
  const [windowFilter, setWindowFilter] = useState('30m');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const isLoading = demoState === 'loading';
  const isError = demoState === 'error';
  const forcedEmpty = demoState === 'empty';

  const statusOptions = [
    { value: 'all', label: 'Todos os status' },
    { value: 'normal', label: 'Normal' },
    { value: 'atencao', label: 'Atenção' },
    { value: 'critico', label: 'Crítico' }
  ];

  const impactOptions = [
    { value: 'all', label: 'Todos os impactos' },
    { value: 'baixo', label: 'Baixo' },
    { value: 'medio', label: 'Médio' },
    { value: 'alto', label: 'Alto' }
  ];

  const windowOptions = [
    { value: '30m', label: 'Janela 30 min' },
    { value: '1h', label: 'Janela 1 hora' },
    { value: '6h', label: 'Janela 6 horas' },
    { value: '24h', label: 'Janela 24 horas' }
  ];

  const filteredChannels = useMemo(() => {
    if (forcedEmpty) return [];

    const term = search.trim().toLowerCase();
    return healthV4MockData.channels.filter((channel) => {
      const bySearch = !term
        || channel.nome.toLowerCase().includes(term)
        || channel.observacao.toLowerCase().includes(term)
        || channel.id.toLowerCase().includes(term);
      const byStatus = statusFilter === 'all' || channel.status === statusFilter;
      return bySearch && byStatus;
    });
  }, [forcedEmpty, search, statusFilter]);

  const filteredEvents = useMemo(() => {
    if (forcedEmpty) return [];

    const term = search.trim().toLowerCase();
    return healthV4MockData.recentEvents.filter((event) => {
      const bySearch = !term
        || event.tipo.toLowerCase().includes(term)
        || event.canal.toLowerCase().includes(term)
        || event.id.toLowerCase().includes(term);
      const byImpact = impactFilter === 'all' || event.impacto === impactFilter;
      return bySearch && byImpact;
    });
  }, [forcedEmpty, impactFilter, search]);

  const totalItems = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedEvents = filteredEvents.slice(pageStart, pageStart + pageSize);

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label="PAINEL VISUAL ISOLADO" />}
      primary={<button type="button" className="v4-health-v4__button v4-health-v4__button--primary">Atualizar painel</button>}
      menu={<button type="button" className="v4-health-v4__button">Registrar observação</button>}
    />
  );

  return (
    <PageShell className="v4-health-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={healthV4MockData.header.title}
          subtitle={healthV4MockData.header.subtitle}
          description={healthV4MockData.header.description}
          actions={headerActions}
          metrics={<StatusBadge status="warning" label={`Janela ${windowFilter}`} />}
        />

        <PageSection title="Filtros operacionais" subtitle="Base preparada para filtros reais de monitoramento">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar por canal, evento ou identificador"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Canais ${filteredChannels.length}`} />}
                primary={<button type="button" className="v4-health-v4__button">Salvar visao</button>}
              />
            )}
          >
            <FilterGroup label="Status do canal">
              <FilterSelect
                value={statusFilter}
                options={statusOptions}
                onChange={(value) => {
                  setPage(1);
                  setStatusFilter(value);
                }}
                placeholder="Todos"
              />
            </FilterGroup>

            <FilterGroup label="Impacto">
              <FilterSelect
                value={impactFilter}
                options={impactOptions}
                onChange={(value) => {
                  setPage(1);
                  setImpactFilter(value);
                }}
                placeholder="Todos"
              />
            </FilterGroup>

            <FilterGroup label="Janela">
              <FilterSelect
                value={windowFilter}
                options={windowOptions}
                onChange={setWindowFilter}
                placeholder="30 min"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="Indicadores de saude" subtitle="Leitura rapida do panorama operacional">
          {isLoading && <LoadingState message="Carregando indicadores simulados..." />}
          {isError && (
            <ErrorState
              title="Falha simulada nos indicadores"
              description="Use demoState='default' para retornar ao conjunto de exibição mock."
            />
          )}
          {!isLoading && !isError && forcedEmpty && (
            <EmptyState
              title="Sem indicadores na janela"
              description="Os indicadores reaparecem quando houver movimentação registrada."
            />
          )}
          {!isLoading && !isError && !forcedEmpty && (
            <KPIGrid columns={4}>
              <KPICard label="Disponibilidade geral" value={healthV4MockData.kpis.disponibilidadeGeral} change="+0,4 p.p." trend="up" />
              <KPICard label="Sincronização ativa" value={healthV4MockData.kpis.sincronizacaoAtiva} change="-0,6 p.p." trend="down" />
              <KPICard label="Filas pendentes" value={String(healthV4MockData.kpis.filasPendentes)} change="+3" trend="down" />
              <KPICard label="Incidentes abertos" value={String(healthV4MockData.kpis.incidentesAbertos)} change="+1" trend="down" />
            </KPIGrid>
          )}
        </PageSection>

        <PageSection title="Painel de sincronização" subtitle="Visão consolidada do ciclo operacional atual">
          <SectionCard title="Resumo do ciclo" subtitle="Preparado para integrar syncService e useSyncDiagnostics">
            {isLoading && <LoadingState message="Carregando painel de sincronização..." />}
            {isError && (
              <ErrorState
                title="Falha simulada no painel"
                description="O layout permanece válido para integração futura com dados reais."
              />
            )}
            {!isLoading && !isError && forcedEmpty && (
              <EmptyState
                title="Sem dados de sincronização"
                description="O painel exibira cobertura, ciclo e ritmo quando houver dados disponíveis."
              />
            )}
            {!isLoading && !isError && !forcedEmpty && (
              <div className="v4-health-v4__sync-grid">
                <ContentCard>
                  <span className="v4-health-v4__label">Fase atual</span>
                  <strong>{healthV4MockData.syncPanel.faseAtual}</strong>
                </ContentCard>
                <ContentCard>
                  <span className="v4-health-v4__label">Último ciclo</span>
                  <strong>{healthV4MockData.syncPanel.ultimoCiclo}</strong>
                </ContentCard>
                <ContentCard>
                  <span className="v4-health-v4__label">Tempo medio</span>
                  <strong>{healthV4MockData.syncPanel.tempoMedioAtualizacao}</strong>
                </ContentCard>
                <ContentCard>
                  <span className="v4-health-v4__label">Cobertura</span>
                  <strong>{healthV4MockData.syncPanel.coberturaInventario}</strong>
                </ContentCard>
                <ContentCard>
                  <span className="v4-health-v4__label">Estado atual</span>
                  <StatusBadge status={mapStatusToBadge(healthV4MockData.syncPanel.status)} label={healthV4MockData.syncPanel.status} />
                </ContentCard>
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Canais e serviços" subtitle="Monitoramento visual de status por frente operacional">
          <SectionCard title="Status por canal" subtitle="Sem acoplamento técnico nesta fase" actions={<StatusBadge status="info" label="BASE MOCK" />}>
            {isLoading && <LoadingState message="Carregando canais simulados..." />}
            {isError && (
              <ErrorState
                title="Falha simulada nos canais"
                description="Use o modo padrão para validar a composição completa da grade operacional."
              />
            )}
            {!isLoading && !isError && forcedEmpty && (
              <EmptyState
                title="Sem canais na selecao atual"
                description="Ajuste os filtros para visualizar status de canal e fila operacional."
              />
            )}
            {!isLoading && !isError && !forcedEmpty && (
              <div className="v4-health-v4__channel-list">
                {filteredChannels.map((channel) => (
                  <ContentCard key={channel.id}>
                    <div className="v4-health-v4__channel-item">
                      <div className="v4-health-v4__channel-main">
                        <strong>{channel.nome}</strong>
                        <p>{channel.observacao}</p>
                      </div>
                      <div className="v4-health-v4__channel-side">
                        <StatusBadge status={mapStatusToBadge(channel.status)} label={channel.status} />
                        <span>Fila {channel.fila}</span>
                        <span>{channel.ultimaAtualizacao}</span>
                      </div>
                    </div>
                  </ContentCard>
                ))}
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Eventos recentes" subtitle="Historico visual para acompanhamento da janela atual">
          <SectionCard title="Eventos do sistema" subtitle="Preparado para /status e /admin-sync">
            {isError ? (
              <ErrorState
                title="Erro simulado na lista de eventos"
                description="Estrutura pronta para receber eventos reais com controle de permissao sync.diagnostics."
              />
            ) : (
              <>
                <DataTable
                  density="compact"
                  loading={isLoading}
                  empty={forcedEmpty || (!isLoading && pagedEvents.length === 0)}
                  degraded={healthV4MockData.degradation.situacao === 'parcial'}
                  degradedMessage="Existe atraso parcial em alguns canais. Operação segue com monitoramento reforcado."
                >
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Canal</th>
                      <th>Impacto</th>
                      <th>Horario</th>
                      <th>Responsavel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedEvents.map((event) => (
                      <tr key={event.id}>
                        <td>{event.tipo}</td>
                        <td>{event.canal}</td>
                        <td><StatusBadge status={mapImpactToBadge(event.impacto)} label={event.impacto} /></td>
                        <td>{event.horario}</td>
                        <td>{event.responsavel}</td>
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

        <PageSection title="Área de degradação" subtitle="Comunicação clara para operação em modo de atenção">
          <SectionCard title={healthV4MockData.degradation.titulo} subtitle="Orientações operacionais para continuidade">
            {isLoading && <LoadingState message="Carregando orientações simuladas..." />}
            {isError && (
              <ErrorState
                title="Falha simulada na área de degradação"
                description="Valide a área de fallback antes de integrar regras reais de indisponibilidade."
              />
            )}
            {!isLoading && !isError && forcedEmpty && (
              <EmptyState
                title="Sem orientações no momento"
                description="Quando houver degradação, esta área exibirá instruções de resposta operacional."
              />
            )}
            {!isLoading && !isError && !forcedEmpty && (
              <div className="v4-health-v4__degradation">
                <p>{healthV4MockData.degradation.descricao}</p>
                <ul>
                  {healthV4MockData.degradation.acoesSugeridas.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        </PageSection>
      </PageContainer>
    </PageShell>
  );
}
