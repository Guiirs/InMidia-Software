import { memo, useState } from 'react';
import { ContractsTable } from '../../components/contracts/index.js';
import { ContractRiskPanel } from '../../components/contracts/index.js';
import { RenewalOpportunities } from '../../components/contracts/index.js';
import { ContractTimeline } from '../../components/contracts/index.js';
import { ContractStatusCard } from '../../components/contracts/index.js';
import { FinancialImpactPanel } from '../../components/contracts/index.js';
import ContractsProvider, { useContracts } from '../../providers/ContractsProvider.jsx';
import './ContractsPage.css';

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

function ContractsSourceBadge({ source, loading }) {
  return (
    <span className={`v4p-ctr-source v4p-ctr-source--${source}`}>
      {loading ? 'CARREGANDO' : SOURCE_LABEL[source] ?? 'SEM DADOS'}
    </span>
  );
}

function ContractsStateNotice({ status, loading, empty, error, onRetry }) {
  if (loading) {
    return (
      <div className="v4p-ctr-state" role="status">
        <strong>Carregando contratos reais...</strong>
      </div>
    );
  }

  const messageByStatus = {
    unauthorized: 'Sessao expirada. Entre novamente para consultar contratos.',
    forbidden: 'Seu usuario nao possui permissao contracts.read para esta carteira.',
    offline: 'Voce esta offline. A tela manteve o ultimo estado valido quando disponivel.',
    error: error || 'Nao foi possivel carregar contratos pela API V4.',
    stale: 'Dados antigos em exibicao enquanto a API V4 revalida a carteira.',
  };

  const message = messageByStatus[status] ?? (empty ? 'Nenhum contrato encontrado para este tenant.' : null);
  if (!message) return null;

  return (
    <div className={`v4p-ctr-state v4p-ctr-state--${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <strong>{message}</strong>
      {['error', 'offline', 'stale'].includes(status) && (
        <button type="button" onClick={onRetry}>Atualizar</button>
      )}
    </div>
  );
}

function ContractsPageInner() {
  const [selectedContract, setSelectedContract] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState(null);
  const {
    contracts,
    summary,
    financialImpact,
    renewalOpportunities,
    timeline,
    loading,
    refreshing,
    stale,
    status,
    error,
    source,
    refresh,
    changeContractStatus,
    cancelContract,
    renewContract,
    mutations,
  } = useContracts();

  const fmt = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);

  const filteredContracts = contracts.filter((contract) => {
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    const searchable = [
      contract.id,
      contract.code,
      contract.cliente,
      contract.campanha,
      contract.regiao,
      contract.boardCode,
    ].filter(Boolean).join(' ').toLowerCase();
    return matchesStatus && searchable.includes(query.trim().toLowerCase());
  });

  const empty = !loading && contracts.length === 0;
  const actionLoading = Boolean(
    mutations?.statusChange?.loading
    || mutations?.cancel?.loading
    || mutations?.renew?.loading
  );

  const selectedId = selectedContract?.realId ?? selectedContract?.id;

  const runContractAction = async (action) => {
    if (!selectedId) return;
    setActionError(null);
    try {
      if (action === 'activate') {
        await changeContractStatus({ id: selectedId, status: 'active' });
      }
      if (action === 'cancel') {
        await cancelContract({ id: selectedId, reason: 'Cancelado pela tela V4 de contratos' });
      }
      if (action === 'renew') {
        const base = selectedContract.vencimento ? new Date(selectedContract.vencimento) : new Date();
        base.setDate(base.getDate() + 30);
        await renewContract({ id: selectedId, newEndDate: base.toISOString() });
      }
      await refresh();
    } catch (err) {
      setActionError(err?.message ?? 'Falha ao executar acao de contrato.');
    }
  };

  return (
    <div className="v4p-ctr-page">
      <div className="v4p-ctr-topline">
        <ContractsSourceBadge source={source} loading={loading || refreshing} />
        {(stale || status === 'offline') && (
          <span className="v4p-ctr-source v4p-ctr-source--stale">
            {status === 'offline' ? 'ULTIMO DADO VALIDO' : 'DADO EM REVALIDACAO'}
          </span>
        )}
        {error && (
          <div className="v4p-ctr-error" role="status">
            <span>{error}</span>
            <button type="button" onClick={refresh}>Atualizar</button>
          </div>
        )}
      </div>

      <ContractsStateNotice
        status={status}
        loading={loading}
        empty={empty}
        error={error}
        onRetry={refresh}
      />

      <header className="v4p-ctr-header">
        <div>
          <span className="v4p-ctr-eyebrow">Contratos</span>
          <h1 className="v4p-ctr-title">Carteira contratual ativa</h1>
          <p className="v4p-ctr-sub">Renovacoes, risco financeiro e vencimentos da operacao OOH.</p>
        </div>
        <div className="v4p-ctr-hero-stats">
          <article>
            <span>Ativos</span>
            <strong>{summary.ativos}</strong>
          </article>
          <article>
            <span>Vencendo</span>
            <strong>{summary.vencendoEm30Dias}</strong>
          </article>
          <article>
            <span>Comprometido</span>
            <strong>{fmt(summary.receitaComprometida)}/mes</strong>
          </article>
        </div>
        {selectedContract && (
          <div className="v4p-ctr-selection">
            <span className="v4p-mono">{selectedContract.id}</span>
            <strong>selecionado</strong>
            <button type="button" disabled={actionLoading} onClick={() => runContractAction('activate')}>Ativar</button>
            <button type="button" disabled={actionLoading} onClick={() => runContractAction('renew')}>Renovar</button>
            <button type="button" disabled={actionLoading} onClick={() => runContractAction('cancel')}>Cancelar</button>
            <button type="button" className="material-symbols-rounded" onClick={() => setSelectedContract(null)} aria-label="Limpar contrato selecionado">close</button>
          </div>
        )}
      </header>

      {(actionError || actionLoading) && (
        <div className="v4p-ctr-action-state" role={actionError ? 'alert' : 'status'}>
          {actionError ?? 'Executando mutation via Sync Core...'}
        </div>
      )}

      <section aria-labelledby="ctr-kpi">
        <div id="ctr-kpi" className="v4p-ctr-label">Visao geral</div>
        <ContractStatusCard summary={summary} />
      </section>

      <section aria-labelledby="ctr-table">
        <div id="ctr-table" className="v4p-ctr-label">Carteira de contratos</div>
        <div className="v4p-ctr-toolbar">
          <label>
            <span>Busca</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cliente, campanha, regiao ou placa"
            />
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="expiring">Vencendo</option>
              <option value="expired">Encerrados</option>
              <option value="paused">Cancelados</option>
              <option value="draft">Rascunhos</option>
            </select>
          </label>
        </div>
        <ContractsTable contracts={filteredContracts} onSelect={setSelectedContract} />
      </section>

      <section aria-labelledby="ctr-risk">
        <div id="ctr-risk" className="v4p-ctr-label">Riscos e impacto financeiro</div>
        <div className="v4p-ctr-grid">
          <ContractRiskPanel contracts={contracts} />
          <FinancialImpactPanel impact={financialImpact} summary={summary} />
        </div>
      </section>

      <section aria-labelledby="ctr-renew">
        <div id="ctr-renew" className="v4p-ctr-label">Oportunidades de renovacao</div>
        <RenewalOpportunities opportunities={renewalOpportunities} />
      </section>

      <section aria-labelledby="ctr-timeline">
        <div id="ctr-timeline" className="v4p-ctr-label">Timeline de contratos</div>
        <ContractTimeline timeline={timeline} />
      </section>
    </div>
  );
}

function ContractsPage() {
  return (
    <ContractsProvider>
      <ContractsPageInner />
    </ContractsProvider>
  );
}

export default memo(ContractsPage);
