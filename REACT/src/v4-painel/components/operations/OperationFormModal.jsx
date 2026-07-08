import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSyncResource } from '../../../core/sync-core/hooks/useSyncResource.js';
import './OperationFormModal.css';

const OPERATION_TYPES = [
  { value: 'SCRAPING', label: 'Raspagem', icon: 'cleaning_services' },
  { value: 'CLEANING', label: 'Limpeza', icon: 'cleaning_services' },
  { value: 'REMOVAL', label: 'Retirada', icon: 'remove_circle_outline' },
  { value: 'MAINTENANCE', label: 'Manutenção', icon: 'build' },
  { value: 'BLOCK', label: 'Bloqueio operacional', icon: 'block' },
  { value: 'BLOCKING', label: 'Bloqueio de placa', icon: 'block' },
  { value: 'CRITICAL', label: 'Operação crítica', icon: 'crisis_alert' },
  { value: 'INSPECTION', label: 'Inspeção', icon: 'search' },
  { value: 'OTHER', label: 'Outro', icon: 'more_horiz' },
];

// INSTALLATION temporariamente desabilitada por decisão de produto.
// Mantida aqui somente para title/label lookup em operações existentes.
const ALL_OPERATION_TYPES = [
  { value: 'INSTALLATION', label: 'Instalação', icon: 'install_desktop' },
  ...OPERATION_TYPES,
];

const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Crítica' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'LOW', label: 'Baixa' },
];

const REASON_REQUIRED_TYPES = new Set(['BLOCK', 'BLOCKING', 'MAINTENANCE']);
const BOARD_STATUS_LABELS = {
  available: 'Disponível',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  maintenance: 'Em manutenção',
  critical: 'Crítica',
};

const REASON_LABEL = {
  BLOCK: 'Motivo do bloqueio',
  BLOCKING: 'Motivo do bloqueio',
  MAINTENANCE: 'Motivo da manutenção',
};

const EMPTY_FORM = {
  operationType: 'MAINTENANCE',
  plateId: '',
  plateCode: '',
  scheduledAt: '',
  dueAt: '',
  priority: 'MEDIUM',
  assignedTo: '',
  teamId: '',
  notes: '',
  reason: '',
  newAddress: '',
  newLatitude: '',
  newLongitude: '',
};

function Field({ id, label, required, error, children }) {
  return (
    <div className="v4p-op-modal__field">
      <label className="v4p-op-modal__label" htmlFor={id}>
        {label}
        {required && <span className="v4p-op-modal__required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && <span className="v4p-op-modal__error" role="alert">{error}</span>}
    </div>
  );
}

function validate(form) {
  const errors = {};
  if (!form.operationType) errors.operationType = 'Tipo obrigatório.';
  if (form.operationType !== 'INSTALLATION' && !form.plateId.trim()) {
    errors.plateId = 'Selecione uma placa para criar a operação.';
  }
  if (!form.priority) errors.priority = 'Prioridade obrigatória.';
  if (REASON_REQUIRED_TYPES.has(form.operationType) && !form.reason.trim()) {
    errors.reason = `${REASON_LABEL[form.operationType]} é obrigatório para este tipo de operação.`;
  }
  if (form.newLatitude && !form.newLongitude) errors.newLongitude = 'Informe a longitude.';
  if (form.newLongitude && !form.newLatitude) errors.newLatitude = 'Informe a latitude.';
  if (form.dueAt && form.scheduledAt && form.dueAt < form.scheduledAt) {
    errors.dueAt = 'Prazo não pode ser anterior ao agendamento.';
  }
  return errors;
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function boardView(board) {
  const code = board.codigo ?? board.numero_placa ?? 'Sem código';
  const address = board.endereco ?? board.localizacao ?? board.nomeDaRua ?? 'Localização não informada';
  const city = board.cidade ?? board.city ?? board.regiao?.city ?? board.regiao?.cidade ?? '';
  const region = typeof board.regiao === 'string' ? board.regiao : board.regiao?.nome ?? '';
  const block = board.operationalBlock ?? board.commercialProjection?.operationalBlock ?? null;
  const blocked = Boolean(block && block.blocked !== false);
  const status = (blocked ? block?.label : null) ?? BOARD_STATUS_LABELS[board.status] ?? board.statusOperacional ?? '';

  return {
    id: String(board.id ?? board._id ?? ''),
    code: String(code),
    address: String(address),
    city: String(city),
    region: String(region),
    status: String(status),
    blocked,
    searchText: normalizeSearchText([code, address, city, region].join(' ')),
  };
}

function BoardSelector({ value, onChange, error, open, refreshOnNotFound }) {
  const boardsResource = useSyncResource('inventory.boards');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [selectionWarning, setSelectionWarning] = useState('');
  const deferredQuery = useDeferredValue(query);
  const containerRef = useRef(null);

  const boards = useMemo(() => (
    Array.isArray(boardsResource.data)
      ? boardsResource.data.map(boardView).filter((board) => board.id)
      : []
  ), [boardsResource.data]);

  const selected = useMemo(() => boards.find((board) => board.id === value) ?? null, [boards, value]);
  const filteredBoards = useMemo(() => {
    const normalizedQuery = normalizeSearchText(deferredQuery);
    if (!normalizedQuery) return boards;
    return boards.filter((board) => board.searchText.includes(normalizedQuery));
  }, [boards, deferredQuery]);

  useEffect(() => {
    if (open && boardsResource.isStale) {
      boardsResource.refresh({ reason: 'operation-form-open-stale-boards' });
    }
  }, [boardsResource.isStale, boardsResource.refresh, open]);

  useEffect(() => {
    if (refreshOnNotFound) {
      boardsResource.refresh({ reason: 'operation-form-board-not-found' });
    }
  }, [boardsResource.refresh, refreshOnNotFound]);

  useEffect(() => {
    if (!value || boardsResource.status !== 'success') return;
    const current = boards.find((board) => board.id === value);
    if (current && !current.blocked) return;
    onChange('', '');
    setSelectionWarning(current?.blocked
      ? 'Esta placa já possui uma operação em aberto. Selecione outra placa.'
      : 'A placa selecionada não está mais disponível. Atualize a lista e selecione novamente.');
  }, [boards, boardsResource.status, onChange, value]);

  useEffect(() => {
    if (!expanded) return;
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setExpanded(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [expanded]);

  function selectBoard(board) {
    if (board.blocked) return;
    onChange(board.id, board.code);
    setSelectionWarning('');
    setQuery('');
    setExpanded(false);
  }

  const loading = boardsResource.status === 'idle' || boardsResource.status === 'loading';
  const failed = ['error', 'offline', 'forbidden', 'unauthorized'].includes(boardsResource.status);
  const visibleValue = expanded ? query : selected ? `${selected.code} · ${selected.address}` : query;

  return (
    <div className="v4p-op-modal__board-selector" ref={containerRef}>
      <div className={`v4p-op-modal__combobox${error ? ' is-invalid' : ''}`}>
        <span className="material-symbols-rounded" aria-hidden="true">search</span>
        <input
          id="opform-plateId"
          className="v4p-op-modal__board-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="opform-plate-options"
          aria-expanded={expanded}
          aria-invalid={Boolean(error)}
          value={visibleValue}
          onFocus={() => {
            setQuery('');
            setExpanded(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange('', '');
            setExpanded(true);
          }}
          placeholder="Buscar por código, endereço, cidade ou região"
          autoComplete="off"
        />
        {selected && !expanded && (
          <button type="button" className="v4p-op-modal__board-clear" onClick={() => onChange('', '')} aria-label="Limpar placa selecionada">
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className="v4p-op-modal__board-popover">
          {loading ? (
            <p className="v4p-op-modal__board-state" role="status">Carregando placas...</p>
          ) : failed ? (
            <div className="v4p-op-modal__board-state" role="alert">
              <span>Não foi possível carregar as placas. Tente novamente.</span>
              <button type="button" onClick={() => boardsResource.refresh({ reason: 'operation-form-board-retry' })}>Atualizar lista</button>
            </div>
          ) : boards.length === 0 ? (
            <p className="v4p-op-modal__board-state">Nenhuma placa cadastrada no inventário.</p>
          ) : filteredBoards.length === 0 ? (
            <p className="v4p-op-modal__board-state">Nenhuma placa encontrada para esta busca.</p>
          ) : (
            <>
              <ul id="opform-plate-options" className="v4p-op-modal__board-options" role="listbox" aria-label="Placas cadastradas">
                {filteredBoards.map((board) => (
                  <li key={board.id} role="option" aria-selected={board.id === value} aria-disabled={board.blocked}>
                    <button type="button" disabled={board.blocked} onClick={() => selectBoard(board)}>
                      <span className="v4p-op-modal__board-option-main">
                        <strong>Placa {board.code}</strong>
                        <span>{board.address}</span>
                      </span>
                      <span className="v4p-op-modal__board-option-meta">
                        {[board.city, board.region].filter(Boolean).join(' · ') || 'Região não informada'}
                        {board.status && <em className={board.blocked ? 'is-blocked' : ''}>{board.status}</em>}
                      </span>
                      {board.blocked && <small>Esta placa já possui uma operação em aberto.</small>}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="v4p-op-modal__board-refresh"
                onClick={() => boardsResource.refresh({ reason: 'operation-form-board-manual-refresh' })}
              >
                Atualizar lista
              </button>
            </>
          )}
        </div>
      )}

      {!expanded && loading && <p className="v4p-op-modal__board-hint" role="status">Carregando placas...</p>}
      {!expanded && failed && <p className="v4p-op-modal__board-hint is-error">Não foi possível carregar as placas. Tente novamente.</p>}
      {!expanded && !loading && !failed && boards.length === 0 && <p className="v4p-op-modal__board-hint">Nenhuma placa cadastrada no inventário.</p>}
      {selectionWarning && <p className="v4p-op-modal__board-hint is-error" role="alert">{selectionWarning}</p>}
    </div>
  );
}

function TeamSelector({ value, onChange, error }) {
  const teamsResource = useSyncResource('operations.teams');

  const activeTeams = useMemo(() => (
    Array.isArray(teamsResource.data)
      ? teamsResource.data.filter((team) => (team.status ?? 'ACTIVE') === 'ACTIVE')
      : []
  ), [teamsResource.data]);

  return (
    <select
      id="opform-teamId"
      className={`v4p-op-modal__select${error ? ' is-invalid' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Nenhuma equipe</option>
      {activeTeams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name} — {team.memberCount} {team.memberCount === 1 ? 'pessoa' : 'pessoas'}
        </option>
      ))}
    </select>
  );
}

const SAFE_DEFAULT_TYPE = 'MAINTENANCE';

function OperationFormModal({ open, onClose, onSave, saving = false, initialType, serverError = null }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    operationType: (initialType && initialType !== 'INSTALLATION') ? initialType : SAFE_DEFAULT_TYPE,
  }));
  const [errors, setErrors] = useState({});
  const firstRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, operationType: (initialType && initialType !== 'INSTALLATION') ? initialType : SAFE_DEFAULT_TYPE });
      setErrors({});
      const id = requestAnimationFrame(() => firstRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open, initialType]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (['OPERATION_BOARD_NOT_FOUND', 'PLATE_OPERATION_ALREADY_OPEN'].includes(serverError?.code)) {
      setForm((prev) => ({ ...prev, plateId: '', plateCode: '' }));
    }
  }, [serverError?.code]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  function setPlate(plateId, plateCode = '') {
    setForm((prev) => ({ ...prev, plateId, plateCode }));
    if (errors.plateId) setErrors((prev) => { const next = { ...prev }; delete next.plateId; return next; });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const payload = {
      operationType: form.operationType,
      priority: form.priority,
      ...(form.operationType !== 'INSTALLATION' && form.plateId.trim() ? { plateId: form.plateId.trim() } : {}),
      ...(form.scheduledAt ? { scheduledAt: form.scheduledAt } : {}),
      ...(form.dueAt ? { dueAt: form.dueAt, slaDueAt: form.dueAt } : {}),
      ...(form.assignedTo.trim() ? { assignedTo: form.assignedTo.trim() } : {}),
      ...(form.teamId ? { teamId: form.teamId } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
      ...(form.operationType === 'INSTALLATION' && form.newAddress.trim()
        ? { newAddress: form.newAddress.trim() } : {}),
      ...(form.operationType === 'INSTALLATION' && form.newLatitude && form.newLongitude
        ? { newLatitude: Number(form.newLatitude), newLongitude: Number(form.newLongitude) } : {}),
      title: buildTitle(form),
      domain: 'operations',
    };

    await onSave(payload);
  }

  if (!open) return null;

  const isInstallation = form.operationType === 'INSTALLATION';
  const needsReason = REASON_REQUIRED_TYPES.has(form.operationType);
  const reasonLabel = REASON_LABEL[form.operationType] ?? 'Motivo';

  // Erro do servidor: destaca o campo correspondente (se houver) além do banner no topo do modal
  const fieldErrors = serverError?.field
    ? { ...errors, [serverError.field]: serverError.fieldMessage ?? errors[serverError.field] }
    : errors;

  return createPortal(
    <div className="v4p-op-modal__backdrop" data-testid="operation-form-modal-redesigned" role="dialog" aria-modal="true" aria-label="Nova operação"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="v4p-op-modal__dialog">
        <header className="v4p-op-modal__header">
          <div>
            <span className="v4p-op-modal__eyebrow">Rotina operacional</span>
            <h2 className="v4p-op-modal__title">Nova operação</h2>
            <p className="v4p-op-modal__subtitle">
              Registre uma nova ordem de serviço para a equipe de campo, com prazos e prioridades.
            </p>
          </div>
          <button className="v4p-op-modal__close" type="button" onClick={onClose} aria-label="Fechar formulário de nova operação">
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        <form className="v4p-op-modal__form" onSubmit={handleSubmit} noValidate>
          {serverError && (
            <div className="v4p-op-modal__banner--error" role="alert" data-testid="operation-form-error-banner">
              <span className="v4p-op-modal__banner-title">Não foi possível criar a operação.</span>
              <span className="v4p-op-modal__banner-message">{serverError.message}</span>
            </div>
          )}

          <section className="v4p-op-modal__section">
            <span className="v4p-op-modal__section-label">Tipo de operação</span>
            <div
              className="v4p-op-modal__type-grid"
              role="radiogroup"
              aria-label="Tipo de operação"
              aria-required="true"
            >
              {OPERATION_TYPES.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={form.operationType === opt.value}
                  ref={idx === 0 ? firstRef : undefined}
                  className={`v4p-op-modal__type-btn${form.operationType === opt.value ? ' is-selected' : ''}`}
                  onClick={() => set('operationType', opt.value)}
                >
                  <span className="material-symbols-rounded" aria-hidden="true">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            {fieldErrors.operationType && <span className="v4p-op-modal__error" role="alert">{fieldErrors.operationType}</span>}
          </section>

          <section className="v4p-op-modal__section">
            <span className="v4p-op-modal__section-label">Identificação</span>
            <div className="v4p-op-modal__grid">
              {!isInstallation && (
                <Field id="opform-plateId" label="Placa" required error={fieldErrors.plateId}>
                  <BoardSelector
                    value={form.plateId}
                    onChange={setPlate}
                    error={fieldErrors.plateId}
                    open={open}
                    refreshOnNotFound={['OPERATION_BOARD_NOT_FOUND', 'PLATE_OPERATION_ALREADY_OPEN'].includes(serverError?.code)}
                  />
                </Field>
              )}

              <Field id="opform-priority" label="Prioridade" required error={errors.priority}>
                <select
                  id="opform-priority"
                  className="v4p-op-modal__select"
                  value={form.priority}
                  onChange={(e) => set('priority', e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>

              <Field id="opform-assignedTo" label="Responsável / Equipe" error={errors.assignedTo}>
                <input
                  id="opform-assignedTo"
                  className="v4p-op-modal__input"
                  type="text"
                  value={form.assignedTo}
                  onChange={(e) => set('assignedTo', e.target.value)}
                  placeholder="Responsável ou equipe"
                />
              </Field>

              <Field id="opform-teamId" label="Equipe responsável" error={errors.teamId}>
                <TeamSelector
                  value={form.teamId}
                  onChange={(value) => set('teamId', value)}
                  error={fieldErrors.teamId}
                />
              </Field>
            </div>
          </section>

          <section className="v4p-op-modal__section">
            <span className="v4p-op-modal__section-label">Agendamento</span>
            <div className="v4p-op-modal__grid">
              <Field id="opform-scheduledAt" label="Agendado para" error={errors.scheduledAt}>
                <input
                  id="opform-scheduledAt"
                  className="v4p-op-modal__input"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => set('scheduledAt', e.target.value)}
                />
              </Field>

              <Field id="opform-dueAt" label="Prazo / SLA" error={errors.dueAt}>
                <input
                  id="opform-dueAt"
                  className="v4p-op-modal__input"
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(e) => set('dueAt', e.target.value)}
                />
              </Field>
            </div>
          </section>

          {(isInstallation || needsReason) && (
            <section className="v4p-op-modal__section">
              <span className="v4p-op-modal__section-label">Detalhes específicos</span>
              <div className="v4p-op-modal__grid">
                {needsReason && (
                  <Field id="opform-reason" label={reasonLabel} required error={errors.reason}>
                    <textarea
                      id="opform-reason"
                      className="v4p-op-modal__textarea v4p-op-modal__textarea--full"
                      value={form.reason}
                      onChange={(e) => set('reason', e.target.value)}
                      rows={3}
                      placeholder={`Descreva o ${reasonLabel.toLowerCase()}`}
                    />
                  </Field>
                )}

                {isInstallation && (
                  <>
                    <Field id="opform-newAddress" label="Novo endereço após instalação" error={errors.newAddress}>
                      <input
                        id="opform-newAddress"
                        className="v4p-op-modal__input v4p-op-modal__input--full"
                        type="text"
                        value={form.newAddress}
                        onChange={(e) => set('newAddress', e.target.value)}
                        placeholder="Endereço onde a placa foi instalada"
                      />
                    </Field>
                    <Field id="opform-newLatitude" label="Nova latitude" error={errors.newLatitude}>
                      <input
                        id="opform-newLatitude"
                        className="v4p-op-modal__input"
                        type="number"
                        step="any"
                        value={form.newLatitude}
                        onChange={(e) => set('newLatitude', e.target.value)}
                        placeholder="-23.5505"
                      />
                    </Field>
                    <Field id="opform-newLongitude" label="Nova longitude" error={errors.newLongitude}>
                      <input
                        id="opform-newLongitude"
                        className="v4p-op-modal__input"
                        type="number"
                        step="any"
                        value={form.newLongitude}
                        onChange={(e) => set('newLongitude', e.target.value)}
                        placeholder="-46.6333"
                      />
                    </Field>
                  </>
                )}
              </div>
            </section>
          )}

          <section className="v4p-op-modal__section">
            <span className="v4p-op-modal__section-label">Observações</span>
            <Field id="opform-notes" label="Observações" error={errors.notes}>
              <textarea
                id="opform-notes"
                className="v4p-op-modal__textarea v4p-op-modal__textarea--full"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={4}
                placeholder="Adicione observações úteis para a equipe operacional"
              />
            </Field>
          </section>

          <footer className="v4p-op-modal__footer">
            <button type="button" className="v4p-op-modal__btn v4p-op-modal__btn--secondary"
              onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="v4p-op-modal__btn v4p-op-modal__btn--primary"
              disabled={saving || (!isInstallation && !form.plateId)}>
              {saving ? 'Salvando…' : 'Criar operação'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function buildTitle(form) {
  const typeLabel = ALL_OPERATION_TYPES.find((t) => t.value === form.operationType)?.label ?? form.operationType;
  if (form.operationType !== 'INSTALLATION' && form.plateId.trim()) return `${typeLabel} — placa ${form.plateCode || form.plateId.trim()}`;
  return typeLabel;
}

export default memo(OperationFormModal);
