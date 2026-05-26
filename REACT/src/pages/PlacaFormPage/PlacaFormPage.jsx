// PlacaFormPage.jsx — Plate Core Registry V4.1
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchPlacaById, addPlaca, updatePlaca, getPlacaHealth } from '../../services';
import { listRegions } from '../../services/regionService';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import Spinner from '../../components/Spinner/Spinner';
import { getImageUrl } from '../../utils/helpers';
import './PlacaFormPage.css';

// ─── Health Score Badge ────────────────────────────────────────────────────────

function PlateHealthBadge({ score, status, issues }) {
  if (score == null) return null;
  const colorMap = { HEALTHY: '#22c55e', ATTENTION: '#f59e0b', CRITICAL: '#ef4444' };
  const color = colorMap[status] ?? '#6b7280';
  return (
    <div className="plate-health-badge" style={{ borderColor: color }}>
      <span className="plate-health-badge__score" style={{ color }}>
        {score}/100 — {status}
      </span>
      {issues?.length > 0 && (
        <ul className="plate-health-badge__issues">
          {issues.map((issue) => (
            <li key={issue}>⚠ {issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Lock Warning ──────────────────────────────────────────────────────────────

function PlateLockWarning({ locked }) {
  if (!locked) return null;
  return (
    <div className="plate-lock-warning" role="alert">
      🔒 Esta placa possui contrato ativo. Campos críticos estão bloqueados para edição.
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function formatCommercialDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR');
}

function getCommercialState(placa) {
  if (!placa) return null;

  const status = placa.statusAluguel || placa.statusComercial;
  const isReserved = placa.aluguel_futuro || status === 'reservada' || status === 'RESERVED';
  const isOccupied = placa.aluguel_ativo || status === 'alugada' || status === 'OCCUPIED';
  const periodStart = formatCommercialDate(placa.aluguel_data_inicio || placa.temporalStatus?.startDate);
  const periodEnd = formatCommercialDate(placa.aluguel_data_fim || placa.temporalStatus?.endDate);

  return {
    label: isReserved ? 'Reservada' : isOccupied ? 'Contratada' : 'Disponível',
    cliente: placa.cliente_nome || placa.temporalStatus?.cliente || null,
    contrato: placa.contrato_atual || placa.contratoAtual || placa.temporalStatus?.contrato || null,
    periodo: periodStart && periodEnd ? `${periodStart} - ${periodEnd}` : null,
    hasDerivedData: isReserved || isOccupied || placa.cliente_nome || placa.contrato_atual || placa.temporalStatus,
  };
}

function CommercialStateReadOnly({ placa }) {
  const state = getCommercialState(placa);
  if (!state?.hasDerivedData) return null;

  const contratoLabel = typeof state.contrato === 'string'
    ? state.contrato
    : state.contrato?.numero || state.contrato?.id || 'Contrato ativo';

  return (
    <section className="placa-commercial-state" aria-label="Estado comercial atual">
      <div>
        <h2>Estado comercial atual</h2>
        <p>Contratos e clientes são gerenciados em PI/Contratos.</p>
      </div>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{state.label}</dd>
        </div>
        {state.contrato && (
          <div>
            <dt>Contrato atual</dt>
            <dd>{contratoLabel}</dd>
          </div>
        )}
        {state.periodo && (
          <div>
            <dt>Período</dt>
            <dd>{state.periodo}</dd>
          </div>
        )}
        {state.cliente && (
          <div>
            <dt>Cliente</dt>
            <dd>{state.cliente}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function PlacaFormPage() {
  const navigate = useNavigate();
  const { id: placaId } = useParams();
  const isEditMode = Boolean(placaId);

  const [imagePreview, setImagePreview] = useState(null);
  const [initialImageUrl, setInitialImageUrl] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const showToast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError: setFormError,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      numero_placa: '',
      endereco: '',
      nomeDaRua: '',
      latitude: '',
      longitude: '',
      coordenadas: '',
      tamanho: '',
      regiaoId: '',
      regionalLot: '',
      notes: '',
      statusOperacional: 'ACTIVE',
      imagem: null,
    },
  });

  // ── Health score (modo edição) ────────────────────────────────────────────
  const { data: health } = useQuery({
    queryKey: ['placa-health', placaId],
    queryFn: () => getPlacaHealth(placaId),
    enabled: isEditMode && Boolean(placaId),
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  // ── Regiões ativas (V4) ───────────────────────────────────────────────────
  const { data: regioes = [], isLoading: isLoadingRegioes, isError: isErrorRegioes } = useQuery({
    queryKey: ['regions', 'ACTIVE'],
    queryFn: () => listRegions({ status: 'ACTIVE' }),
    staleTime: 1000 * 60 * 60,
    placeholderData: [],
    select: (data) => (Array.isArray(data) ? data : (data?.data ?? data?.regions ?? [])),
  });

  // ── Placa (modo edição) ───────────────────────────────────────────────────
  const { data: placaData, isLoading: isLoadingPlaca } = useQuery({
    queryKey: ['placa', placaId],
    queryFn: () => fetchPlacaById(placaId),
    enabled: isEditMode,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showToast(err.message || 'Erro ao carregar dados da placa.', 'error');
      navigate('/placas');
    },
  });

  // ── Preencher formulário ao carregar placa ────────────────────────────────
  useEffect(() => {
    if (isEditMode && placaData) {
      const currentImageUrl = placaData.imagemPrincipal || placaData.imagem
        ? getImageUrl(placaData.imagemPrincipal || placaData.imagem, '/assets/img/placeholder.png')
        : null;

      reset({
        numero_placa: placaData.numero_placa || '',
        endereco: placaData.endereco || placaData.nomeDaRua || '',
        nomeDaRua: placaData.nomeDaRua || placaData.endereco || '',
        latitude: placaData.latitude ?? '',
        longitude: placaData.longitude ?? '',
        coordenadas: placaData.coordenadas || '',
        tamanho: placaData.tamanho || '',
        regiaoId: placaData.regiao?._id || placaData.regiaoId || '',
        regionalLot: placaData.regionalLot || placaData.loteRegional || '',
        notes: placaData.notes || placaData.observacoes || '',
        statusOperacional: placaData.statusOperacional || 'ACTIVE',
        imagem: null,
      });

      setImagePreview(currentImageUrl);
      setInitialImageUrl(currentImageUrl);

      // Verifica se é placa bloqueada (contrato ativo)
      setIsLocked(
        placaData.statusComercial === 'OCCUPIED' ||
        placaData.statusAluguel === 'alugada' ||
        placaData.aluguel_ativo === true,
      );

    }

    if (!isEditMode) {
      reset({
        numero_placa: '', endereco: '', nomeDaRua: '', latitude: '', longitude: '',
        coordenadas: '', tamanho: '', regiaoId: '', regionalLot: '', notes: '',
        statusOperacional: 'ACTIVE', imagem: null,
      });
      setImagePreview(null);
      setInitialImageUrl(null);
      setIsLocked(false);
    }
  }, [isEditMode, placaData, reset]);

  // ── Preview de imagem ─────────────────────────────────────────────────────
  const imagemField = watch('imagem');
  useEffect(() => {
    if (imagemField && imagemField[0] instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(imagemField[0]);
    } else if (!imagemField && !initialImageUrl) {
      setImagePreview(null);
    } else if (!imagemField && initialImageUrl) {
      setImagePreview(initialImageUrl);
    }
  }, [imagemField, initialImageUrl]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createPlacaMutation = useMutation({
    mutationFn: addPlaca,
    onSuccess: () => {
      showToast('Placa adicionada com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['placas'] });
      navigate('/placas');
    },
    onError: (error) => {
      const msg = error.message || 'Erro ao guardar a placa.';
      showToast(msg, 'error');
      if (msg.toLowerCase().includes('duplicad') || msg.toLowerCase().includes('duplicate')) {
        setFormError('numero_placa', { type: 'api', message: 'Número já existe nesta empresa.' });
      }
      if (msg.toLowerCase().includes('bloqueado') || msg.toLowerCase().includes('contrato')) {
        setIsLocked(true);
      }
    },
  });

  const updatePlacaMutation = useMutation({
    mutationFn: (variables) => updatePlaca(variables.id, variables.formData),
    onSuccess: () => {
      showToast('Placa atualizada com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['placas'] });
      queryClient.invalidateQueries({ queryKey: ['placa', placaId] });
      navigate('/placas');
    },
    onError: (error) => {
      const msg = error.message || 'Erro ao guardar a placa.';
      showToast(msg, 'error');
      if (msg.toLowerCase().includes('bloqueado') || msg.toLowerCase().includes('contrato')) {
        setIsLocked(true);
        showToast('Campos críticos bloqueados: placa possui contrato ativo.', 'warning');
      }
    },
  });

  const isFormSubmitting = createPlacaMutation.isPending || updatePlacaMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRemoveImage = () => {
    setValue('imagem', null, { shouldValidate: false, shouldDirty: true });
    setImagePreview(null);
    showToast('Imagem removida. Guarde para confirmar.', 'info');
  };

  const onSubmit = (data) => {
    const formData = new FormData();

    // Campos texto
    const textFields = ['numero_placa', 'endereco', 'nomeDaRua', 'tamanho', 'regiaoId', 'regionalLot', 'notes', 'statusOperacional'];
    textFields.forEach((key) => {
      if (data[key] != null && data[key] !== '') formData.append(key, data[key]);
    });

    // Coordenadas numéricas
    if (data.latitude !== '' && data.latitude != null) formData.append('latitude', String(data.latitude));
    if (data.longitude !== '' && data.longitude != null) formData.append('longitude', String(data.longitude));
    if (data.coordenadas) formData.append('coordenadas', data.coordenadas);

    // Imagem
    const imageFile = data.imagem?.[0];
    if (imageFile instanceof File) {
      formData.append('imagem', imageFile);
    } else if (isEditMode && !imagePreview && initialImageUrl) {
      formData.append('imagem', '');
    }

    if (isEditMode) {
      updatePlacaMutation.mutate({ id: placaId, formData });
    } else {
      createPlacaMutation.mutate(formData);
    }
  };

  // ── Renderização ───────────────────────────────────────────────────────────
  if ((isEditMode && isLoadingPlaca) || isLoadingRegioes) {
    return <Spinner message={isEditMode ? 'Carregando dados da placa...' : 'Carregando formulário...'} />;
  }
  if (isErrorRegioes) {
    return (
      <div className="placa-form-page">
        <p className="error-message">Erro ao carregar regiões. Não é possível continuar.</p>
      </div>
    );
  }

  return (
    <div className="placa-form-page">
      {/* Header */}
      <div className="placa-form-page__header">
        <h1 className="placa-form-page__title">
          {isEditMode ? 'Editar Placa' : 'Nova Placa'}
        </h1>
        {health && (
          <PlateHealthBadge score={health.score} status={health.status} issues={health.issues} />
        )}
      </div>

      <PlateLockWarning locked={isLocked} />
      <CommercialStateReadOnly placa={placaData} />

      <form id="placa-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="placa-form-page__grid">

          {/* ── Número da Placa ─────────────────────────────── */}
          <div className="placa-form-page__input-group placa-form-page__input-group--full">
            <label htmlFor="numero_placa" className="placa-form-page__label">
              Número da Placa <span className="required">*</span>
            </label>
            <input
              type="text"
              id="numero_placa"
              className={`placa-form-page__input ${errors.numero_placa ? 'input-error' : ''}`}
              {...register('numero_placa', { required: 'O número é obrigatório.' })}
              disabled={isFormSubmitting || (isLocked && isEditMode)}
            />
            {errors.numero_placa && <span className="modal-form__error-message">{errors.numero_placa.message}</span>}
          </div>

          {/* ── Endereço ────────────────────────────────────── */}
          <div className="placa-form-page__input-group placa-form-page__input-group--full">
            <label htmlFor="endereco" className="placa-form-page__label">
              Endereço <span className="required">*</span>
            </label>
            <input
              type="text"
              id="endereco"
              placeholder="Ex: Av. Paulista, 100 — São Paulo / SP"
              className={`placa-form-page__input ${errors.endereco ? 'input-error' : ''}`}
              {...register('endereco', {
                required: 'O endereço é obrigatório.',
                maxLength: { value: 500, message: 'Máx. 500 caracteres' },
              })}
              disabled={isFormSubmitting || (isLocked && isEditMode)}
            />
            {errors.endereco && <span className="modal-form__error-message">{errors.endereco.message}</span>}
          </div>

          {/* ── Latitude ────────────────────────────────────── */}
          <div className="placa-form-page__input-group">
            <label htmlFor="latitude" className="placa-form-page__label">Latitude</label>
            <input
              type="number"
              id="latitude"
              step="any"
              placeholder="-23.5505"
              className={`placa-form-page__input ${errors.latitude ? 'input-error' : ''}`}
              {...register('latitude', {
                min: { value: -90, message: 'Mínimo -90' },
                max: { value: 90, message: 'Máximo 90' },
                validate: (v) => {
                  const lng = watch('longitude');
                  if ((v !== '' && v != null) && (lng === '' || lng == null)) return 'Informe também a longitude';
                  return true;
                },
              })}
              disabled={isFormSubmitting || (isLocked && isEditMode)}
            />
            {errors.latitude && <span className="modal-form__error-message">{errors.latitude.message}</span>}
          </div>

          {/* ── Longitude ───────────────────────────────────── */}
          <div className="placa-form-page__input-group">
            <label htmlFor="longitude" className="placa-form-page__label">Longitude</label>
            <input
              type="number"
              id="longitude"
              step="any"
              placeholder="-46.6333"
              className={`placa-form-page__input ${errors.longitude ? 'input-error' : ''}`}
              {...register('longitude', {
                min: { value: -180, message: 'Mínimo -180' },
                max: { value: 180, message: 'Máximo 180' },
                validate: (v) => {
                  const lat = watch('latitude');
                  if ((v !== '' && v != null) && (lat === '' || lat == null)) return 'Informe também a latitude';
                  return true;
                },
              })}
              disabled={isFormSubmitting || (isLocked && isEditMode)}
            />
            {errors.longitude && <span className="modal-form__error-message">{errors.longitude.message}</span>}
          </div>

          {/* ── Região ──────────────────────────────────────── */}
          <div className="placa-form-page__input-group">
            <label htmlFor="regiaoId" className="placa-form-page__label">
              Região <span className="required">*</span>
            </label>
            <select
              id="regiaoId"
              className={`placa-form-page__select ${errors.regiaoId ? 'input-error' : ''}`}
              {...register('regiaoId', { required: 'Selecione uma região.' })}
              disabled={isFormSubmitting || isLoadingRegioes || (isLocked && isEditMode)}
            >
              <option value="">{isLoadingRegioes ? 'Carregando...' : 'Selecione...'}</option>
              {regioes.map((r) => {
                const rId = r._id || r.id || '';
                const rName = r.name || r.nome || rId;
                return <option key={rId} value={rId}>{rName}</option>;
              })}
            </select>
            {errors.regiaoId && <span className="modal-form__error-message">{errors.regiaoId.message}</span>}
          </div>

          {/* ── Lote Regional ───────────────────────────────── */}
          <div className="placa-form-page__input-group">
            <label htmlFor="regionalLot" className="placa-form-page__label">Lote Regional (opcional)</label>
            <input
              type="text"
              id="regionalLot"
              placeholder="Ex: LT-001"
              className="placa-form-page__input"
              {...register('regionalLot', { maxLength: { value: 100, message: 'Máx. 100 caracteres' } })}
              disabled={isFormSubmitting || (isLocked && isEditMode)}
            />
            {errors.regionalLot && <span className="modal-form__error-message">{errors.regionalLot.message}</span>}
          </div>

          {/* ── Status Operacional ──────────────────────────── */}
          <div className="placa-form-page__input-group">
            <label htmlFor="statusOperacional" className="placa-form-page__label">Status Operacional</label>
            <select
              id="statusOperacional"
              className="placa-form-page__select"
              {...register('statusOperacional')}
              disabled={isFormSubmitting}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="MAINTENANCE">Manutenção</option>
            </select>
          </div>
          {/* ── Tamanho ─────────────────────────────────────── */}
          <div className="placa-form-page__input-group">
            <label htmlFor="tamanho" className="placa-form-page__label">Tamanho (ex: 9x3)</label>
            <input
              type="text"
              id="tamanho"
              className={`placa-form-page__input ${errors.tamanho ? 'input-error' : ''}`}
              {...register('tamanho', { maxLength: { value: 50, message: 'Máx. 50' } })}
              disabled={isFormSubmitting}
            />
            {errors.tamanho && <span className="modal-form__error-message">{errors.tamanho.message}</span>}
          </div>

          {/* ── Observações ─────────────────────────────────── */}
          <div className="placa-form-page__input-group placa-form-page__input-group--full">
            <label htmlFor="notes" className="placa-form-page__label">Observações</label>
            <textarea
              id="notes"
              rows={3}
              className="placa-form-page__input placa-form-page__textarea"
              {...register('notes', { maxLength: { value: 2000, message: 'Máx. 2000 caracteres' } })}
              disabled={isFormSubmitting}
            />
            {errors.notes && <span className="modal-form__error-message">{errors.notes.message}</span>}
          </div>

          {/* ── Imagem Principal ────────────────────────────── */}
          <div className="placa-form-page__input-group placa-form-page__input-group--full">
            <label htmlFor="imagem" className="placa-form-page__label">Imagem Principal (opcional)</label>
            <input
              type="file"
              id="imagem"
              className={`placa-form-page__input ${errors.imagem ? 'input-error' : ''}`}
              accept="image/jpeg,image/png,image/webp,image/gif"
              {...register('imagem')}
              disabled={isFormSubmitting}
            />
            <div className="placa-form-page__image-preview-container">
              {imagePreview ? (
                <>
                  <img
                    id="image-preview"
                    src={imagePreview}
                    alt="Pré-visualização"
                    className="placa-form-page__image-preview"
                  />
                  <button
                    type="button"
                    id="remove-image-button"
                    className="placa-form-page__remove-image-button"
                    onClick={handleRemoveImage}
                    disabled={isFormSubmitting}
                  >
                    <i className="fas fa-trash" /> Remover
                  </button>
                </>
              ) : (
                <span id="image-preview-text" className="placa-form-page__image-placeholder">
                  Nenhuma imagem selecionada
                </span>
              )}
            </div>
            {errors.imagem && <span className="modal-form__error-message">{errors.imagem.message}</span>}
          </div>
        </div>

        {/* ── Ações ────────────────────────────────────────── */}
        <div className="placa-form-page__actions">
          <button
            type="button"
            className="placa-form-page__button placa-form-page__button--cancel"
            onClick={() => navigate('/placas')}
            disabled={isFormSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="placa-form-page__button placa-form-page__button--confirm"
            disabled={isFormSubmitting || isLoadingRegioes}
          >
            {isFormSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PlacaFormPage;
