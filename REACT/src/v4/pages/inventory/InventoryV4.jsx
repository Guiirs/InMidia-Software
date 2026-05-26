import { useMemo, useState } from 'react';

import {
  BoardCard,
  BoardCardGrid,
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
  StatusBadge,
  ToolbarActions
} from '../../components';
import { mapPlacasToBoardCards } from '../../adapters/boards';

import {
  inventoryMockPayloadV4,
  inventoryPreviewStatesV4,
  inventoryStatusListV4
} from './inventoryMockPayload';

import './InventoryV4.css';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function getAvailabilityGroup(status) {
  if (status === 'disponivel' || status === 'reservada') return 'comercial';
  if (status === 'ocupada' || status === 'vencendo') return 'ocupada';
  return 'restrita';
}

function buildUniqueOptions(items, label) {
  const values = Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [{ value: 'todos', label }, ...values.map((value) => ({ value, label: value }))];
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

function normalizeRegionOptions(rawRegions) {
  const safeList = Array.isArray(rawRegions) ? rawRegions : [];
  const options = safeList
    .map((item) => ({
      value: item?._id || item?.id || '',
      label: item?.nome || ''
    }))
    .filter((item) => item.value && item.label);

  return [{ value: 'todas', label: 'Todas as regiões' }, ...options];
}

export default function InventoryV4({
  mode = 'mock',
  demoState = null,
  inputPayload = inventoryMockPayloadV4,
  inputAlreadyAdapted = false,
  externalLoading = false,
  externalError = null,
  serverFilters = { regiao_id: 'todas', disponibilidade: 'todos', search: '' },
  onServerFilterChange = null,
  onServerSearchChange = null,
  regionOptionsRaw = [],
  pagination = { currentPage: 1, totalPages: 1, totalDocs: 0, limit: 10 },
  onPageChange = null,
  syncLabel = ''
}) {
  const isRealReadonly = mode === 'real-readonly';

  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('default');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [selectedRegion, setSelectedRegion] = useState('todos');
  const [selectedCity, setSelectedCity] = useState('todos');
  const [selectedAvailability, setSelectedAvailability] = useState('todos');
  const [densityMode, setDensityMode] = useState('full');

  const hasGlobalState = !isRealReadonly && Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;

  const adaptedBoards = useMemo(() => {
    if (inputAlreadyAdapted) {
      return Array.isArray(inputPayload) ? inputPayload : [];
    }

    return mapPlacasToBoardCards(inputPayload);
  }, [inputAlreadyAdapted, inputPayload]);

  const regionOptions = useMemo(() => {
    return buildUniqueOptions(adaptedBoards.map((item) => item.region), 'Todas as regiões');
  }, [adaptedBoards]);

  const regionOptionsReal = useMemo(() => {
    return normalizeRegionOptions(regionOptionsRaw);
  }, [regionOptionsRaw]);

  const cityOptions = useMemo(() => {
    return buildUniqueOptions(adaptedBoards.map((item) => item.city), 'Todas as cidades');
  }, [adaptedBoards]);

  const filteredBoards = useMemo(() => {
    return adaptedBoards.filter((item) => {
      const haystack = [item.name, item.code, item.location, item.city, item.region, item.clientName].join(' ');
      const bySearch = isRealReadonly || !search || normalizeText(haystack).includes(normalizeText(search));
      const byStatus = selectedStatus === 'todos' || item.status === selectedStatus;
      const byRegion = isRealReadonly || selectedRegion === 'todos' || item.region === selectedRegion;
      const byCity = selectedCity === 'todos' || item.city === selectedCity;
      const byAvailability = isRealReadonly || selectedAvailability === 'todos' || getAvailabilityGroup(item.status) === selectedAvailability;
      return bySearch && byStatus && byRegion && byCity && byAvailability;
    });
  }, [adaptedBoards, isRealReadonly, search, selectedStatus, selectedRegion, selectedCity, selectedAvailability]);

  const compact = densityMode === 'compact';
  const isLoading = isRealReadonly ? externalLoading : visualState === 'loading';
  const isError = isRealReadonly ? Boolean(externalError) : visualState === 'error';
  const forceEmpty = isRealReadonly ? false : visualState === 'empty';

  const visibleBoards = forceEmpty ? [] : filteredBoards;
  const gridState = isLoading ? 'loading' : (isError ? 'error' : (visibleBoards.length === 0 ? 'empty' : 'default'));

  const kpis = useMemo(() => {
    const base = forceEmpty ? [] : adaptedBoards;
    const total = base.length;
    const available = base.filter((item) => item.status === 'disponivel').length;
    const critical = base.filter((item) => ['indisponivel', 'vencendo', 'pendente'].includes(item.status)).length;
    const occupancyAvg = total > 0
      ? base.reduce((acc, item) => acc + Number(item.occupancy || 0), 0) / total
      : 0;

    return {
      total,
      available,
      critical,
      occupancyAvg
    };
  }, [adaptedBoards, forceEmpty]);

  const statusSummary = useMemo(() => {
    return inventoryStatusListV4.map((status) => ({
      status,
      count: visibleBoards.filter((item) => item.status === status).length
    }));
  }, [visibleBoards]);

  const firstCriticalCard = useMemo(() => {
    return visibleBoards.find((item) => ['indisponivel', 'vencendo', 'pendente'].includes(item.status)) || null;
  }, [visibleBoards]);

  const headerActions = (
    <ToolbarActions
      secondary={<StatusBadge status="info" label={isRealReadonly ? 'INVENTARIO V4 READ-ONLY' : 'INVENTARIO ISOLADO V4'} />}
      primary={<button type="button" className="v4-inventory-v4__button v4-inventory-v4__button--primary" disabled>Nova placa</button>}
      menu={<button type="button" className="v4-inventory-v4__button" disabled>Exportar</button>}
    />
  );

  const paginationButtons = useMemo(() => {
    if (!isRealReadonly) return [];

    const current = Number(pagination?.currentPage || 1);
    const total = Number(pagination?.totalPages || 1);
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);

    const pages = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [isRealReadonly, pagination]);

  return (
    <PageShell className="v4-inventory-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title="Inventario de placas v4"
          subtitle={isRealReadonly ? 'Leitura real dos ativos em modo somente visual' : 'Gestao visual dos ativos de midia em camada isolada'}
          description={isRealReadonly ? 'Bridge read-only ativa. Sem mutações, sem reorder, sem alteração de contratos de backend.' : 'Estrutura pronta para integração futura sem alterar PlacasPage, serviços reais ou fluxo operacional atual.'}
          actions={headerActions}
          metrics={<StatusBadge status="warning" label={syncLabel || (compact ? 'GRID COMPACTO' : 'GRID COMPLETO')} />}
        />

        <PageSection title="KPIs de inventário" subtitle="Leitura executiva para operação diária">
          <KPIGrid columns={4}>
            <KPICard label="Ativos mapeados" value={String(kpis.total)} change={isRealReadonly ? 'Base real paginada' : 'Base mock'} trend="neutral" />
            <KPICard label="Disponiveis" value={String(kpis.available)} change="Janela comercial" trend="up" />
            <KPICard label="Ocupação media" value={formatPercent(kpis.occupancyAvg)} change="Media operacional" trend="neutral" />
            <KPICard label="Cards críticos" value={String(kpis.critical)} change="Requer monitoramento" trend={kpis.critical > 0 ? 'down' : 'neutral'} />
          </KPIGrid>
        </PageSection>

        <PageSection title="Filtros visuais" subtitle="Busca operacional e segmentação para leitura de inventário">
          <FilterBar
            search={(
              <SearchInput
                onChange={(value) => {
                  if (isRealReadonly) {
                    onServerSearchChange && onServerSearchChange(value);
                    return;
                  }

                  setSearch(value);
                }}
                onClear={() => {
                  if (isRealReadonly) {
                    onServerSearchChange && onServerSearchChange('');
                    return;
                  }

                  setSearch('');
                }}
                value={isRealReadonly ? serverFilters.search : search}
                placeholder="Buscar por código, localização, cidade, região ou cliente"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Resultados ${visibleBoards.length}`} />}
                primary={<button type="button" className="v4-inventory-v4__button" disabled>Sincronizar</button>}
              />
            )}
          >
            <FilterGroup label="Estado da tela">
              {isRealReadonly ? (
                <StatusBadge status={isLoading ? 'warning' : (isError ? 'error' : 'success')} label={isLoading ? 'Carregando dados reais' : (isError ? 'Falha de leitura real' : 'Leitura real ativa')} />
              ) : (
                <FilterSelect
                  value={visualState}
                  options={inventoryPreviewStatesV4}
                  onChange={(value) => {
                    if (!hasGlobalState) {
                      setSelectedState(value);
                    }
                  }}
                  placeholder="Exibição padrão"
                  disabled={hasGlobalState}
                />
              )}
            </FilterGroup>

            <FilterGroup label="Status">
              <FilterSelect
                value={selectedStatus}
                options={[{ value: 'todos', label: 'Todos os status' }, ...inventoryStatusListV4.map((status) => ({ value: status, label: status }))]}
                onChange={setSelectedStatus}
                placeholder="Todos os status"
              />
            </FilterGroup>

            <FilterGroup label="Regiao">
              {isRealReadonly ? (
                <FilterSelect
                  value={serverFilters.regiao_id}
                  options={regionOptionsReal}
                  onChange={(value) => onServerFilterChange && onServerFilterChange('regiao_id', value)}
                  placeholder="Todas as regiões"
                />
              ) : (
                <FilterSelect
                  value={selectedRegion}
                  options={regionOptions}
                  onChange={setSelectedRegion}
                  placeholder="Todas as regiões"
                />
              )}
            </FilterGroup>

            <FilterGroup label="Disponibilidade">
              {isRealReadonly ? (
                <FilterSelect
                  value={serverFilters.disponibilidade}
                  options={[
                    { value: 'todos', label: 'Todos status' },
                    { value: 'true', label: 'Disponível' },
                    { value: 'false', label: 'Indisponível (Alugada)' },
                    { value: 'manutencao', label: 'Em Manutenção' }
                  ]}
                  onChange={(value) => onServerFilterChange && onServerFilterChange('disponibilidade', value)}
                  placeholder="Todos status"
                />
              ) : (
                <FilterSelect
                  value={selectedAvailability}
                  options={[
                    { value: 'todos', label: 'Todas as faixas' },
                    { value: 'comercial', label: 'Comercial disponivel' },
                    { value: 'ocupada', label: 'Comercial ocupada' },
                    { value: 'restrita', label: 'Comercial restrita' }
                  ]}
                  onChange={setSelectedAvailability}
                  placeholder="Todas as faixas"
                />
              )}
            </FilterGroup>

            <FilterGroup label="Cidade">
              <FilterSelect
                value={selectedCity}
                options={cityOptions}
                onChange={setSelectedCity}
                placeholder="Todas as cidades"
              />
            </FilterGroup>

            <FilterGroup label="Densidade">
              <FilterSelect
                value={densityMode}
                options={[
                  { value: 'full', label: 'Grid completo' },
                  { value: 'compact', label: 'Grid compacto' }
                ]}
                onChange={setDensityMode}
                placeholder="Grid completo"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="Resumo de status" subtitle="Distribuicao visivel por status operacional">
          <div className="v4-inventory-v4__status-row">
            {statusSummary.map((entry) => (
              <div key={entry.status} className="v4-inventory-v4__status-pill">
                <StatusBadge status="default" label={entry.status} />
                <span className="v4-inventory-v4__status-count">{entry.count}</span>
              </div>
            ))}
          </div>
        </PageSection>

        <PageSection title="Card critico em foco" subtitle="Leitura prioritaria para acompanhamento operacional">
          <div className="v4-inventory-v4__critical-wrap">
            {firstCriticalCard ? (
              <BoardCard board={firstCriticalCard} compact={compact} />
            ) : (
              <EmptyState
                title="Nenhum card critico no recorte atual"
                description="A combinação de filtros atual não retornou status com prioridade crítica."
              />
            )}
          </div>
        </PageSection>

        <PageSection
          title={compact ? 'Grid compacto de inventario' : 'Grid completo de inventario'}
          subtitle="Renderização com BoardCardGrid usando dados normalizados pelo boardAdapter"
        >
          {isLoading && (
            <div className="v4-inventory-v4__state-banner">
              <LoadingState message={isRealReadonly ? 'Carregando inventario real em modo read-only...' : 'Carregando inventario visual mock...'} />
            </div>
          )}

          {isError && (
            <div className="v4-inventory-v4__state-banner">
              <ErrorState
                title={isRealReadonly ? 'Falha de leitura do inventario real' : 'Falha simulada de leitura'}
                description={isRealReadonly ? String(externalError?.message || 'Não foi possível carregar placas reais no modo read-only.') : 'A estrutura da tela permanece pronta para integrar com serviços reais em fase futura.'}
              />
            </div>
          )}

          {!isLoading && !isError && visibleBoards.length === 0 && (
            <div className="v4-inventory-v4__state-banner">
              <EmptyState
                title="Sem placas para os filtros selecionados"
                description="Ajuste busca, status, regiao, disponibilidade ou cidade para ampliar o recorte."
              />
            </div>
          )}

          <BoardCardGrid items={visibleBoards} compact={compact} state={gridState} />
        </PageSection>

        {isRealReadonly && (
          <PageSection title="Paginação real" subtitle="Navegação server-side preservada da rota original de placas">
            <div className="v4-inventory-v4__pagination-wrap">
              <button
                type="button"
                className="v4-inventory-v4__button"
                onClick={() => onPageChange && onPageChange(Number(pagination.currentPage || 1) - 1)}
                disabled={isLoading || Number(pagination.currentPage || 1) <= 1}
              >
                &laquo; Anterior
              </button>

              <div className="v4-inventory-v4__pagination-pages">
                {paginationButtons.map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`v4-inventory-v4__page-button${Number(pagination.currentPage || 1) === page ? ' v4-inventory-v4__page-button--active' : ''}`}
                    onClick={() => onPageChange && onPageChange(page)}
                    disabled={isLoading || Number(pagination.currentPage || 1) === page}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="v4-inventory-v4__button"
                onClick={() => onPageChange && onPageChange(Number(pagination.currentPage || 1) + 1)}
                disabled={isLoading || Number(pagination.currentPage || 1) >= Number(pagination.totalPages || 1)}
              >
                Proxima &raquo;
              </button>
            </div>

            <p className="v4-inventory-v4__pagination-meta">
              Página {pagination.currentPage || 1} de {pagination.totalPages || 1} | Total de ativos: {pagination.totalDocs || 0}
            </p>
          </PageSection>
        )}

        <PageSection title="Área preparada para ações futuras" subtitle="Pontos reservados para fluxo operacional sem efeito nesta fase">
          <div className="v4-inventory-v4__future-actions">
            <button type="button" className="v4-inventory-v4__button" disabled>Nova placa</button>
            <button type="button" className="v4-inventory-v4__button" disabled>Exportar inventario</button>
            <button type="button" className="v4-inventory-v4__button" disabled>Sincronizar base</button>
          </div>
        </PageSection>
      </PageContainer>
    </PageShell>
  );
}
