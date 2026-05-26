import { memo, useEffect, useRef, useState } from 'react';

const OPERATION_TYPES = [
  { value: 'INSTALLATION', label: 'Instalação' },
  { value: 'SCRAPING',     label: 'Raspagem' },
  { value: 'MAINTENANCE',  label: 'Manutenção' },
  { value: 'BLOCK',        label: 'Bloqueio operacional' },
  { value: 'INSPECTION',   label: 'Inspeção' },
  { value: 'OTHER',        label: 'Outro' },
];

const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Crítica' },
  { value: 'HIGH',     label: 'Alta' },
  { value: 'MEDIUM',   label: 'Média' },
  { value: 'LOW',      label: 'Baixa' },
];

const PLATE_REQUIRED_TYPES = new Set(['INSTALLATION', 'SCRAPING', 'MAINTENANCE', 'BLOCK']);
const REASON_REQUIRED_TYPES = new Set(['BLOCK', 'MAINTENANCE']);

const EMPTY_FORM = {
  operationType: 'INSTALLATION',
  plateId: '',
  scheduledAt: '',
  dueAt: '',
  priority: 'MEDIUM',
  assignedTo: '',
  notes: '',
  reason: '',
  newAddress: '',
  newLatitude: '',
  newLongitude: '',
};

function Field({ label, required, error, children }) {
  return (
    <div className="v4p-op-modal__field">
      <label className="v4p-op-modal__label">
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
  if (PLATE_REQUIRED_TYPES.has(form.operationType) && !form.plateId.trim()) {
    errors.plateId = 'Placa obrigatória para este tipo de operação.';
  }
  if (!form.priority) errors.priority = 'Prioridade obrigatória.';
  if (REASON_REQUIRED_TYPES.has(form.operationType) && !form.reason.trim()) {
    errors.reason = 'Motivo obrigatório para este tipo de operação.';
  }
  if (form.newLatitude && !form.newLongitude) errors.newLongitude = 'Informe a longitude.';
  if (form.newLongitude && !form.newLatitude) errors.newLatitude = 'Informe a latitude.';
  if (form.dueAt && form.scheduledAt && form.dueAt < form.scheduledAt) {
    errors.dueAt = 'Prazo não pode ser anterior ao agendamento.';
  }
  return errors;
}

function OperationFormModal({ open, onClose, onSave, saving = false, initialType }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    operationType: initialType ?? 'INSTALLATION',
  }));
  const [errors, setErrors] = useState({});
  const firstRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, operationType: initialType ?? 'INSTALLATION' });
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

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const payload = {
      operationType: form.operationType,
      priority: form.priority,
      ...(form.plateId.trim() ? { plateId: form.plateId.trim() } : {}),
      ...(form.scheduledAt ? { scheduledAt: form.scheduledAt } : {}),
      ...(form.dueAt ? { dueAt: form.dueAt, slaDueAt: form.dueAt } : {}),
      ...(form.assignedTo.trim() ? { assignedTo: form.assignedTo.trim() } : {}),
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
  const plateRequired = PLATE_REQUIRED_TYPES.has(form.operationType);

  return (
    <div className="v4p-op-modal__backdrop" role="dialog" aria-modal="true" aria-label="Nova operação"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="v4p-op-modal__dialog">
        <header className="v4p-op-modal__header">
          <h2 className="v4p-op-modal__title">Nova operação</h2>
          <button className="v4p-op-modal__close" type="button" onClick={onClose} aria-label="Fechar">
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        <form className="v4p-op-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="v4p-op-modal__grid">

            <Field label="Tipo de operação" required error={errors.operationType}>
              <select
                ref={firstRef}
                className="v4p-op-modal__select"
                value={form.operationType}
                onChange={(e) => set('operationType', e.target.value)}
              >
                {OPERATION_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Placa (ID canônico)" required={plateRequired} error={errors.plateId}>
              <input
                className="v4p-op-modal__input"
                type="text"
                value={form.plateId}
                onChange={(e) => set('plateId', e.target.value)}
                placeholder="MongoDB ObjectId da placa"
              />
            </Field>

            <Field label="Prioridade" required error={errors.priority}>
              <select
                className="v4p-op-modal__select"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Responsável / Equipe" error={errors.assignedTo}>
              <input
                className="v4p-op-modal__input"
                type="text"
                value={form.assignedTo}
                onChange={(e) => set('assignedTo', e.target.value)}
                placeholder="Nome ou ID do responsável"
              />
            </Field>

            <Field label="Agendado para" error={errors.scheduledAt}>
              <input
                className="v4p-op-modal__input"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => set('scheduledAt', e.target.value)}
              />
            </Field>

            <Field label="Prazo / SLA" error={errors.dueAt}>
              <input
                className="v4p-op-modal__input"
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => set('dueAt', e.target.value)}
              />
            </Field>

            {needsReason && (
              <Field label="Motivo" required error={errors.reason} full>
                <textarea
                  className="v4p-op-modal__textarea"
                  value={form.reason}
                  onChange={(e) => set('reason', e.target.value)}
                  rows={2}
                  placeholder="Descreva o motivo da operação"
                />
              </Field>
            )}

            <Field label="Observações" error={errors.notes} full>
              <textarea
                className="v4p-op-modal__textarea"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                placeholder="Informações adicionais"
              />
            </Field>

            {isInstallation && (
              <>
                <Field label="Novo endereço (pós instalação)" error={errors.newAddress} full>
                  <input
                    className="v4p-op-modal__input"
                    type="text"
                    value={form.newAddress}
                    onChange={(e) => set('newAddress', e.target.value)}
                    placeholder="Endereço após a instalação"
                  />
                </Field>
                <Field label="Nova latitude" error={errors.newLatitude}>
                  <input
                    className="v4p-op-modal__input"
                    type="number"
                    step="any"
                    value={form.newLatitude}
                    onChange={(e) => set('newLatitude', e.target.value)}
                    placeholder="-23.5505"
                  />
                </Field>
                <Field label="Nova longitude" error={errors.newLongitude}>
                  <input
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

          <footer className="v4p-op-modal__footer">
            <button type="button" className="v4p-op-modal__btn v4p-op-modal__btn--secondary"
              onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="v4p-op-modal__btn v4p-op-modal__btn--primary"
              disabled={saving}>
              {saving ? 'Salvando…' : 'Criar operação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function buildTitle(form) {
  const typeLabel = OPERATION_TYPES.find((t) => t.value === form.operationType)?.label ?? form.operationType;
  if (form.plateId.trim()) return `${typeLabel} — placa ${form.plateId.trim()}`;
  return typeLabel;
}

export default memo(OperationFormModal);
