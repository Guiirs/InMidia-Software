import { memo, useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext.jsx';
import {
  getEmpresaDetails,
  updateEmpresaDetails,
} from '../../../services/empresaService.js';
import { fetchEmpresaData, regenerateApiKey } from '../../../services/index.js';
import './EmpresaSettingsV4.css';

/* ── Tabs ──────────────────────────────────────────────────────── */

const TABS = [
  { id: 'detalhes', label: 'Detalhes', icon: 'business' },
  { id: 'apikey',   label: 'API Key',  icon: 'key' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
];

/* ── Shared field component ──────────────────────────────────────── */

function Field({ label, error, children }) {
  return (
    <div className="v4p-empresa__field">
      <label className="v4p-empresa__label">{label}</label>
      {children}
      {error && <span className="v4p-empresa__field-error">{error}</span>}
    </div>
  );
}

/* ── Tab: Detalhes ───────────────────────────────────────────────── */

function TabDetalhes() {
  const queryClient = useQueryClient();
  const [form, setForm]     = useState(null);
  const [dirty, setDirty]   = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['empresa', 'details'],
    queryFn: getEmpresaDetails,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (data && !form) {
      setForm({
        nome:     data.nome     ?? '',
        cnpj:     data.cnpj     ?? '',
        endereco: data.endereco ?? '',
        bairro:   data.bairro   ?? '',
        cidade:   data.cidade   ?? '',
        telefone: data.telefone ?? '',
      });
    }
  }, [data, form]);

  const updateMutation = useMutation({
    mutationFn: updateEmpresaDetails,
    onSuccess: (updated) => {
      queryClient.setQueryData(['empresa', 'details'], updated);
      setDirty(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    },
  });

  const set = useCallback((key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!dirty || updateMutation.isPending) return;
    updateMutation.mutate(form);
  }, [dirty, form, updateMutation]);

  if (isLoading) {
    return (
      <div className="v4p-empresa__loading">
        <span className="material-symbols-rounded v4p-empresa__spin">sync</span>
        Carregando dados da empresa…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="v4p-empresa__error">
        <span className="material-symbols-rounded">error</span>
        {error?.message ?? 'Erro ao carregar dados da empresa.'}
      </div>
    );
  }

  if (!form) return null;

  return (
    <form className="v4p-empresa__form" onSubmit={handleSubmit} noValidate>
      <div className="v4p-empresa__form-grid">
        <Field label="Nome / Razão Social">
          <input
            className="v4p-empresa__input"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            disabled={updateMutation.isPending}
            required
          />
        </Field>

        <Field label="CNPJ">
          <input
            className="v4p-empresa__input"
            value={form.cnpj}
            onChange={(e) => set('cnpj', e.target.value)}
            disabled={updateMutation.isPending}
          />
        </Field>

        <Field label="Endereço" style={{ gridColumn: '1 / -1' }}>
          <input
            className="v4p-empresa__input"
            value={form.endereco}
            onChange={(e) => set('endereco', e.target.value)}
            disabled={updateMutation.isPending}
          />
        </Field>

        <Field label="Bairro">
          <input
            className="v4p-empresa__input"
            value={form.bairro}
            onChange={(e) => set('bairro', e.target.value)}
            disabled={updateMutation.isPending}
          />
        </Field>

        <Field label="Cidade">
          <input
            className="v4p-empresa__input"
            value={form.cidade}
            onChange={(e) => set('cidade', e.target.value)}
            disabled={updateMutation.isPending}
          />
        </Field>

        <Field label="Telefone">
          <input
            className="v4p-empresa__input"
            value={form.telefone}
            onChange={(e) => set('telefone', e.target.value)}
            disabled={updateMutation.isPending}
          />
        </Field>
      </div>

      {updateMutation.isError && (
        <div className="v4p-empresa__error" style={{ marginTop: 10 }}>
          {updateMutation.error?.message ?? 'Erro ao salvar.'}
        </div>
      )}

      <div className="v4p-empresa__form-footer">
        {saveOk && (
          <span className="v4p-empresa__save-ok">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>check_circle</span>
            Dados salvos com sucesso.
          </span>
        )}
        <button
          type="submit"
          className="v4p-empresa__btn-primary"
          disabled={!dirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}

/* ── Tab: API Key ──────────────────────────────────────────────────── */

function TabApiKey({ canManage }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword]       = useState('');
  const [newKey, setNewKey]           = useState(null);
  const [pwdError, setPwdError]       = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['empresa', 'apiKey'],
    queryFn: fetchEmpresaData,
    staleTime: 10 * 60_000,
  });

  const regenerateMutation = useMutation({
    mutationFn: (pwd) => regenerateApiKey(pwd),
    onSuccess: (response) => {
      setNewKey(response.fullApiKey);
      queryClient.setQueryData(['empresa', 'apiKey'], (old) => (
        old ? { ...old, api_key_prefix: response.newApiKeyPrefix } : old
      ));
      setConfirmOpen(false);
      setPassword('');
      setPwdError(null);
    },
    onError: (err) => {
      setPwdError(err.message ?? 'Senha incorreta ou erro ao regenerar.');
    },
  });

  const handleRegenerate = useCallback((e) => {
    e.preventDefault();
    if (!password.trim()) { setPwdError('Senha obrigatória.'); return; }
    regenerateMutation.mutate(password);
  }, [password, regenerateMutation]);

  if (isLoading) {
    return (
      <div className="v4p-empresa__loading">
        <span className="material-symbols-rounded v4p-empresa__spin">sync</span>
        Carregando gestão de API…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="v4p-empresa__error">
        {error?.message ?? 'Erro ao carregar dados de API.'}
      </div>
    );
  }

  return (
    <div className="v4p-empresa__section">
      <p className="v4p-empresa__desc">
        A API key permite que aplicações externas acessem dados da sua empresa.
        O segredo completo é exibido apenas no momento da geração.
      </p>

      <div className="v4p-empresa__info-row">
        <span className="v4p-empresa__info-label">Prefixo atual</span>
        <code className="v4p-empresa__code">
          {data?.api_key_prefix
            ? `${data.api_key_prefix}_${'*'.repeat(24)}`
            : 'Nenhuma chave gerada.'}
        </code>
      </div>

      {newKey && (
        <div className="v4p-empresa__new-key-box">
          <div className="v4p-empresa__new-key-label">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>key</span>
            Nova chave gerada — copie agora, não será exibida novamente:
          </div>
          <code className="v4p-empresa__code v4p-empresa__code--full">{newKey}</code>
          <button
            type="button"
            className="v4p-empresa__btn-secondary"
            onClick={() => { navigator.clipboard?.writeText(newKey); }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 13 }}>content_copy</span>
            Copiar
          </button>
          <button
            type="button"
            className="v4p-empresa__btn-ghost"
            onClick={() => setNewKey(null)}
          >
            Fechar
          </button>
        </div>
      )}

      {canManage && !newKey && (
        <div className="v4p-empresa__form-footer" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="v4p-empresa__btn-danger"
            onClick={() => { setConfirmOpen(true); setPwdError(null); setPassword(''); }}
            disabled={regenerateMutation.isPending}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>refresh</span>
            Regenerar API Key
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="v4p-empresa__confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}>
          <div className="v4p-empresa__confirm-dialog" role="dialog" aria-modal="true">
            <h3 className="v4p-empresa__confirm-title">Confirmar regeneração</h3>
            <p style={{ fontSize: 12.5, color: 'var(--v4p-text-3)', margin: '0 0 14px' }}>
              A chave antiga será invalidada imediatamente. Insira sua senha para confirmar.
            </p>
            <form onSubmit={handleRegenerate}>
              <Field label="Sua senha atual" error={pwdError}>
                <input
                  type="password"
                  className="v4p-empresa__input"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwdError(null); }}
                  autoComplete="current-password"
                  disabled={regenerateMutation.isPending}
                  autoFocus
                />
              </Field>
              <div className="v4p-empresa__form-footer" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="v4p-empresa__btn-ghost"
                  onClick={() => setConfirmOpen(false)}
                  disabled={regenerateMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="v4p-empresa__btn-danger"
                  disabled={regenerateMutation.isPending}
                >
                  {regenerateMutation.isPending ? 'Regenerando…' : 'Confirmar e regenerar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab: WhatsApp ──────────────────────────────────────────────── */

function TabWhatsApp() {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    import('../../../services/whatsappService.js')
      .then((mod) => mod.getWhatsAppStatus?.() ?? mod.default?.getWhatsAppStatus?.())
      .then((data) => { if (!cancelled) { setStatus(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="v4p-empresa__loading">
        <span className="material-symbols-rounded v4p-empresa__spin">sync</span>
        Verificando conexão WhatsApp…
      </div>
    );
  }

  if (error) {
    return (
      <div className="v4p-empresa__section">
        <p className="v4p-empresa__desc">
          Configure a integração WhatsApp Business para envio automático de relatórios
          de disponibilidade de placas.
        </p>
        <div className="v4p-empresa__error" style={{ marginTop: 12 }}>
          {error}
        </div>
      </div>
    );
  }

  const connected = status?.connected ?? status?.status === 'connected';

  return (
    <div className="v4p-empresa__section">
      <p className="v4p-empresa__desc">
        Configure a integração WhatsApp Business para envio automático de relatórios.
      </p>
      <div className="v4p-empresa__info-row">
        <span className="v4p-empresa__info-label">Status da conexão</span>
        <span
          className="v4p-empresa__status-badge"
          style={{ color: connected ? 'var(--v4p-success)' : 'var(--v4p-danger)' }}
        >
          <span
            className="v4p-empresa__status-dot"
            style={{ background: connected ? 'var(--v4p-success)' : 'var(--v4p-danger)' }}
          />
          {connected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
      {status?.phone && (
        <div className="v4p-empresa__info-row">
          <span className="v4p-empresa__info-label">Número</span>
          <code className="v4p-empresa__code">{status.phone}</code>
        </div>
      )}
      {status?.groupName && (
        <div className="v4p-empresa__info-row">
          <span className="v4p-empresa__info-label">Grupo configurado</span>
          <span style={{ fontSize: 12.5, color: 'var(--v4p-text-2)' }}>{status.groupName}</span>
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--v4p-text-4)' }}>
        Para configuração avançada, acesse as configurações completas em{' '}
        <a href="/empresa-settings/whatsapp" style={{ color: 'var(--v4p-accent)' }}>
          Configurações Legacy
        </a>.
      </div>
    </div>
  );
}

/* ── Main EmpresaSettingsV4 ──────────────────────────────────────── */

function EmpresaSettingsV4() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission?.('settings.manage') ?? false;

  const [activeTab, setActiveTab] = useState('detalhes');

  function renderTab() {
    switch (activeTab) {
      case 'detalhes': return <TabDetalhes />;
      case 'apikey':   return <TabApiKey canManage={canManage} />;
      case 'whatsapp': return <TabWhatsApp />;
      default:         return <TabDetalhes />;
    }
  }

  return (
    <div className="v4p-empresa">
      <header className="v4p-empresa__header">
        <div>
          <span className="v4p-empresa__eyebrow">Configurações</span>
          <h1>Empresa</h1>
          <p>Gerencie os dados e integrações da sua empresa.</p>
        </div>
      </header>

      <nav className="v4p-empresa__tabs" aria-label="Abas de configuração">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`v4p-empresa__tab${activeTab === tab.id ? ' v4p-empresa__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="v4p-empresa__content">
        {renderTab()}
      </div>
    </div>
  );
}

export default memo(EmpresaSettingsV4);
