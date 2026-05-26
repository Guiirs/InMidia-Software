import { useEffect, useMemo, useState } from 'react';

import {
  BoardCard,
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

import {
  mapAssetsV4,
  mapAvailabilityOptionsV4,
  mapCityOptionsV4,
  mapCitySummaryV4,
  mapClustersV4,
  mapDensityOptionsV4,
  mapHeaderV4,
  mapKpisV4,
  mapRegionOptionsV4,
  mapRegionSummaryV4,
  mapStateOptionsV4,
  mapStatusOptionsV4
} from './mapMockData';

import './MapV4.css';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function mapSummaryHealthToBadge(value) {
  if (value === 'stable') return 'success';
  if (value === 'watch') return 'warning';
  if (value === 'attention') return 'error';
  return 'default';
}

function mapAssetStatusToBadge(value) {
  if (value === 'disponivel') return 'success';
  if (value === 'ocupada') return 'warning';
  if (value === 'reservada') return 'info';
  if (value === 'manutencao') return 'error';
  return 'default';
}

export default function MapV4({ demoState = null }) {
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('default');
  const [selectedRegion, setSelectedRegion] = useState('todas');
  const [selectedCity, setSelectedCity] = useState('todas');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [selectedAvailability, setSelectedAvailability] = useState('todos');
  const [selectedDensity, setSelectedDensity] = useState('enterprise');
  const [selectedAssetId, setSelectedAssetId] = useState(mapAssetsV4[0]?.id || null);

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const filteredAssets = useMemo(() => {
    return mapAssetsV4.filter((asset) => {
      const haystack = [asset.name, asset.code, asset.location, asset.city, asset.region, asset.clientName].join(' ');
      const bySearch = !search || normalizeText(haystack).includes(normalizeText(search));
      const byRegion = selectedRegion === 'todas' || asset.regionId === selectedRegion;
      const byCity = selectedCity === 'todas' || asset.cityId === selectedCity;
      const byStatus = selectedStatus === 'todos' || asset.status === selectedStatus;
      const byAvailability = selectedAvailability === 'todos' || asset.availability === selectedAvailability;
      return bySearch && byRegion && byCity && byStatus && byAvailability;
    });
  }, [search, selectedRegion, selectedCity, selectedStatus, selectedAvailability]);

  const visibleAssets = forceEmpty ? [] : filteredAssets;

  useEffect(() => {
    if (!visibleAssets.length) {
      setSelectedAssetId(null);
      return;
    }

    const exists = visibleAssets.some((asset) => asset.id === selectedAssetId);
    if (!exists) {
      setSelectedAssetId(visibleAssets[0].id);
    }
  }, [visibleAssets, selectedAssetId]);

  const selectedAsset = useMemo(() => {
    if (!visibleAssets.length) return null;
    return visibleAssets.find((asset) => asset.id === selectedAssetId) || visibleAssets[0];
  }, [visibleAssets, selectedAssetId]);

  const nearbyAssets = useMemo(() => {
    if (!selectedAsset) return visibleAssets.slice(0, 3);

    return visibleAssets
      .filter((asset) => asset.id !== selectedAsset.id)
      .slice(0, 3);
  }, [selectedAsset, visibleAssets]);

  const visibleClusters = useMemo(() => {
    const activeIds = new Set(visibleAssets.map((asset) => asset.clusterId));

    return mapClustersV4.filter((cluster) => {
      const byRegion = selectedRegion === 'todas' || cluster.regionId === selectedRegion;
      const byCity = selectedCity === 'todas' || cluster.cityId === selectedCity;
      const byDensity = selectedDensity === 'cluster' || selectedDensity === 'enterprise' || selectedDensity === 'executiva';
      return activeIds.has(cluster.id) && byRegion && byCity && byDensity;
    });
  }, [visibleAssets, selectedRegion, selectedCity, selectedDensity]);

  const mapPanelActions = (
    <ToolbarActions
      secondary={<StatusBadge status="default" label={`Clusters ${visibleClusters.length}`} />}
      primary={<StatusBadge status="info" label={`Ativos ${visibleAssets.length}`} />}
    />
  );

  return (
    <PageShell className="v4-map-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title={mapHeaderV4.title}
          subtitle={mapHeaderV4.subtitle}
          description={mapHeaderV4.description}
          actions={(
            <ToolbarActions
              secondary={<StatusBadge status="info" label="MAPA VISUAL MOCKADO" />}
              primary={<StatusBadge status="warning" label="MODO ISOLADO V4" />}
            />
          )}
          metrics={<StatusBadge status="success" label="DENSIDADE ENTERPRISE" />}
        />

        <PageSection title="Filtros geográficos" subtitle="Recorte visual por território, comercialização e densidade operacional">
          <FilterBar
            search={(
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar ativo, codigo, endereco, cidade ou cliente"
              />
            )}
            actions={(
              <ToolbarActions
                secondary={<StatusBadge status="default" label={`Resultado ${visibleAssets.length}`} />}
                primary={<button type="button" className="v4-map-v4__button" disabled>Exportar recorte</button>}
              />
            )}
          >
            <FilterGroup label="Estado da tela">
              <FilterSelect
                value={visualState}
                options={mapStateOptionsV4}
                onChange={(value) => {
                  if (!hasGlobalState) {
                    setSelectedState(value);
                  }
                }}
                placeholder="Exibição padrão"
                disabled={hasGlobalState}
              />
            </FilterGroup>

            <FilterGroup label="Regiao">
              <FilterSelect
                value={selectedRegion}
                options={mapRegionOptionsV4}
                onChange={setSelectedRegion}
                placeholder="Todas as regiões"
              />
            </FilterGroup>

            <FilterGroup label="Cidade">
              <FilterSelect
                value={selectedCity}
                options={mapCityOptionsV4}
                onChange={setSelectedCity}
                placeholder="Todas as cidades"
              />
            </FilterGroup>

            <FilterGroup label="Status">
              <FilterSelect
                value={selectedStatus}
                options={mapStatusOptionsV4}
                onChange={setSelectedStatus}
                placeholder="Todos os status"
              />
            </FilterGroup>

            <FilterGroup label="Disponibilidade">
              <FilterSelect
                value={selectedAvailability}
                options={mapAvailabilityOptionsV4}
                onChange={setSelectedAvailability}
                placeholder="Todas as faixas"
              />
            </FilterGroup>

            <FilterGroup label="Densidade">
              <FilterSelect
                value={selectedDensity}
                options={mapDensityOptionsV4}
                onChange={setSelectedDensity}
                placeholder="Enterprise"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="KPIs geograficos" subtitle="Leitura executiva de cobertura, disponibilidade e pressao operacional">
          <KPIGrid columns={4}>
            {mapKpisV4.map((kpi) => (
              <KPICard key={kpi.id} label={kpi.label} value={kpi.value} change={kpi.change} trend={kpi.trend} />
            ))}
          </KPIGrid>
        </PageSection>

        <PageSection title="Mapa de cobertura visual" subtitle="Simulação de clusters e ativos sem dependência de mapa real">
          <SectionCard
            title="Plano geografico"
            subtitle="Painel visual para leitura de distribuicao e prioridade de ativos"
            actions={mapPanelActions}
          >
            {isLoading && (
              <div className="v4-map-v4__state-banner">
                <LoadingState message="Carregando malha geográfica simulada..." />
              </div>
            )}

            {isError && (
              <div className="v4-map-v4__state-banner">
                <ErrorState
                  title="Falha simulada na camada geográfica"
                  description="Retorne para demoState='default' para validar a composicao visual do mapa de cobertura."
                />
              </div>
            )}

            {!isLoading && !isError && visibleAssets.length === 0 && (
              <div className="v4-map-v4__state-banner">
                <EmptyState
                  title="Nenhum ativo no recorte atual"
                  description="Ajuste os filtros para exibir clusters, pins e indicadores geograficos novamente."
                />
              </div>
            )}

            {!isLoading && !isError && visibleAssets.length > 0 && (
              <div className="v4-map-v4__layout">
                <div className="v4-map-v4__map-panel" role="presentation" aria-label="Mapa visual simulado">
                  <div className="v4-map-v4__map-headline">
                    <StatusBadge status="info" label={`Densidade ${selectedDensity}`} />
                    <StatusBadge status="success" label={`${visibleAssets.length} ativos visiveis`} />
                  </div>

                  <div className="v4-map-v4__map-surface">
                    {visibleClusters.map((cluster) => (
                      <div
                        key={cluster.id}
                        className="v4-map-v4__cluster"
                        style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}
                        title={cluster.label}
                      >
                        <span>{cluster.label}</span>
                      </div>
                    ))}

                    {visibleAssets.map((asset) => {
                      const isActive = selectedAsset?.id === asset.id;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          className={`v4-map-v4__pin${isActive ? ' v4-map-v4__pin--active' : ''}`}
                          style={{ left: `${asset.x}%`, top: `${asset.y}%` }}
                          onClick={() => setSelectedAssetId(asset.id)}
                          aria-label={`Selecionar ${asset.code}`}
                        >
                          <span className="v4-map-v4__pin-dot" />
                          <span className="v4-map-v4__pin-label">{asset.code}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="v4-map-v4__side-panel">
                  <ContentCard>
                    <div className="v4-map-v4__asset-header">
                      <div>
                        <p className="v4-map-v4__asset-eyebrow">Ativo selecionado</p>
                        <h3 className="v4-map-v4__asset-title">{selectedAsset?.name || 'Sem ativo selecionado'}</h3>
                      </div>
                      <StatusBadge
                        status={mapAssetStatusToBadge(selectedAsset?.status)}
                        label={selectedAsset?.status || 'sem status'}
                      />
                    </div>

                    {selectedAsset ? (
                      <div className="v4-map-v4__asset-meta">
                        <p>{selectedAsset.location}</p>
                        <p>{selectedAsset.city} | {selectedAsset.region}</p>
                        <p>Audiencia {selectedAsset.audience}</p>
                        <p>Fluxo estimado {selectedAsset.flow}</p>
                        <p>Ticket de referencia R$ {Number(selectedAsset.referencePrice).toLocaleString('pt-BR')}</p>
                        <p>Coordenadas {selectedAsset.lat}, {selectedAsset.lng}</p>
                      </div>
                    ) : (
                      <EmptyState
                        title="Sem ativo em foco"
                        description="Selecione um pin no mapa para abrir o detalhamento lateral."
                      />
                    )}
                  </ContentCard>

                  <SectionCard title="Ativos próximos" subtitle="Cards compactos para triagem rápida">
                    <div className="v4-map-v4__nearby-grid">
                      {nearbyAssets.length > 0 ? nearbyAssets.map((asset) => (
                        <BoardCard key={asset.id} board={asset} compact />
                      )) : (
                        <EmptyState
                          title="Sem ativos próximos"
                          description="Amplie o recorte para exibir ativos no entorno do item selecionado."
                        />
                      )}
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}
          </SectionCard>
        </PageSection>

        <PageSection title="Resumo por territorio" subtitle="Consolidado executivo por regiao e cidade">
          <div className="v4-map-v4__summary-grid">
            <SectionCard title="Resumo por regiao" subtitle="Leitura estrategica da cobertura macro">
              <div className="v4-map-v4__summary-list">
                {mapRegionSummaryV4.map((item) => (
                  <ContentCard key={item.id}>
                    <div className="v4-map-v4__summary-item">
                      <div>
                        <strong>{item.scope}</strong>
                        <p>{item.assets} ativos | Ocupação {item.occupancy}</p>
                        <p>Ticket médio {item.averageTicket}</p>
                      </div>
                      <StatusBadge status={mapSummaryHealthToBadge(item.health)} label={item.health} />
                    </div>
                  </ContentCard>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Resumo por cidade" subtitle="Prioridades comerciais por polo urbano">
              <div className="v4-map-v4__summary-list">
                {mapCitySummaryV4.map((item) => (
                  <ContentCard key={item.id}>
                    <div className="v4-map-v4__summary-item">
                      <div>
                        <strong>{item.scope}</strong>
                        <p>{item.assets} ativos | Ocupação {item.occupancy}</p>
                        <p>Ticket médio {item.averageTicket}</p>
                      </div>
                      <StatusBadge status={mapSummaryHealthToBadge(item.health)} label={item.health} />
                    </div>
                  </ContentCard>
                ))}
              </div>
            </SectionCard>
          </div>
        </PageSection>
      </PageContainer>
    </PageShell>
  );
}
