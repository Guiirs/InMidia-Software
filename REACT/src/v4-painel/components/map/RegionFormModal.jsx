import { memo, useEffect, useState } from 'react';
import './RegionFormModal.css';

const COLOR_OPTIONS = [
  { label: 'Ciano', value: '#22d3ee' },
  { label: 'Verde', value: '#38c78f' },
  { label: 'Azul', value: '#7485ff' },
  { label: 'Amarelo', value: '#e3b456' },
  { label: 'Vermelho', value: '#ef4444' },
];

const STATUS_OPTIONS = [
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
];

const INITIAL_FORM = {
  name: '',
  code: '',
  city: '',
  state: '',
  centerLatitude: '',
  centerLongitude: '',
  color: '#22d3ee',
  ownerName: '',
  status: 'active',
  notes: '',
};

function fieldErrors(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Nome obrigatório.';
  if (!form.code.trim()) errors.code = 'Código obrigatório.';
  if (form.centerLatitude && isNaN(Number(form.centerLatitude))) {
    errors.centerLatitude = 'Latitude deve ser numérica.';
  }
  if (form.centerLongitude && isNaN(Number(form.centerLongitude))) {
    errors.centerLongitude = 'Longitude deve ser numérica.';
  }
  return errors;
}

function RegionFormModal({ open, region, onClose, onSave, saving }) {
  const isEdit = Boolean(region?.id);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(
        region
          ? {
              name: region.name ?? '',
              code: region.code ?? '',
              city: region.city ?? '',
              state: region.state ?? '',
              centerLatitude: region.centerLatitude != null ? String(region.centerLatitude) : '',
              centerLongitude: region.centerLongitude != null ? String(region.centerLongitude) : '',
              color: region.color ?? '#22d3ee',
              ownerName: region.ownerName ?? '',
              status: region.status ?? 'active',
              notes: region.notes ?? '',
            }
          : INITIAL_FORM,
      );
      setErrors({});
    }
  }, [open, region]);

  if (!open) return null;

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const errs = fieldErrors(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      centerLatitude: form.centerLatitude !== '' ? Number(form.centerLatitude) : undefined,
      centerLongitude: form.centerLongitude !== '' ? Number(form.centerLongitude) : undefined,
      color: form.color || undefined,
      ownerName: form.ownerName.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };
    onSave?.(payload);
  };

  return (
    <div className="v4p-region-modal" role="presentation">
      <div className="v4p-region-modal__backdrop" onClick={onClose} />
      <form
        className="v4p-region-modal__panel"
        onSubmit={handleSubmit}
        aria-label={isEdit ? 'Editar região' : 'Nova região operacional'}
        noValidate
      >
        <header className="v4p-region-modal__header">
          <div>
            <span>Território</span>
            <h2>{isEdit ? 'Editar região' : 'Nova região'}</h2>
          </div>
          <button
            type="button"
            className="v4p-region-modal__icon-btn material-symbols-rounded"
            onClick={onClose}
            aria-label="Fechar"
            disabled={saving}
          >
            close
          </button>
        </header>

        {/* ── IDENTIDADE TERRITORIAL ──────────────────────────── */}
        <div className="v4p-region-modal__section">
          <span className="v4p-region-modal__section-label">Identidade territorial</span>
          <div className="v4p-region-modal__grid">
            <label className={errors.name ? 'has-error' : ''}>
              <span>Nome da região *</span>
              <input
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Ex.: Nordeste Premium"
              />
              {errors.name && <em>{errors.name}</em>}
            </label>

            <label className={errors.code ? 'has-error' : ''}>
              <span>Código *</span>
              <input
                required
                value={form.code}
                onChange={(e) => update('code', e.target.value.toUpperCase())}
                placeholder="Ex.: NE-PREM"
                maxLength={20}
              />
              {errors.code && <em>{errors.code}</em>}
            </label>
          </div>

          <fieldset className="v4p-region-modal__colors">
            <legend>Cor de identificação</legend>
            <div>
              {COLOR_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={form.color === opt.value ? 'is-selected' : ''}
                  onClick={() => update('color', opt.value)}
                  style={{ '--v4p-region-form-color': opt.value }}
                  aria-label={opt.label}
                  aria-pressed={form.color === opt.value}
                />
              ))}
            </div>
          </fieldset>
        </div>

        {/* ── LOCALIZAÇÃO ────────────────────────────────────── */}
        <div className="v4p-region-modal__section">
          <span className="v4p-region-modal__section-label">Localização</span>
          <div className="v4p-region-modal__grid">
            <label>
              <span>Cidade</span>
              <input
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="São Paulo"
              />
            </label>

            <label>
              <span>Estado (UF)</span>
              <input
                value={form.state}
                maxLength={2}
                onChange={(e) => update('state', e.target.value.toUpperCase())}
                placeholder="SP"
              />
            </label>
          </div>

          <details className="v4p-region-modal__coords">
            <summary>Coordenadas centrais (opcional)</summary>
            <div className="v4p-region-modal__grid">
              <label className={errors.centerLatitude ? 'has-error' : ''}>
                <span>Latitude</span>
                <input
                  type="number"
                  step="any"
                  value={form.centerLatitude}
                  onChange={(e) => update('centerLatitude', e.target.value)}
                  placeholder="-23.5505"
                />
                {errors.centerLatitude && <em>{errors.centerLatitude}</em>}
              </label>

              <label className={errors.centerLongitude ? 'has-error' : ''}>
                <span>Longitude</span>
                <input
                  type="number"
                  step="any"
                  value={form.centerLongitude}
                  onChange={(e) => update('centerLongitude', e.target.value)}
                  placeholder="-46.6333"
                />
                {errors.centerLongitude && <em>{errors.centerLongitude}</em>}
              </label>
            </div>
          </details>
        </div>

        {/* ── OPERAÇÃO ────────────────────────────────────────── */}
        <div className="v4p-region-modal__section">
          <span className="v4p-region-modal__section-label">Operação</span>
          <div className="v4p-region-modal__grid">
            <label>
              <span>Responsável</span>
              <input
                value={form.ownerName}
                onChange={(e) => update('ownerName', e.target.value)}
                placeholder="Nome do responsável"
              />
            </label>

            <label>
              <span>Status</span>
              <select value={form.status} onChange={(e) => update('status', e.target.value)}>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── NOTAS ───────────────────────────────────────────── */}
        <label className="v4p-region-modal__textarea">
          <span>Notas</span>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Contexto comercial, cobertura desejada, notas de expansão."
            rows={3}
          />
        </label>

        <footer className="v4p-region-modal__footer">
          <button
            type="button"
            className="v4p-region-modal__secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="v4p-region-modal__primary" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar região'}
          </button>
        </footer>
      </form>
    </div>
  );
}

export default memo(RegionFormModal);
