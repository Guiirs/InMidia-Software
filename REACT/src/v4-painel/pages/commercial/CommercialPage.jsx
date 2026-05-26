import { memo, useState } from 'react';
import { PipelineOverview } from '../../components/commercial/index.js';
import { OpportunityBoard } from '../../components/commercial/index.js';
import { RevenueForecast } from '../../components/commercial/index.js';
import { CommercialPerformance } from '../../components/commercial/index.js';
import { SalesTargetsPanel } from '../../components/commercial/index.js';
import { CommercialInsights } from '../../components/commercial/index.js';
import CommercialProvider, { useCommercial } from '../../providers/CommercialProvider.jsx';
import './CommercialPage.css';

const SOURCE_LABEL = {
  real: 'DADOS REAIS',
  empty: 'SEM DADOS',
  stale: 'STALE',
  refreshing: 'ATUALIZANDO',
  error: 'ERRO',
  unauthorized: 'SEM SESSAO',
  forbidden: 'SEM PERMISSAO',
  offline: 'OFFLINE',
};

function CommercialSourceBadge({ source, loading }) {
  return (
    <span className={`v4p-comm-source v4p-comm-source--${source}`}>
      {loading ? 'CARREGANDO' : SOURCE_LABEL[source] ?? 'SEM DADOS'}
    </span>
  );
}

function CommercialStateNotice({ status, loading, empty, error, onRetry }) {
  if (loading) {
    return <div className="v4p-comm-state" role="status"><strong>Carregando dados comerciais reais...</strong></div>;
  }

  const messageByStatus = {
    unauthorized: 'Sessao expirada. Entre novamente para consultar o Comercial.',
    forbidden: 'Seu usuario nao possui permissao commercial.read para esta carteira.',
    offline: 'Voce esta offline. A tela nao exibira dados simulados.',
    error: error || 'Nao foi possivel carregar Comercial pela API V4.',
    stale: 'Dados antigos em exibicao enquanto a API V4 revalida o Comercial.',
  };
  const message = messageByStatus[status] ?? (empty ? 'Nenhuma oportunidade ou proposta comercial encontrada para este tenant.' : null);
  if (!message) return null;

  return (
    <div className={`v4p-comm-state v4p-comm-state--${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <strong>{message}</strong>
      {['error', 'offline', 'stale'].includes(status) && <button type="button" onClick={onRetry}>Atualizar</button>}
    </div>
  );
}

function CommercialPageInner() {
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [actionError, setActionError] = useState(null);
  const {
    commercial,
    loading,
    refreshing,
    stale,
    status,
    error,
    source,
    refresh,
    createOpportunity,
    updateOpportunity,
    changeOpportunityStage,
    createProposal,
    updateProposal,
    convertProposal,
    createActivity,
    mutations,
  } = useCommercial();

  const filteredOpportunities = commercial.opportunities.filter((opp) => {
    const matchesStage = stageFilter === 'all' || opp.stage === stageFilter || opp.status === stageFilter;
    const searchable = [opp.cliente, opp.regiao, opp.status, opp.stage, opp.id].filter(Boolean).join(' ').toLowerCase();
    return matchesStage && searchable.includes(query.trim().toLowerCase());
  });

  const empty = !loading
    && commercial.opportunities.length === 0
    && commercial.proposals.length === 0
    && commercial.pipeline.stages.length === 0;
  const actionLoading = Boolean(Object.values(mutations ?? {}).some((mutation) => mutation.loading));

  const runAction = async (action) => {
    setActionError(null);
    const selectedId = selectedOpportunity?.realId ?? selectedOpportunity?.id;
    try {
      if (action === 'create-opportunity') {
        await createOpportunity({
          clientName: 'Nova oportunidade V4',
          value: 0,
          stage: 'lead',
          status: 'lead',
          tags: ['manual'],
        });
      }
      if (action === 'update-opportunity' && selectedId) {
        await updateOpportunity({ id: selectedId, note: 'Atualizada pela CommercialPage V4' });
      }
      if (action === 'stage' && selectedId) {
        await changeOpportunityStage({ id: selectedId, stage: 'proposal' });
      }
      if (action === 'proposal' && selectedId) {
        await createProposal({ opportunityId: selectedId, value: selectedOpportunity.potencial ?? 0, status: 'draft' });
      }
      if (action === 'update-proposal' && commercial.proposals[0]?.id) {
        await updateProposal({ id: commercial.proposals[0].id, status: 'sent' });
      }
      if (action === 'convert' && commercial.proposals[0]?.id) {
        await convertProposal({ id: commercial.proposals[0].id, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
      }
      if (action === 'activity') {
        await createActivity({ type: 'note', opportunityId: selectedId, note: 'Atividade registrada pela CommercialPage V4' });
      }
      await refresh();
    } catch (err) {
      setActionError(err?.message ?? 'Falha ao executar acao comercial.');
    }
  };

  return (
    <div className="v4p-comm-page">
      <div className="v4p-comm-topline">
        <CommercialSourceBadge source={source} loading={loading || refreshing} />
        {(stale || status === 'offline') && (
          <span className="v4p-comm-source v4p-comm-source--stale">
            {status === 'offline' ? 'ULTIMO DADO VALIDO' : 'DADO EM REVALIDACAO'}
          </span>
        )}
        {error && (
          <div className="v4p-comm-error" role="status">
            <span>{error}</span>
            <button type="button" onClick={refresh}>Atualizar</button>
          </div>
        )}
      </div>

      <CommercialStateNotice status={status} loading={loading} empty={empty} error={error} onRetry={refresh} />

      <header className="v4p-comm-header">
        <div>
          <span className="v4p-comm-eyebrow">Comercial</span>
          <h1 className="v4p-comm-title">Pipeline e receita OOH</h1>
          <p className="v4p-comm-sub">Oportunidades, previsao de receita e prioridades da carteira comercial.</p>
        </div>
        <div className="v4p-comm-hero-stats">
          <article>
            <span>Pipeline</span>
            <strong>{commercial.hero.pipelineLabel}</strong>
          </article>
          <article>
            <span>Conversao</span>
            <strong>{commercial.hero.conversionLabel}</strong>
          </article>
          <article>
            <span>SLA proposta</span>
            <strong>{commercial.hero.slaLabel}</strong>
          </article>
        </div>
      </header>

      <section aria-labelledby="comm-actions">
        <div id="comm-actions" className="v4p-comm-label">Acoes comerciais</div>
        <div className="v4p-comm-actionbar">
          <button type="button" disabled={actionLoading} onClick={() => runAction('create-opportunity')}>Criar oportunidade</button>
          <button type="button" disabled={actionLoading || !selectedOpportunity} onClick={() => runAction('update-opportunity')}>Editar oportunidade</button>
          <button type="button" disabled={actionLoading || !selectedOpportunity} onClick={() => runAction('stage')}>Mover estagio</button>
          <button type="button" disabled={actionLoading || !selectedOpportunity} onClick={() => runAction('proposal')}>Criar proposta</button>
          <button type="button" disabled={actionLoading || commercial.proposals.length === 0} onClick={() => runAction('update-proposal')}>Editar proposta</button>
          <button type="button" disabled={actionLoading || commercial.proposals.length === 0} onClick={() => runAction('convert')}>Converter proposta</button>
          <button type="button" disabled={actionLoading} onClick={() => runAction('activity')}>Registrar atividade</button>
        </div>
        {(selectedOpportunity || actionError || actionLoading) && (
          <div className="v4p-comm-action-state" role={actionError ? 'alert' : 'status'}>
            {actionError ?? (actionLoading ? 'Executando mutation via Sync Core...' : `${selectedOpportunity.id} selecionada`)}
          </div>
        )}
      </section>

      <section aria-labelledby="comm-pipeline">
        <div id="comm-pipeline" className="v4p-comm-label">Pipeline executivo</div>
        <PipelineOverview stages={commercial.pipeline.stages} summary={commercial.pipeline.summary} />
      </section>

      <section aria-labelledby="comm-opp">
        <div id="comm-opp" className="v4p-comm-label">Quadro de oportunidades</div>
        <div className="v4p-comm-toolbar">
          <label>
            <span>Busca</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cliente, regiao ou estagio"
            />
          </label>
          <label>
            <span>Estagio</span>
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="lead">Lead</option>
              <option value="proposal">Proposta</option>
              <option value="negotiation">Negociacao</option>
              <option value="closing">Fechamento</option>
            </select>
          </label>
        </div>
        <OpportunityBoard opportunities={filteredOpportunities} onSelect={setSelectedOpportunity} />
      </section>

      <section aria-labelledby="comm-proposals">
        <div id="comm-proposals" className="v4p-comm-label">Propostas e conversoes</div>
        <div className="v4p-comm-mini-grid">
          <div className="v4p-surface-card v4p-medium-panel">
            <div className="v4p-card-title">Propostas</div>
            <div className="v4p-compact-list">
              {commercial.proposals.length === 0 && <div className="v4p-list-item__copy">Nenhuma proposta encontrada.</div>}
              {commercial.proposals.map((proposal) => (
                <div key={proposal.id} className="v4p-detail-row">
                  <span className="v4p-detail-row__label">{proposal.clientName ?? proposal.opportunityId ?? proposal.id}</span>
                  <span className="v4p-detail-row__value">{proposal.status ?? 'draft'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="v4p-surface-card v4p-medium-panel">
            <div className="v4p-card-title">Conversoes</div>
            <div className="v4p-compact-list">
              {commercial.conversions.length === 0 && <div className="v4p-list-item__copy">Nenhuma conversao encontrada.</div>}
              {commercial.conversions.map((conversion) => (
                <div key={conversion.id} className="v4p-detail-row">
                  <span className="v4p-detail-row__label">{conversion.proposalId ?? conversion.id}</span>
                  <span className="v4p-detail-row__value">{conversion.status ?? 'converted'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="comm-metrics">
        <div id="comm-metrics" className="v4p-comm-label">Receita e desempenho</div>
        <div className="v4p-comm-grid-main">
          <RevenueForecast forecast={commercial.revenueForecast} />
          <div className="v4p-comm-stack">
            <SalesTargetsPanel targets={commercial.salesTargets} pipelineSummary={commercial.pipeline.summary} />
            <CommercialPerformance
              regionalPerformance={commercial.regionalPerformance}
              sellersPerformance={commercial.sellersPerformance}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="comm-insights">
        <div id="comm-insights" className="v4p-comm-label">Inteligencia comercial</div>
        <CommercialInsights insights={commercial.insights} />
      </section>
    </div>
  );
}

function CommercialPage() {
  return (
    <CommercialProvider>
      <CommercialPageInner />
    </CommercialProvider>
  );
}

export default memo(CommercialPage);
