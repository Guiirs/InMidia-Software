import { useMemo, useState } from 'react';

import {
  BoardCardGrid,
  EmptyState,
  ErrorState,
  FilterBar,
  FilterGroup,
  FilterSelect,
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
  boardPreviewStatesV4,
  boardStatusListV4,
  placasPayloadMockV4
} from './boardsPlacaPayloadMock';

import './BoardsPreviewV4.css';

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

export default function BoardsPreviewV4({ demoState = null }) {
  const [selectedState, setSelectedState] = useState('default');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [densityMode, setDensityMode] = useState('full');
  const [search, setSearch] = useState('');

  const hasGlobalState = Boolean(demoState);
  const visualState = hasGlobalState ? demoState : selectedState;
  const isLoading = visualState === 'loading';
  const isError = visualState === 'error';
  const forceEmpty = visualState === 'empty';

  const adaptedBoards = useMemo(() => {
    return mapPlacasToBoardCards(placasPayloadMockV4);
  }, []);

  const filteredBoards = useMemo(() => {
    return adaptedBoards.filter((item) => {
      const statusMatch = selectedStatus === 'todos' || item.status === selectedStatus;
      const haystack = [item.name, item.code, item.location, item.city, item.region, item.clientName].join(' ');
      const textMatch = !search || normalizeText(haystack).includes(normalizeText(search));
      return statusMatch && textMatch;
    });
  }, [adaptedBoards, search, selectedStatus]);

  const compact = densityMode === 'compact';
  const visibleBoards = forceEmpty ? [] : filteredBoards;
  const gridState = isLoading ? 'loading' : (isError ? 'error' : (visibleBoards.length === 0 ? 'empty' : 'default'));

  return (
    <PageShell className="v4-boards-preview-v4">
      <PageContainer maxWidth="xl">
        <PageHeader
          title="Boards Preview v4"
          subtitle="Cards de placas em camada isolada"
          description="Superfície de validação visual para a futura migração dos cards de placas sem tocar PlacasPage."
          actions={(
            <ToolbarActions
              secondary={<StatusBadge status="info" label="SOMENTE MOCK" />}
              primary={<StatusBadge status="warning" label="SEM INTEGRACAO REAL" />}
            />
          )}
        />

        <PageSection title="Filtros visuais" subtitle="Estado de exibição, status operacional e densidade do card">
          <FilterBar>
            <FilterGroup label="Busca operacional">
              <SearchInput
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Buscar código, localização, cidade ou cliente"
              />
            </FilterGroup>

            <FilterGroup label="Estado da tela">
              <FilterSelect
                value={visualState}
                options={boardPreviewStatesV4}
                onChange={(value) => {
                  if (!hasGlobalState) {
                    setSelectedState(value);
                  }
                }}
                placeholder="Exibição padrão"
                disabled={hasGlobalState}
              />
            </FilterGroup>

            <FilterGroup label="Status de placa">
              <FilterSelect
                value={selectedStatus}
                options={[{ value: 'todos', label: 'Todos' }, ...boardStatusListV4.map((status) => ({ value: status, label: status }))]}
                onChange={setSelectedStatus}
                placeholder="Todos"
              />
            </FilterGroup>

            <FilterGroup label="Densidade visual">
              <FilterSelect
                value={densityMode}
                options={[
                  { value: 'full', label: 'Cards completos' },
                  { value: 'compact', label: 'Cards compactos' }
                ]}
                onChange={setDensityMode}
                placeholder="Cards completos"
              />
            </FilterGroup>
          </FilterBar>
        </PageSection>

        <PageSection title="Resumo operacional" subtitle="Cobertura dos estados obrigatorios de card">
          <div className="v4-boards-preview-v4__status-row">
            {boardStatusListV4.map((status) => (
              <StatusBadge key={status} status="default" label={status} />
            ))}
          </div>
        </PageSection>

        <PageSection
          title={compact ? 'Grid compacto de placas' : 'Grid completo de placas'}
          subtitle="Visual enterprise para monitorar contexto comercial e operacional"
        >
          {isLoading && (
            <div className="v4-boards-preview-v4__state-banner">
              <LoadingState message="Carregando cards simulados..." />
            </div>
          )}

          {isError && (
            <div className="v4-boards-preview-v4__state-banner">
              <ErrorState
                title="Falha simulada de leitura"
                description="A visualização do grid permanece isolada para validação do protótipo v4."
              />
            </div>
          )}

          {!isLoading && !isError && visibleBoards.length === 0 && (
            <div className="v4-boards-preview-v4__state-banner">
              <EmptyState
                title="Sem placas para os filtros selecionados"
                description="Ajuste os filtros para restaurar o recorte visual do grid de cards."
              />
            </div>
          )}

          <BoardCardGrid
            items={visibleBoards}
            state={gridState}
            compact={compact}
          />
        </PageSection>
      </PageContainer>
    </PageShell>
  );
}
