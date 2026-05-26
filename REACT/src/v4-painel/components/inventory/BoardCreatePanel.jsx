import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listRegions } from '../../../services/regionService.js';
import './BoardEditPanel.css';

const EMPTY_FORM = {
  codigo: '',
  endereco: '',
  latitude: '',
  longitude: '',
  regiaoId: '',
  regionalLot: '',
  statusOperacional: 'ACTIVE',
  tamanho: '',
  notes: '',
};

function Field({ label, children, full, required }) {
  return (
    <div className="v4p-edit-panel__field" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="v4p-edit-panel__label">
        {label}
        {required && <span style={{ color: 'var(--v4p-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function validate(form) {
  const errors = {};
  if (!form.codigo.trim()) errors.codigo = 'Numero da placa obrigatorio.';
  if (!form.endereco.trim()) errors.endereco = 'Endereco obrigatorio.';
  if (!form.regiaoId) errors.regiaoId = 'Selecione uma regiao.';
  const hasLat = form.latitude !== '' && form.latitude != null;
  const hasLng = form.longitude !== '' && form.longitude != null;
  if (hasLat && !hasLng) errors.longitude = 'Informe a longitude.';
  if (hasLng && !hasLat) errors.latitude = 'Informe a latitude.';
  return errors;
}

function BoardCreatePanel({ onSave, onClose, saving = false }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [localSaving, setLocalSaving] = useState(false);
  const [regions, setRegions] = useState([]);
  const firstInputRef = useRef(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => firstInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    listRegions({ status: 'ACTIVE' })
      .then((data) => setRegions(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(() => {});
  }, []);

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  const isBusy = saving || localSaving;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = async () => {
    if (isBusy) return;
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLocalSaving(true);
    try {
      await onSave({
        ...form,
        latitude: form.latitude !== '' ? Number(form.latitude) : undefined,
        longitude: form.longitude !== '' ? Number(form.longitude) : undefined,
      });
      onClose();
    } finally {
      setLocalSaving(false);
    }
  };

  const panel = (
    <div className="v4p-edit-panel__backdrop" onClick={handleBackdropClick} aria-hidden="false">
      <div className="v4p-edit-panel" role="dialog" aria-modal="true" aria-labelledby="v4p-create-panel-title">
        <header className="v4p-edit-panel__header">
          <div>
            <span className="v4p-edit-panel__eyebrow">Nova placa</span>
            <h2 id="v4p-create-panel-title">Criar placa operacional</h2>
          </div>
          <button
            type="button"
            className="v4p-edit-panel__close material-symbols-rounded"
            onClick={onClose}
            aria-label="Fechar criacao de placa"
            disabled={isBusy}
          >
            close
          </button>
        </header>

        <div className="v4p-edit-panel__body">
          <div className="v4p-edit-panel__grid">
            <Field label="Numero da placa" required>
              <input
                ref={firstInputRef}
                className={`v4p-edit-panel__input${errors.codigo ? ' v4p-edit-panel__input--error' : ''}`}
                value={form.codigo}
                placeholder="Ex: PLB-001"
                onChange={(e) => set('codigo', e.target.value)}
                disabled={isBusy}
              />
              {errors.codigo && <span style={{ fontSize: 10, color: 'var(--v4p-danger)', marginTop: 2 }}>{errors.codigo}</span>}
            </Field>

            <Field label="Status operacional">
              <select
                className="v4p-edit-panel__select"
                value={form.statusOperacional}
                onChange={(e) => set('statusOperacional', e.target.value)}
                disabled={isBusy}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="MAINTENANCE">Manutencao</option>
              </select>
            </Field>

            <Field label="Endereco" full required>
              <input
                className={`v4p-edit-panel__input${errors.endereco ? ' v4p-edit-panel__input--error' : ''}`}
                value={form.endereco}
                placeholder="Ex: Av. Paulista, 100 - Sao Paulo / SP"
                onChange={(e) => set('endereco', e.target.value)}
                disabled={isBusy}
              />
              {errors.endereco && <span style={{ fontSize: 10, color: 'var(--v4p-danger)', marginTop: 2 }}>{errors.endereco}</span>}
            </Field>

            <Field label="Latitude">
              <input
                className={`v4p-edit-panel__input${errors.latitude ? ' v4p-edit-panel__input--error' : ''}`}
                type="number"
                step="any"
                placeholder="-23.5505"
                value={form.latitude}
                onChange={(e) => set('latitude', e.target.value)}
                disabled={isBusy}
              />
              {errors.latitude && <span style={{ fontSize: 10, color: 'var(--v4p-danger)', marginTop: 2 }}>{errors.latitude}</span>}
            </Field>

            <Field label="Longitude">
              <input
                className={`v4p-edit-panel__input${errors.longitude ? ' v4p-edit-panel__input--error' : ''}`}
                type="number"
                step="any"
                placeholder="-46.6333"
                value={form.longitude}
                onChange={(e) => set('longitude', e.target.value)}
                disabled={isBusy}
              />
              {errors.longitude && <span style={{ fontSize: 10, color: 'var(--v4p-danger)', marginTop: 2 }}>{errors.longitude}</span>}
            </Field>

            <Field label="Regiao" required>
              <select
                className={`v4p-edit-panel__select${errors.regiaoId ? ' v4p-edit-panel__input--error' : ''}`}
                value={form.regiaoId}
                onChange={(e) => set('regiaoId', e.target.value)}
                disabled={isBusy}
              >
                <option value="">{regions.length === 0 ? 'Carregando...' : 'Selecione...'}</option>
                {regions.map((r) => {
                  const rId = r._id || r.id || '';
                  const rName = r.name || r.nome || rId;
                  return <option key={rId} value={rId}>{rName}</option>;
                })}
              </select>
              {errors.regiaoId && <span style={{ fontSize: 10, color: 'var(--v4p-danger)', marginTop: 2 }}>{errors.regiaoId}</span>}
            </Field>

            <Field label="Lote regional">
              <input
                className="v4p-edit-panel__input"
                value={form.regionalLot}
                placeholder="Ex: LT-001"
                onChange={(e) => set('regionalLot', e.target.value)}
                disabled={isBusy}
              />
            </Field>

            <Field label="Tamanho">
              <input
                className="v4p-edit-panel__input"
                value={form.tamanho}
                placeholder="Ex: 9x3m"
                onChange={(e) => set('tamanho', e.target.value)}
                disabled={isBusy}
              />
            </Field>

            <Field label="Observacoes" full>
              <textarea
                className="v4p-edit-panel__textarea"
                rows={3}
                value={form.notes}
                placeholder="Informacoes operacionais adicionais sobre a placa"
                onChange={(e) => set('notes', e.target.value)}
                disabled={isBusy}
              />
            </Field>

            <Field label="Imagem principal" full>
              <input
                className="v4p-edit-panel__input"
                value="Salve a placa para enviar imagens."
                disabled
                readOnly
              />
            </Field>
          </div>

          <div className="v4p-edit-panel__notice" role="status">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>image</span>
            Salve a placa para enviar imagens.
          </div>
        </div>

        <footer className="v4p-edit-panel__footer">
          <button type="button" className="v4p-edit-panel__btn-cancel" onClick={onClose} disabled={isBusy}>
            Cancelar
          </button>
          <button type="button" className="v4p-edit-panel__btn-save" onClick={handleSave} disabled={isBusy}>
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add_circle</span>
            {isBusy ? 'Criando...' : 'Criar placa'}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

export default memo(BoardCreatePanel);
