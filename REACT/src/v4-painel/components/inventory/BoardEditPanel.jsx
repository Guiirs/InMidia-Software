import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listRegions } from '../../../services/regionService.js';
import { normalizeBoardCoordinates } from '../../integration/adapters/boardCoordinates.js';
import PlateImageManager from '../media/PlateImageManager.jsx';
import './BoardEditPanel.css';

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

function commercialState(board) {
  if (!board?.cliente && !board?.campanha && !board?.vencimento && board?.status !== 'reserved' && board?.status !== 'occupied') {
    return null;
  }

  return {
    status: board.status === 'reserved' ? 'Reservada' : board.status === 'occupied' ? 'Contratada' : 'Disponivel',
    cliente: board.cliente ?? null,
    contrato: board.contratoAtual ?? board.contractId ?? null,
    periodo: board.vencimento ? `Ate ${board.vencimento}` : null,
  };
}

function validate(form) {
  const errors = {};
  if (!form.codigo.trim()) errors.codigo = 'Numero da placa obrigatorio.';
  if (!form.endereco.trim()) errors.endereco = 'Endereco obrigatorio.';
  const hasLat = form.latitude !== '' && form.latitude != null;
  const hasLng = form.longitude !== '' && form.longitude != null;
  if (hasLat && !hasLng) errors.longitude = 'Informe a longitude.';
  if (hasLng && !hasLat) errors.latitude = 'Informe a latitude.';
  return errors;
}

function normalizeImages(board, mainUrl) {
  const images = Array.isArray(board?.imagens) ? board.imagens : [];
  const fallback = mainUrl && !images.some((image) => image.url === mainUrl)
    ? [{ id: 'legacy-main', url: mainUrl, category: 'MAIN', isMain: true, source: 'IMPORTED' }]
    : [];
  return [...images, ...fallback].map((image, index) => ({
    id: image.id ?? image._id ?? `image-${index}`,
    url: image.url,
    filename: image.filename ?? 'Imagem da placa',
    category: image.category ?? 'OTHER',
    isMain: Boolean(image.isMain || image.url === mainUrl),
    source: image.source ?? 'UPLOAD',
    uploadedAt: image.uploadedAt ?? null,
  })).filter((image) => image.url);
}

function BoardEditPanel({ board, onSave, onClose, saving = false, onImageChange }) {
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [regions, setRegions] = useState([]);
  const [localSaving, setLocalSaving] = useState(false);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (!board) return;
    const coords = normalizeBoardCoordinates(board);
    const imageUrl = board.imageUrl ?? board.imagemPrincipal ?? board.imagem ?? '';
    setForm({
      id: board.id,
      _source: board._source,
      codigo: board.codigo ?? board.numero_placa ?? '',
      endereco: board.endereco ?? board.localizacao ?? board.nomeDaRua ?? '',
      latitude: coords.hasCoordinates ? coords.latitude : '',
      longitude: coords.hasCoordinates ? coords.longitude : '',
      regiaoId: board.regiaoId ?? board.regionId ?? '',
      regionalLot: board.regionalLot ?? board.loteRegional ?? '',
      statusOperacional: board.statusOperacional ?? 'ACTIVE',
      tamanho: board.tamanho ?? '',
      imageUrl,
      imagens: normalizeImages(board, imageUrl),
      notes: board.notes ?? board.observacoes ?? '',
    });
    setErrors({});
  }, [board]);

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
    const id = requestAnimationFrame(() => firstInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    listRegions({ status: 'ACTIVE' })
      .then((data) => setRegions(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(() => {});
  }, []);

  if (!board || !form) return null;

  const state = commercialState(board);
  const isBusy = saving || localSaving;
  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

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
        ...board,
        ...form,
        latitude: form.latitude !== '' ? Number(form.latitude) : undefined,
        longitude: form.longitude !== '' ? Number(form.longitude) : undefined,
      });
      onClose();
    } finally {
      setLocalSaving(false);
    }
  };

  const applyImageBoard = (nextBoard) => {
    const imageUrl = nextBoard.imageUrl ?? nextBoard.imagemPrincipal ?? nextBoard.imagem ?? '';
    setForm((prev) => prev ? ({
      ...prev,
      imageUrl,
      imagens: normalizeImages(nextBoard, imageUrl),
    }) : prev);
    onImageChange?.(nextBoard);
  };

  const panel = (
    <div className="v4p-edit-panel__backdrop" onClick={handleBackdropClick} aria-hidden="false">
      <div className="v4p-edit-panel" role="dialog" aria-modal="true" aria-labelledby="v4p-edit-panel-title">
        <header className="v4p-edit-panel__header">
          <div>
            <span className="v4p-edit-panel__eyebrow">Editar placa</span>
            <h2 className="v4p-mono" id="v4p-edit-panel-title">{board.codigo}</h2>
          </div>
          <button
            type="button"
            className="v4p-edit-panel__close material-symbols-rounded"
            onClick={onClose}
            aria-label={`Fechar edicao da placa ${board.codigo}`}
            disabled={isBusy}
          >
            close
          </button>
        </header>

        {state && (
          <section className="v4p-edit-panel__notice" aria-label="Estado comercial atual">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>info</span>
            <span>
              Estado comercial atual: {state.status}
              {state.cliente ? ` - ${state.cliente}` : ''}
              {state.periodo ? ` (${state.periodo})` : ''}. Contratos e clientes sao gerenciados em PI/Contratos.
            </span>
          </section>
        )}

        <div className="v4p-edit-panel__body">
          <div className="v4p-edit-panel__grid">
            <Field label="Numero da placa" required>
              <input
                ref={firstInputRef}
                className={`v4p-edit-panel__input${errors.codigo ? ' v4p-edit-panel__input--error' : ''}`}
                value={form.codigo}
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
                placeholder="Av. Paulista, 100 - Sao Paulo / SP"
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

            <Field label="Regiao">
              <select
                className="v4p-edit-panel__select"
                value={form.regiaoId}
                onChange={(e) => set('regiaoId', e.target.value)}
                disabled={isBusy}
              >
                {!form.regiaoId && <option value="">{board.regiao ?? 'Selecione...'}</option>}
                {regions.map((r) => {
                  const rId = r._id || r.id || '';
                  const rName = r.name || r.nome || rId;
                  return <option key={rId} value={rId}>{rName}</option>;
                })}
              </select>
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

            <Field label="Imagem principal" full>
              <PlateImageManager
                board={{ ...board, ...form }}
                disabled={isBusy}
                onChange={applyImageBoard}
              />
            </Field>

            <Field label="Observacoes" full>
              <textarea
                className="v4p-edit-panel__textarea"
                value={form.notes}
                rows={3}
                placeholder="Informacoes operacionais adicionais sobre a placa"
                onChange={(e) => set('notes', e.target.value)}
                disabled={isBusy}
              />
            </Field>
          </div>
        </div>

        <footer className="v4p-edit-panel__footer">
          <button type="button" className="v4p-edit-panel__btn-cancel" onClick={onClose} disabled={isBusy}>
            Cancelar
          </button>
          <button type="button" className="v4p-edit-panel__btn-save" onClick={handleSave} disabled={isBusy}>
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>save</span>
            {isBusy ? 'Salvando...' : 'Salvar placa'}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

export default memo(BoardEditPanel);
